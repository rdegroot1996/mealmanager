namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/planned-meals")]
public class PlannedMealController : ControllerBase
{
    [HttpGet("{id:guid}/groceries")]
    public async Task<MealShoppingGroupDto> GetMealShoppingGroup(
        [FromServices] ShoppingListQueries queries,
        [FromRoute] Guid id) =>
        await queries.GetMealShoppingGroup(id);

    [HttpPost]
    public async Task<ActionResult<PlannedEntryDto>> AddPlannedMeal(
        [FromServices] PlannedMealCommands commands,
        [FromBody] AddPlannedMealDto command) =>
        StatusCode(StatusCodes.Status201Created, await commands.AddPlannedMeal(command));

    [HttpPost("{id:guid}/leftovers")]
    public async Task<ActionResult<PlannedEntryDto>> PlanLeftovers(
        [FromServices] PlannedMealCommands commands,
        [FromBody] PlanLeftoversDto command,
        [FromRoute] Guid id) =>
        StatusCode(StatusCodes.Status201Created, await commands.PlanLeftovers(id, command));

    [HttpPost("{id:guid}/move")]
    public async Task<ActionResult<PlannedEntryDto>> MovePlannedEntry(
        [FromServices] PlannedMealCommands commands,
        [FromBody] MovePlannedEntryDto command,
        [FromRoute] Guid id) =>
        Ok(await commands.MovePlannedEntry(id, command));

    [HttpPost("{id:guid}/groceries")]
    public async Task<ActionResult<MealShoppingGroupDto>> ReviewMealGroceries(
        [FromServices] PlannedMealCommands commands,
        [FromBody] ReviewMealGroceriesDto command,
        [FromRoute] Guid id) =>
        StatusCode(StatusCodes.Status201Created, await commands.ReviewMealGroceries(id, command));

    [HttpPost("{id:guid}/groceries/items")]
    public async Task<ActionResult<ShoppingListItemDto>> AddMealShoppingListItem(
        [FromServices] ShoppingListCommands commands,
        [FromRoute] Guid id,
        [FromBody] AddManualShoppingListItemDto command)
    {
        var item = await commands.AddMealShoppingListItem(id, command);
        return Created($"/api/shopping-lists/{item.Id}", item);
    }

    [HttpPut("{id:guid}/profile/{profileId:guid}")]
    public async Task<ActionResult<PlannedEntryDto>> UpdatePlannedMealProfile(
        [FromServices] PlannedMealCommands commands,
        [FromRoute] Guid id,
        [FromRoute] Guid profileId) =>
        Ok(await commands.UpdatePlannedMealProfile(id, profileId));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeletePlannedMeal(
        [FromServices] PlannedMealCommands commands,
        [FromRoute] Guid id)
    {
        await commands.DeletePlannedMeal(id);
        return NoContent();
    }
}
