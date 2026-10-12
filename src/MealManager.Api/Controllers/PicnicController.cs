using System.Security.Claims;
using MealManager.Infrastructure.Identity;
using Microsoft.AspNetCore.Authorization;

namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/integrations/picnic")]
[Authorize(Roles = UserRoles.Admin)]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class PicnicController : ControllerBase
{
    [HttpGet("connection")]
    public Task<PicnicConnectionDto> Connection([FromServices] PicnicConnectionQueries queries, CancellationToken ct) => queries.Get(ct);

    [HttpPost("connect")]
    public Task<PicnicConnectionDto> Connect(ConnectPicnicDto command, [FromServices] PicnicConnectionCommands commands, CancellationToken ct) =>
        commands.Connect(Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), command, ct);

    [HttpPost("verification-code")]
    public Task<PicnicConnectionDto> RequestCode([FromServices] PicnicConnectionCommands commands, CancellationToken ct) =>
        commands.RequestCode(Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), ct);

    [HttpPost("verify")]
    public Task<PicnicConnectionDto> Verify(VerifyPicnicDto command, [FromServices] PicnicConnectionCommands commands, CancellationToken ct) =>
        commands.Verify(Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!), command, ct);

    [HttpDelete("connection")]
    public async Task<IActionResult> Disconnect([FromServices] PicnicConnectionCommands commands, CancellationToken ct) { await commands.Disconnect(ct); return NoContent(); }
}
