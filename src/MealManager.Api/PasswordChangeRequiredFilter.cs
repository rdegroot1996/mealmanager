using MealManager.Common.Errors;
using MealManager.Infrastructure.Identity;
using Microsoft.AspNetCore.Mvc.Filters;

namespace MealManager.Api;

public class PasswordChangeRequiredFilter : IActionFilter
{
    private static readonly HashSet<string> AllowedPaths = new(StringComparer.OrdinalIgnoreCase)
    {
        "/api/authentication/session",
        "/api/authentication/change-password",
        "/api/authentication/logout",
        "/api/users/me",
    };

    public void OnActionExecuting(ActionExecutingContext context)
    {
        if (!context.HttpContext.User.HasClaim(HouseholdClaimsPrincipalFactory.PasswordChangeRequiredClaim, "true")) return;
        var request = context.HttpContext.Request;
        var path = request.Path.Value?.TrimEnd('/') ?? "";
        var readsOwnAccount = path.Equals("/api/users/me", StringComparison.OrdinalIgnoreCase);
        if (AllowedPaths.Contains(path) && (!readsOwnAccount || HttpMethods.IsGet(request.Method))) return;
        context.Result = new ObjectResult(new ProblemDetails
        {
            Status = StatusCodes.Status403Forbidden,
            Title = "Replace your temporary password before continuing.",
            Extensions = { ["code"] = ErrorCodes.PasswordChangeRequired },
        })
        { StatusCode = StatusCodes.Status403Forbidden };
    }

    public void OnActionExecuted(ActionExecutedContext context) { }
}
