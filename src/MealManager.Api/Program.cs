using FluentValidation;
using Hellang.Middleware.ProblemDetails;
using Hellang.Middleware.ProblemDetails.Mvc;
using MealManager.Application;
using MealManager.Api.Mcp;
using MealManager.Common.Errors;
using MealManager.Domain.Entities;
using MealManager.Infrastructure;
using MealManager.Infrastructure.Database;
using MealManager.Infrastructure.Identity;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Net.Http.Headers;
using Scalar.AspNetCore;
using System.Diagnostics.CodeAnalysis;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.Json.Serialization.Metadata;
using ProblemDetailsOptions = Hellang.Middleware.ProblemDetails.ProblemDetailsOptions;
using SameSiteMode = Microsoft.AspNetCore.Http.SameSiteMode;
using McpImplementation = ModelContextProtocol.Protocol.Implementation;

namespace MealManager.Api;

[SuppressMessage("csharpsquid", "S1118", Justification = "Used by WebApplicationFactory")]
public class Program
{
    public static async Task Main(string[] args)
    {
        var recovery = args.FirstOrDefault() == "recover-admin";
        if (recovery && args.Length != 2) throw new ArgumentException("Usage: recover-admin <administrator-email>. The temporary password is read from stdin.");
        var builder = WebApplication.CreateBuilder(recovery ? [] : args);

        builder
            .Services.AddControllersWithViews(options =>
            {
                options.Filters.Add<FluentValidationFilter>();
                options.Filters.Add<PasswordChangeRequiredFilter>();
                options.Filters.Add(new AutoValidateAntiforgeryTokenAttribute());
            })
            .AddProblemDetailsConventions()
            .AddJsonOptions(ConfigureJsonOptions);

        builder.Services.RegisterApplicationServices();
        builder.Services.RegisterInfrastructureServices(builder.Configuration);
        RegisterHttpSecurity(builder.Services, builder.Configuration, builder.Environment);
        RegisterMcp(builder.Services, builder.Configuration);

        builder.Services.AddEndpointsApiExplorer();

        builder.Services.AddProblemDetails(ConfigureProblemDetails);

        builder.Services.AddOpenApi();

        var app = builder.Build();
        await using var scope = app.Services.CreateAsyncScope();

        // Apply migrations
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        if (dbContext.Database.IsRelational())
        {
            await dbContext.Database.MigrateAsync();
        }

        // Add admin Role
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<Role>>();
        if (!await roleManager.RoleExistsAsync(UserRoles.Admin))
        {
            (await roleManager.CreateAsync(
                new()
                {
                    Name = UserRoles.Admin,
                })).EnsureSucceeded();
            await dbContext.SaveChangesAsync();
        }

        if (recovery)
        {
            await AdministratorRecovery.Run(args[1], scope.ServiceProvider.GetRequiredService<PasswordCommands>());
            return;
        }

        app.UseDefaultFiles();
        app.UseStaticFiles(
            new StaticFileOptions
            {
                OnPrepareResponse = context =>
                {
                    // Do not cache index.html file
                    if (context.File.Name == "index.html")
                    {
                        context.Context.Response.Headers[HeaderNames.CacheControl] = "no-store";
                    }
                },
            });

        // Initialize OpenAPI
        app.MapOpenApi("/api/openapi/{documentName}.json");
        app.MapScalarApiReference(
            "/api/scalar",
            options => options
                .WithOpenApiRoutePattern("/api/openapi/{documentName}.json"));

        app.UseProblemDetails();
        app.UseAuthentication();
        app.UseAuthorization();

        app.MapControllers().RequireAuthorization();

        if (builder.Configuration.GetValue<bool>($"{MealManagerMcpOptions.SectionName}:Enabled"))
        {
            app.MapMcp("/mcp").RequireAuthorization(MealManagerMcpOptions.AuthorizationPolicy);
        }

        // Configure SPA fallback
        app.UseWhen(
            context => !context.Request.Path.StartsWithSegments("/api") &&
                !context.Request.Path.StartsWithSegments("/mcp"),
            then => then.UseSpa(spa =>
            {
                // Proxy to the frontend development server
                if (Environment.GetEnvironmentVariable("PROXY_FRONTEND") == "1")
                {
                    spa.UseProxyToSpaDevelopmentServer("http://localhost:4200");
                }

                // Do not cache the default page
                spa.Options.DefaultPageStaticFileOptions = new()
                {
                    OnPrepareResponse = context =>
                    {
                        context.Context.Response.Headers[HeaderNames.CacheControl] = "no-store";
                    },
                };
            }));

        await app.RunAsync();
    }

