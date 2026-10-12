namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/planning-meals")]
public class PlanningMealController : ControllerBase
{
    [HttpGet("{id:guid}/groceries")]
    public async Task<PlanningMealGroceriesDto> GetPlanningMealGroceries(
        [FromServices] GroceryListQueries queries,
        [FromRoute] Guid id) =>
        await queries.GetPlanningMealGroceries(id);

    [HttpPost]
    public async Task<ActionResult<PlanningEntryDto>> AddPlanningMeal(
        [FromServices] PlanningMealCommands commands,
        [FromBody] AddPlanningMealDto command) =>
        StatusCode(StatusCodes.Status201Created, await commands.AddPlanningMeal(command));

    [HttpPost("{id:guid}/leftovers")]
    public async Task<ActionResult<PlanningEntryDto>> PlanLeftovers(
        [FromServices] PlanningMealCommands commands,
        [FromBody] PlanLeftoversDto command,
        [FromRoute] Guid id) =>
        StatusCode(StatusCodes.Status201Created, await commands.PlanLeftovers(id, command));

    [HttpPost("{id:guid}/move")]
    public async Task<ActionResult<PlanningEntryDto>> MovePlanningEntry(
        [FromServices] PlanningMealCommands commands,
        [FromBody] MovePlanningEntryDto command,
        [FromRoute] Guid id) =>
        Ok(await commands.MovePlanningEntry(id, command));

    [HttpPost("{id:guid}/groceries")]
    public async Task<ActionResult<PlanningMealGroceriesDto>> AddMealGroceries(
        [FromServices] PlanningMealCommands commands,
        [FromBody] AddMealGroceriesDto command,
        [FromRoute] Guid id) =>
        StatusCode(StatusCodes.Status201Created, await commands.AddMealGroceries(id, command));

    [HttpPost("{id:guid}/groceries/items")]
    public async Task<ActionResult<GroceryItemDto>> AddMealGroceryItem(
        [FromServices] GroceryListCommands commands,
        [FromRoute] Guid id,
        [FromBody] AddManualGroceryItemDto command)
    {
        var item = await commands.AddMealGroceryItem(id, command);
        return Created($"/api/grocery-lists/{item.Id}", item);
    }

    [HttpPut("{id:guid}/profile/{profileId:guid}")]
    public async Task<ActionResult<PlanningEntryDto>> UpdatePlanningMealProfile(
        [FromServices] PlanningMealCommands commands,
        [FromRoute] Guid id,
        [FromRoute] Guid profileId) =>
        Ok(await commands.UpdatePlanningMealProfile(id, profileId));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePlanningMeal(
        [FromServices] PlanningMealCommands commands,
        [FromRoute] Guid id)
    {
        await commands.DeletePlanningMeal(id);
        return NoContent();
    }
}
