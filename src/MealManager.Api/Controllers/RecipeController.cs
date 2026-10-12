using MealManager.Common.Enums;
using MealManager.Common.Errors;
using MealManager.Domain.Contracts;

namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/recipes")]
public class RecipeController : ControllerBase
{
    [HttpPost]
    public async Task<ActionResult<RecipeDto>> CreateRecipe(
        [FromBody] CreateRecipeDto command,
        [FromServices] RecipeCommands commands)
    {
        var recipe = await commands.CreateRecipe(command);
        return CreatedAtAction(nameof(GetRecipe), new { id = recipe.Id }, recipe);
    }

    [HttpGet]
    public async Task<ICollection<RecipeSearchResultDto>> GetRecipes(
        [FromServices] RecipeDiscoveryQueries queries,
        [FromQuery] RecipeCategory? category,
        [FromQuery] string[] tags,
        [FromQuery] string? search,
        [FromQuery] bool? favorite,
        [FromQuery] RecipeSearchSort sort = RecipeSearchSort.Name) =>
        await queries.SearchRecipes(new RecipeSearchOptions
        {
            Category = category,
            Tags = tags,
            Search = search,
            Favorite = favorite,
            Sort = sort,
            Limit = null,
        });

    [HttpGet("tags")]
    public async Task<ICollection<RecipeTagSummaryDto>> GetTags(
        [FromServices] RecipeCatalogQueries queries, [FromQuery] string? search) =>
        await queries.SearchTags(search);

    [HttpPut("{id:guid}/favorite")]
    public async Task<ActionResult<RecipeSummaryDto>> SetFavorite(
        [FromRoute] Guid id,
        [FromBody] SetRecipeFavoriteDto command,
        [FromServices] RecipeCommands commands) =>
        Ok(await commands.SetFavorite(id, command));

    [HttpGet("{id:guid}")]
    public async Task<RecipeDetailsDto> GetRecipe(
        [FromServices] RecipeQueries queries,
        [FromRoute] Guid id) =>
        await queries.GetRecipe(id);

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<RecipeDto>> UpdateRecipe(
        [FromRoute] Guid id,
        [FromBody] UpdateRecipeDto command,
        [FromServices] RecipeCommands commands) =>
        Ok(await commands.UpdateRecipe(id, command));

    [HttpPost("{id:guid}/images")]
    public async Task<ActionResult<RecipeImageDto>> AddRecipeImage(
        [FromRoute] Guid id,
        [FromForm] IFormFile image,
        [FromServices] RecipeImageCommands commands,
        CancellationToken cancellationToken)
    {
        if (image.Length == 0 || image.Length > IImageStorage.MaximumUploadBytes)
        {
            throw new InvalidOperationError(message: "Upload a non-empty image smaller than 10 MB.");
        }

        await using var source = image.OpenReadStream();
        var result = await commands.AddRecipeImage(id, source, cancellationToken);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpGet("{recipeId:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> GetRecipeImage(
        [FromRoute] Guid recipeId,
        [FromRoute] Guid imageId,
        [FromServices] RecipeImageQueries queries,
        CancellationToken cancellationToken)
    {
        var image = await queries.GetRecipeImage(recipeId, imageId, cancellationToken);
        return File(image.Stream, image.ContentType);
    }

    [HttpPut("{id:guid}/images/order")]
    public async Task<ActionResult<ICollection<RecipeImageDto>>> UpdateRecipeImageOrder(
        [FromRoute] Guid id,
        [FromBody] UpdateRecipeImageOrderDto command,
        [FromServices] RecipeImageCommands commands,
        CancellationToken cancellationToken) =>
        Ok(await commands.UpdateRecipeImageOrder(id, command, cancellationToken));

    [HttpDelete("{recipeId:guid}/images/{imageId:guid}")]
    public async Task<IActionResult> DeleteRecipeImage(
        [FromRoute] Guid recipeId,
        [FromRoute] Guid imageId,
        [FromServices] RecipeImageCommands commands,
        CancellationToken cancellationToken)
    {
        await commands.DeleteRecipeImage(recipeId, imageId, cancellationToken);
        return NoContent();
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteRecipe(
        [FromRoute] Guid id,
        [FromServices] RecipeCommands commands)
    {
        await commands.DeleteRecipe(id);
        return NoContent();
    }
}