    private static void ConfigureJsonOptions(JsonOptions options)
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        options.JsonSerializerOptions.DictionaryKeyPolicy = JsonNamingPolicy.CamelCase;
    }

    private static void RegisterMcp(IServiceCollection services, IConfiguration configuration)
    {
        if (configuration.GetValue<bool>($"{MealManagerMcpOptions.SectionName}:Enabled"))
        {
            var accessToken = configuration[$"{MealManagerMcpOptions.SectionName}:AccessToken"];
            if (string.IsNullOrWhiteSpace(accessToken) || accessToken.Length < 32)
            {
                throw new InvalidOperationException(
                    "Mcp:AccessToken must contain at least 32 characters when MCP is enabled.");
            }
        }

        var serializerOptions = new JsonSerializerOptions(JsonSerializerDefaults.Web)
        {
            TypeInfoResolver = new DefaultJsonTypeInfoResolver(),
        };
        serializerOptions.Converters.Add(new JsonStringEnumConverter());

        services
            .AddMcpServer(options =>
            {
                options.ServerInfo = new McpImplementation
                {
                    Name = "mealmanager",
                    Version = "1.0.0",
                };
                options.ServerInstructions = MealManagerMcpInstructions.Text;
            })
            .WithHttpTransport()
            .WithTools<MealManagerMcpTools>(serializerOptions);

        services
            .AddAuthentication()
            .AddScheme<AuthenticationSchemeOptions, McpTokenAuthenticationHandler>(
                MealManagerMcpOptions.AuthenticationScheme,
                _ => { });
        services.AddAuthorization(options => options.AddPolicy(
            MealManagerMcpOptions.AuthorizationPolicy,
            policy => policy
                .AddAuthenticationSchemes(MealManagerMcpOptions.AuthenticationScheme)
                .RequireAuthenticatedUser()));
    }

    private static void RegisterHttpSecurity(
        IServiceCollection services,
        IConfiguration configuration,
        IHostEnvironment environment)
    {
        var allowInsecureHttp = environment.IsDevelopment() ||
            configuration.GetValue<bool>("Authentication:AllowInsecureHttp");
        var securePolicy = allowInsecureHttp
            ? CookieSecurePolicy.SameAsRequest
            : CookieSecurePolicy.Always;

        services.ConfigureApplicationCookie(options =>
        {
            options.Cookie.Name = ".MealManager.Authentication";
            options.Cookie.HttpOnly = true;
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = securePolicy;
            options.ExpireTimeSpan = TimeSpan.FromDays(14);
            options.SlidingExpiration = true;
        });

        services.AddAntiforgery(options =>
        {
            options.Cookie.Name = ".MealManager.Antiforgery";
            options.Cookie.SameSite = SameSiteMode.Strict;
            options.Cookie.SecurePolicy = securePolicy;
            options.HeaderName = "X-XSRF-TOKEN";
        });
    }

    private static void ConfigureProblemDetails(ProblemDetailsOptions options)
    {
        options.OnBeforeWriteDetails = BeforeWriteDetails;

        options.MapToStatusCode<NotFoundError>(StatusCodes.Status404NotFound);
        options.MapToStatusCode<ValidationException>(StatusCodes.Status400BadRequest);
        options.MapToStatusCode<BaseError>(StatusCodes.Status400BadRequest);
        options.MapToStatusCode<Exception>(StatusCodes.Status500InternalServerError);
    }

    private static void BeforeWriteDetails(HttpContext context, ProblemDetails problemDetails)
    {
        var exceptionFeature = context.Features.Get<IExceptionHandlerPathFeature>();
        if (exceptionFeature?.Error is BaseError error)
        {
            problemDetails.Detail = error.Message;
            problemDetails.Extensions["code"] = error.ErrorCode;
            problemDetails.Extensions["properties"] = error.GetDetails();
        }
        else if (exceptionFeature?.Error is ValidationException validationException)
        {
            problemDetails.Extensions["code"] = ErrorCodes.ValidationError;
            problemDetails.Extensions["errors"] = validationException.Errors
                .GroupBy(e => e.PropertyName)
                .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).ToArray());
        }
    }
}
