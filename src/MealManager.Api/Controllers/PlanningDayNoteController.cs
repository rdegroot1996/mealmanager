namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/planning-day-notes")]
public class PlanningDayNoteController : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<PlanningDayNoteDto>> AddPlanningDayNote(
        [FromServices] PlanningDayNoteCommands commands,
        [FromBody] AddPlanningDayNoteDto command) =>
        StatusCode(StatusCodes.Status201Created, await commands.AddPlanningDayNote(command));

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<PlanningDayNoteDto>> UpdatePlanningDayNote(
        [FromServices] PlanningDayNoteCommands commands,
        [FromRoute] Guid id,
        [FromBody] UpdatePlanningDayNoteDto command) =>
        Ok(await commands.UpdatePlanningDayNote(id, command));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePlanningDayNote(
        [FromServices] PlanningDayNoteCommands commands,
        [FromRoute] Guid id)
    {
        await commands.DeletePlanningDayNote(id);
        return NoContent();
    }
}
