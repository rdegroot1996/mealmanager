using MealManager.Domain.Entities;
using MealManager.Infrastructure.Authentication;
using MealManager.Infrastructure.Database;
using MealManager.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Queries;

public class UserQueries(
    ApplicationDbContext dbContext,
    AuthenticationService authenticationService,
    UserManager<User> userManager)
{
    public async Task<IReadOnlyCollection<UserDto>> GetUsers()
    {
        return await dbContext.Users
            .Select(u => new UserDto
            {
                Id = u.Id,
                Email = u.UserName!,
                DisplayName = u.DisplayName,
                MustChangePassword = u.MustChangePassword,
                IsAdmin = dbContext.UserRoles
                    .Any(ur => ur.UserId == u.Id && dbContext.Roles
                        .Any(r => r.Id == ur.RoleId && r.Name == UserRoles.Admin)),
            })
            .ToListAsync();
    }

    public async Task<UserDto> GetUserInfo()
    {
        var userId = authenticationService.GetUserUuid();
        var user = (await userManager.FindByIdAsync(userId.ToString()))!;
        var isAdmin = await userManager.IsInRoleAsync(user, UserRoles.Admin);

        return new()
        {
            Id = user.Id,
            Email = user.Email!,
            DisplayName = user.DisplayName,
            MustChangePassword = user.MustChangePassword,
            IsAdmin = isAdmin,
        };
    }
}
