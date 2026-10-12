using MealManager.Domain.Entities;
using MealManager.Infrastructure.Authentication;
using MealManager.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;

namespace MealManager.Application.Commands;

public class UserCommands(UserManager<User> userManager, AuthenticationService authenticationService)
{
    public async Task<UserDto> CreateUser(CreateUserDto command)
    {
        var user = new User
        {
            Id = Guid.CreateVersion7(),
            UserName = command.Email,
            Email = command.Email,
            DisplayName = command.DisplayName,
            EmailConfirmed = true,
        };
        (await userManager.CreateAsync(user, command.Password)).EnsureSucceeded();
        if (command.IsAdmin)
        {
            (await userManager.AddToRoleAsync(user, UserRoles.Admin)).EnsureSucceeded();
        }

        return new()
        {
            Id = user.Id,
            Email = user.Email!,
            DisplayName = user.DisplayName,
            IsAdmin = command.IsAdmin,
        };
    }

    public async Task<UserDto> UpdateUserProfile(UpdateUserProfileDto command)
    {
        // Retrieve current user
        var userId = authenticationService.GetUserUuid();
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundError(nameof(User));
        }

        // Update display name
        user.DisplayName = command.DisplayName;
        (await userManager.UpdateAsync(user)).EnsureSucceeded();

        return new()
        {
            Id = user.Id,
            Email = user.Email!,
            DisplayName = user.DisplayName,
            IsAdmin = await userManager.IsInRoleAsync(user, UserRoles.Admin),
        };
    }

    public async Task<UserDto> UpdateUser(Guid userId, UpdateUserDto command)
    {
        // Retrieve user
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundError(nameof(User));
        }

        // Prevent self-removal of admin role
        if (userId == authenticationService.GetUserUuid() && !command.IsAdmin)
        {
            throw new InvalidOperationError(
                ErrorCodes.CannotRemoveOwnAdminRole,
                "Cannot remove admin role from yourself.");
        }

        user.DisplayName = command.DisplayName;

        // Update admin role
        var isAdmin = await userManager.IsInRoleAsync(user, UserRoles.Admin);
        if (isAdmin && !command.IsAdmin)
        {
            (await userManager.RemoveFromRoleAsync(user, UserRoles.Admin)).EnsureSucceeded();
        }
        else if (!isAdmin && command.IsAdmin)
        {
            (await userManager.AddToRoleAsync(user, UserRoles.Admin)).EnsureSucceeded();
        }

        (await userManager.UpdateAsync(user)).EnsureSucceeded();

        return new()
        {
            Id = user.Id,
            Email = user.Email!,
            DisplayName = user.DisplayName,
            IsAdmin = command.IsAdmin,
        };
    }

    public async Task DeleteUser(Guid userId)
    {
        // Prevent self-deletion
        if (userId == authenticationService.GetUserUuid())
        {
            throw new InvalidOperationError(
                ErrorCodes.CannotDeleteSelf,
                "Cannot delete yourself.");
        }

        // Retrieve user
        var user = await userManager.FindByIdAsync(userId.ToString());
        if (user == null)
        {
            throw new NotFoundError(nameof(User));
        }

        // Delete user
        (await userManager.DeleteAsync(user)).EnsureSucceeded();
    }
}
