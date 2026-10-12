namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/recipe-profiles")]
public class RecipeProfileController : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<RecipeProfileDto>> AddRecipeProfile(
        [FromBody] AddRecipeProfileDto command,
        [FromServices] RecipeProfileCommands commands)
    {
        var profile = await commands.AddRecipeProfile(command);
        return CreatedAtAction(nameof(GetRecipeProfile), new { id = profile.Id }, profile);
    }

    [HttpGet("{id:guid}")]
    public async Task<RecipeProfileDto> GetRecipeProfile(
        [FromServices] RecipeProfileQueries queries,
        [FromRoute] Guid id) =>
        await queries.GetRecipeProfile(id);

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RecipeProfileDto>> UpdateRecipeProfile(
        [FromServices] RecipeProfileCommands commands,
        [FromRoute] Guid id,
        [FromBody] UpdateRecipeProfileDto command) =>
        Ok(await commands.UpdateRecipeProfile(id, command));

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteRecipeProfile(
        [FromServices] RecipeProfileCommands commands,
        [FromRoute] Guid id)
    {
        await commands.DeleteRecipeProfile(id);
        return NoContent();
    }
}
