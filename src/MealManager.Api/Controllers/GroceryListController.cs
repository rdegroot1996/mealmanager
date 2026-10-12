namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/grocery-lists")]
public class GroceryListController : ControllerBase
{
    [HttpGet("suggestions")]
    public Task<string[]> SuggestNames([FromServices] GroceryListQueries queries,
        [FromQuery] string? search, [FromQuery] int limit = 10) => queries.SuggestNames(search, limit);

    [HttpGet("cycle/{cycleId:guid}")]
    public async Task<GroceryListDto> GetCycleGroceryList(
        [FromServices] GroceryListQueries queries,
        [FromRoute] Guid cycleId) =>
        await queries.GetCycleGroceryList(cycleId);

    [HttpPost("cycle/{cycleId:guid}/items")]
    public async Task<ActionResult<GroceryItemDto>> AddManualGroceryItem(
        [FromServices] GroceryListCommands commands,
        [FromRoute] Guid cycleId,
        [FromBody] AddManualGroceryItemDto command)
    {
        var item = await commands.AddManualGroceryItem(cycleId, command);
        return Created($"/api/grocery-lists/{item.Id}", item);
    }

    [HttpPut("{itemId:guid}")]
    public async Task<ActionResult<GroceryItemDto>> UpdateGroceryItem(
        [FromServices] GroceryListCommands commands,
        [FromRoute] Guid itemId,
        [FromBody] UpdateGroceryItemDto command) =>
        Ok(await commands.UpdateGroceryItem(itemId, command));

    [HttpDelete("{itemId:guid}")]
    public async Task<IActionResult> RemoveGroceryItem(
        [FromServices] GroceryListCommands commands,
        [FromRoute] Guid itemId)
    {
        await commands.RemoveGroceryItem(itemId);
        return NoContent();
    }

    [HttpPut("{groceryListId:guid}/items/order")]
    public async Task<ActionResult<ICollection<GroceryItemDto>>> UpdateGroceryItemOrder(
        [FromServices] GroceryListCommands commands,
        [FromRoute] Guid groceryListId,
        [FromBody] UpdateGroceryItemOrderDto command) =>
        Ok(await commands.UpdateGroceryItemOrder(groceryListId, command));
}
