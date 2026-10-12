using MealManager.Domain.Entities;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;

namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/authentication")]
public class AuthenticationController : ControllerBase
{
    [AllowAnonymous]
    [IgnoreAntiforgeryToken]
    [HttpGet("session")]
    public ActionResult<AuthenticationSessionDto> GetSession(
        [FromServices] IAntiforgery antiforgery,
        [FromServices] IOptions<AntiforgeryOptions> antiforgeryOptions)
    {
        var tokens = antiforgery.GetAndStoreTokens(HttpContext);
        Response.Headers.CacheControl = "no-store";
        var cookieOptions = antiforgeryOptions.Value.Cookie.Build(HttpContext);
        cookieOptions.HttpOnly = false;
        cookieOptions.IsEssential = true;
        Response.Cookies.Append(
            "XSRF-TOKEN",
            tokens.RequestToken!,
            cookieOptions);

        return Ok(
            new AuthenticationSessionDto
            {
                IsAuthenticated = User.Identity?.IsAuthenticated is true,
                AntiforgeryToken = tokens.RequestToken!,
            });
    }

    [AllowAnonymous]
    [HttpPost("login")]
    public async Task<IActionResult> Login(
        [FromBody] LoginDto command,
        [FromServices] SignInManager<User> signInManager)
    {
        var result = await signInManager.PasswordSignInAsync(
            command.Email,
            command.Password,
            isPersistent: true,
            lockoutOnFailure: true);

        return result.Succeeded
            ? NoContent()
            : Problem(statusCode: StatusCodes.Status401Unauthorized);
    }

    [HttpPost("logout")]
    public async Task<IActionResult> Logout([FromServices] SignInManager<User> signInManager)
    {
        await signInManager.SignOutAsync();
        return NoContent();
    }
}
