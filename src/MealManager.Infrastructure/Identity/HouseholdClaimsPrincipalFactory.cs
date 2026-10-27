using System.Security.Claims;
using MealManager.Domain.Entities;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace MealManager.Infrastructure.Identity;

public class HouseholdClaimsPrincipalFactory(
    UserManager<User> userManager,
    RoleManager<Role> roleManager,
    IOptions<IdentityOptions> options) : UserClaimsPrincipalFactory<User, Role>(userManager, roleManager, options)
{
    public const string PasswordChangeRequiredClaim = "mealmanager:password-change-required";

    protected override async Task<ClaimsIdentity> GenerateClaimsAsync(User user)
    {
        var identity = await base.GenerateClaimsAsync(user);
        if (user.MustChangePassword) identity.AddClaim(new Claim(PasswordChangeRequiredClaim, "true"));
        return identity;
    }
}
