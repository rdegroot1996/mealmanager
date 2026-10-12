using Microsoft.AspNetCore.Http;
using System.Security.Claims;

namespace MealManager.Infrastructure.Authentication;

public class AuthenticationService(IHttpContextAccessor httpContextAccessor)
{
    public Guid GetUserUuid()
    {
        var user = httpContextAccessor.HttpContext!.User;
        var userId = user.FindFirstValue(ClaimTypes.NameIdentifier)!;
        return Guid.Parse(userId);
    }
}
