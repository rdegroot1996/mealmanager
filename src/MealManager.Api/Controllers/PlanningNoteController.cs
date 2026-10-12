namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/planning-notes")]
public class PlanningNoteController : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<PlanningNoteDto>> AddPlanningNote(
        [FromServices] PlanningNoteCommands commands,
        [FromBody] AddPlanningNoteDto command) =>
        StatusCode(StatusCodes.Status201Created, await commands.AddPlanningNote(command));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PlanningNoteDto>> UpdatePlanningNote(
        [FromServices] PlanningNoteCommands commands,
        [FromRoute] Guid id,
        [FromBody] UpdatePlanningNoteDto command) =>
        Ok(await commands.UpdatePlanningNote(id, command));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePlanningNote(
        [FromServices] PlanningNoteCommands commands,
        [FromRoute] Guid id)
    {
        await commands.DeletePlanningNote(id);
        return NoContent();
    }
}
