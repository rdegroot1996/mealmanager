using MealManager.Domain.Entities;
using MealManager.Infrastructure.Authentication;
using MealManager.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace MealManager.Application.Commands;

public class PasswordCommands(UserManager<User> userManager, AuthenticationService authentication)
{
    public async Task<User> ChangePassword(ChangePasswordDto command)
    {
        var user = await FindUser(authentication.GetUserUuid());
        if (command.NewPassword == command.CurrentPassword)
            throw new ValidationException("Choose a different new password.");
        user.MustChangePassword = false;
        (await userManager.ChangePasswordAsync(user, command.CurrentPassword, command.NewPassword)).EnsureSucceeded();
        return user;
    }

    public async Task ResetPassword(Guid userId, ResetUserPasswordDto command)
    {
        if (userId == authentication.GetUserUuid())
            throw new InvalidOperationError(ErrorCodes.CannotResetOwnPassword, "Use Change password to change your own password.");
        await SetTemporaryPassword(await FindUser(userId), command.TemporaryPassword);
    }

    public async Task RecoverAdministrator(string email, string temporaryPassword)
    {
        var user = await userManager.FindByEmailAsync(email) ?? throw new NotFoundError(nameof(User));
        if (!await userManager.IsInRoleAsync(user, UserRoles.Admin))
            throw new InvalidOperationError(ErrorCodes.InvalidOperation, "Host recovery requires an existing administrator account.");
        await SetTemporaryPassword(user, temporaryPassword);
    }

    private async Task SetTemporaryPassword(User user, string temporaryPassword)
    {
        var token = await userManager.GeneratePasswordResetTokenAsync(user);
        user.MustChangePassword = true;
        user.AccessFailedCount = 0;
        user.LockoutEnd = null;
        // Identity persists the password, security stamp, and recovery state together.
        (await userManager.ResetPasswordAsync(user, token, temporaryPassword)).EnsureSucceeded();
    }

    private async Task<User> FindUser(Guid id) =>
        await userManager.FindByIdAsync(id.ToString()) ?? throw new NotFoundError(nameof(User));
}
