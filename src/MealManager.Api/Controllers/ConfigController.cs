using Microsoft.AspNetCore.Authorization;

namespace MealManager.Api.Controllers;

[ApiController]
[Route("api")]
public class ConfigController : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("config")]
    public async Task<AppConfigDto> GetConfig([FromServices] ConfigQueries queries) => await queries.GetConfig();

    [AllowAnonymous]
    [HttpPost("config/initialize")]
    public async Task<IActionResult> InitializeConfig(
        [FromBody] InitializeConfigDto command,
        [FromServices] ConfigCommands commands)
    {
        await commands.InitializeConfig(command);
        return NoContent();
    }
}
