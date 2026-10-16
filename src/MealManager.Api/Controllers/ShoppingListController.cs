namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/shopping-lists")]
public class ShoppingListController : ControllerBase
{
    [HttpGet("suggestions")]
    public Task<string[]> SuggestNames([FromServices] ShoppingListQueries queries,
        [FromQuery] string? search, [FromQuery] int limit = 10) => queries.SuggestNames(search, limit);

    [HttpGet("cycle/{cycleId:guid}")]
    public async Task<ShoppingListDto> GetCycleShoppingList(
        [FromServices] ShoppingListQueries queries,
        [FromRoute] Guid cycleId) =>
        await queries.GetCycleShoppingList(cycleId);

    [HttpPost("cycle/{cycleId:guid}/items")]
    public async Task<ActionResult<ShoppingListItemDto>> AddManualShoppingListItem(
        [FromServices] ShoppingListCommands commands,
        [FromRoute] Guid cycleId,
        [FromBody] AddManualShoppingListItemDto command)
    {
        var item = await commands.AddManualShoppingListItem(cycleId, command);
        return Created($"/api/shopping-lists/{item.Id}", item);
    }

    [HttpPut("{itemId:guid}")]
    public async Task<ActionResult<ShoppingListItemDto>> UpdateShoppingListItem(
        [FromServices] ShoppingListCommands commands,
        [FromRoute] Guid itemId,
        [FromBody] UpdateShoppingListItemDto command) =>
        Ok(await commands.UpdateShoppingListItem(itemId, command));

    [HttpDelete("{itemId:guid}")]
    public async Task<IActionResult> RemoveShoppingListItem(
        [FromServices] ShoppingListCommands commands,
        [FromRoute] Guid itemId)
    {
        await commands.RemoveShoppingListItem(itemId);
        return NoContent();
    }

    [HttpPut("{shoppingListId:guid}/items/order")]
    public async Task<ActionResult<ICollection<ShoppingListItemDto>>> UpdateShoppingListItemOrder(
        [FromServices] ShoppingListCommands commands,
        [FromRoute] Guid shoppingListId,
        [FromBody] UpdateShoppingListItemOrderDto command) =>
        Ok(await commands.UpdateShoppingListItemOrder(shoppingListId, command));
}
