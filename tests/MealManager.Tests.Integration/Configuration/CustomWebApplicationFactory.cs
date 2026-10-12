using MealManager.Api;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using MealManager.Infrastructure.Identity;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace MealManager.Tests.Integration.Configuration;

public class CustomWebApplicationFactory : WebApplicationFactory<Program>
{
    public const string McpAccessToken = "integration-test-mcp-access-token-1234567890";
    private readonly string databasePath = Path.Combine(Path.GetTempPath(), $"mealmanager-tests-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Production");
        builder.UseSetting("Authentication:AllowInsecureHttp", "true");
        builder.UseSetting("Mcp:Enabled", "true");
        builder.UseSetting("Mcp:AccessToken", McpAccessToken);
        builder.UseSetting("Supermarkets:Picnic:UseMock", "true");

        builder.ConfigureLogging(logging =>
        {
            // The default Windows EventLog provider requires elevated permissions
            // and makes the test host fail before the first request is executed.
            logging.ClearProviders();
        });

        builder.ConfigureServices(services =>
        {
            services.AddDataProtection().UseEphemeralDataProtectionProvider();
            AddTestDbContext(services);
        });
    }

    public async Task Reset()
    {
        Services.GetRequiredService<MealManager.Infrastructure.Supermarkets.PicnicMockHandler>().Reset();
        // Reset database
        using var scope = Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await dbContext.Database.EnsureDeletedAsync();
        await dbContext.Database.MigrateAsync();

        // TODO: Move this to generic seeding method?
        // Ensure the database is seeded with an admin user
        var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<Role>>();
        await roleManager.CreateAsync(
            new()
            {
                Name = UserRoles.Admin,
            });
        await dbContext.SaveChangesAsync();

        // Clear in-memory cache
        var memoryCache = (MemoryCache)scope.ServiceProvider.GetRequiredService<IMemoryCache>();
        memoryCache.Clear();
    }

    private void AddTestDbContext(IServiceCollection services)
    {
        // Remove the existing context configuration
        var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<ApplicationDbContext>));
        if (descriptor != null)
        {
            services.Remove(descriptor);
        }

        // Each scope owns its connection, as in production. Sharing one in-memory
        // connection makes concurrent API requests race inside the SQLite driver.
        services.AddDbContext<ApplicationDbContext>(options =>
        {
            options.UseSqlite($"Data Source={databasePath};Pooling=False");
        });
    }

    protected override void Dispose(bool disposing)
    {
        base.Dispose(disposing);
        if (!disposing) return;
        foreach (var suffix in new[] { "", "-wal", "-shm" }) File.Delete(databasePath + suffix);
    }
}
