namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/planning-cycles")]
public class PlanningCycleController : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<PlanningCycleDto>> CreatePlanningCycle(
        [FromBody] CreatePlanningCycleDto command,
        [FromServices] PlanningCycleCommands commands)
    {
        var cycle = await commands.CreatePlanningCycle(command);
        return CreatedAtAction(nameof(GetPlanningCycle), new { id = cycle.Id }, cycle);
    }

    [HttpGet("{id:guid}")]
    public async Task<PlanningCycleDto> GetPlanningCycle(
        [FromServices] PlanningCycleQueries queries,
        [FromRoute] Guid id) =>
        await queries.GetPlanningCycle(id);

    [HttpGet("current")]
    public async Task<PlanningCycleDto> GetCurrentPlanningCycle([FromServices] PlanningCycleQueries queries) =>
        await queries.GetCurrentPlanningCycle();

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PlanningCycleDto>> UpdatePlanningCycle(
        [FromBody] UpdatePlanningCycleDto command,
        [FromServices] PlanningCycleCommands commands,
        [FromRoute] Guid id) =>
        Ok(await commands.UpdatePlanningCycle(id, command));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePlanningCycle(
        [FromServices] PlanningCycleCommands commands,
        [FromRoute] Guid id)
    {
        await commands.DeletePlanningCycle(id);
        return NoContent();
    }
}
