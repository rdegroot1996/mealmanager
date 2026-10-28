using MealManager.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;

namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/users")]
public class UserController : ControllerBase
{
    [HttpGet("me")]
    public async Task<UserDto> GetUserInfo([FromServices] UserQueries queries) => await queries.GetUserInfo();

    [HttpGet]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IReadOnlyCollection<UserDto>> GetUsers([FromServices] UserQueries queries) => await queries.GetUsers();

    [HttpPost]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<ActionResult<UserDto>> CreateUser([FromBody] CreateUserDto command, [FromServices] UserCommands commands)
    {
        var user = await commands.CreateUser(command);
        return Created("/api/users", user);
    }

    [HttpPut("me")]
    public async Task<ActionResult<UserDto>> UpdateUserProfile(
        [FromBody] UpdateUserProfileDto command,
        [FromServices] UserCommands commands) =>
        Ok(await commands.UpdateUserProfile(command));

    [HttpPut("{userId:guid}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<ActionResult<UserDto>> UpdateUser(
        [FromRoute] Guid userId,
        [FromBody] UpdateUserDto command,
        [FromServices] UserCommands commands) =>
        Ok(await commands.UpdateUser(userId, command));

    [HttpDelete("{userId:guid}")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> DeleteUser([FromRoute] Guid userId, [FromServices] UserCommands commands)
    {
        await commands.DeleteUser(userId);
        return NoContent();
    }

    [HttpPost("{userId:guid}/reset-password")]
    [Authorize(Roles = UserRoles.Admin)]
    public async Task<IActionResult> ResetPassword(Guid userId, [FromBody] ResetUserPasswordDto command, [FromServices] PasswordCommands commands)
    {
        await commands.ResetPassword(userId, command);
        return NoContent();
    }
}
