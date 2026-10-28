using MealManager.Domain.Entities;
using MealManager.Infrastructure.Authentication;
using MealManager.Infrastructure.Identity;
using MealManager.Infrastructure.Configuration;
using MealManager.Infrastructure.Database;
using MealManager.Infrastructure.Storage;
using MealManager.Domain.Contracts;
using MealManager.Infrastructure.Supermarkets;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace MealManager.Infrastructure;

public static class InfrastructureServiceExtensions
{
    public static IServiceCollection RegisterInfrastructureServices(
        this IServiceCollection services,
        IConfiguration configuration)
    {
        var dataRoot = configuration["Storage:DataRoot"] ?? Path.Combine(AppContext.BaseDirectory, "data");
        Directory.CreateDirectory(dataRoot);
        var dataProtectionRoot = Path.Combine(dataRoot, "data-protection-keys");
        Directory.CreateDirectory(dataProtectionRoot);

        // Add services to the container.
        services
            .AddDbContext<ApplicationDbContext>(options => options
                .UseSqlite($"Data Source={Path.Combine(dataRoot, "meal-manager.db")};Cache=Shared"));

        services
            .AddIdentity<User, Role>(options =>
            {
                options.User.RequireUniqueEmail = true;
                options.Lockout.AllowedForNewUsers = true;
                options.Lockout.MaxFailedAccessAttempts = 5;
                options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(5);
            })
            .AddRoles<Role>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddClaimsPrincipalFactory<HouseholdClaimsPrincipalFactory>()
            .AddDefaultTokenProviders();

        services.Configure<SecurityStampValidatorOptions>(options => options.ValidationInterval = TimeSpan.Zero);

        services
            .AddDataProtection()
            .PersistKeysToFileSystem(new DirectoryInfo(dataProtectionRoot));

        services
            .AddHttpContextAccessor()
            .AddMemoryCache()
            .AddSingleton<IImageStorage, LocalImageStorage>()
            .AddTransient<AuthenticationService>()
            .AddTransient<ConfigurationService>();

        services.AddSingleton<PicnicGate>();
        services.AddTransient<ProviderSettingsStore>();
        services.AddTransient<PicnicSessions>();
        services.AddTransient<ISupermarketProvider, PicnicProvider>();
        services.AddSingleton<PicnicMockHandler>();
        services.AddHttpClient<IPicnicApiClient, PicnicApiClient>(client =>
        {
            client.Timeout = PicnicProtocol.RequestTimeout;
        }).SetHandlerLifetime(Timeout.InfiniteTimeSpan).ConfigurePrimaryHttpMessageHandler(provider =>
            configuration.GetValue<bool>("Supermarkets:Picnic:UseMock")
                ? provider.GetRequiredService<PicnicMockHandler>()
                : new HttpClientHandler());

        return services;
    }
}
