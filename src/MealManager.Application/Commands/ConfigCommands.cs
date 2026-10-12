using MealManager.Domain.Entities;
using MealManager.Infrastructure.Configuration;
using MealManager.Infrastructure.Database;
using MealManager.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using AppConfig = MealManager.Infrastructure.Configuration.AppConfig;

namespace MealManager.Application.Commands;

public class ConfigCommands(
    UserManager<User> userManager,
    ConfigurationService configurationService,
    ApplicationDbContext dbContext)
{
    public async Task InitializeConfig(InitializeConfigDto command)
    {
        await using var transaction = await dbContext.Database.BeginTransactionAsync();

        // Check the authoritative setting after acquiring the transaction.
        var appInitialized = await configurationService.GetSetting(AppConfig.AppInitialized);
        if (appInitialized)
        {
            throw new InvalidOperationError(
                ErrorCodes.ApplicationAlreadyInitialized,
                "Application is already initialized.");
        }

        // Create admin user
        var user = new User
        {
            Id = Guid.CreateVersion7(),
            UserName = command.AdminEmail,
            Email = command.AdminEmail,
            DisplayName = command.AdminDisplayName,
            EmailConfirmed = true,
        };
        (await userManager.CreateAsync(user, command.AdminPassword)).EnsureSucceeded();
        (await userManager.AddToRoleAsync(user, UserRoles.Admin)).EnsureSucceeded();

        // Store initialization state only. Subsequent users are created by an administrator.
        await configurationService.SetSetting(AppConfig.AppInitialized, true);
        await transaction.CommitAsync();
    }
}
