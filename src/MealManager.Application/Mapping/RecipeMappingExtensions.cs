using MealManager.Domain.Entities;

namespace MealManager.Application.Mapping;

public static class RecipeMappingExtensions
{
    public static ICollection<RecipeSummaryDto> ToSummaryDtos(this IEnumerable<Recipe> recipes) =>
        recipes.Select(r => r.ToSummaryDto()).ToArray();

    public static RecipeSummaryDto ToSummaryDto(this Recipe recipe) =>
        new()
        {
            Id = recipe.Id,
            Name = recipe.Name,
            Category = recipe.Category,
            IsFavorite = recipe.IsFavorite,
            Tags = recipe.Tags.Select(t => new RecipeTagDto
            {
                Id = t.Id,
                Name = t.Name,
            })
                .ToList(),
            ImageUrl = recipe.Images
                .OrderBy(i => i.Order)
                .FirstOrDefault()
                .ToImageUrl(),
        };

    public static RecipeDto ToDto(this Recipe recipe) =>
        new()
        {
            Id = recipe.Id,
            Name = recipe.Name,
            Notes = recipe.Notes,
            Category = recipe.Category,
            BaseServings = recipe.BaseServings,
            IsFavorite = recipe.IsFavorite,
            Tags = recipe.Tags.ToDtos(),
            Images = recipe.Images.ToDtos(),
            Ingredients = recipe.Ingredients.ToDtos(),
            Steps = recipe.Steps.ToDtos(),
            Profiles = recipe.Profiles.ToSummaryDtos(),
        };

    public static RecipeDetailsDto ToDetailsDto(
        this Recipe recipe,
        int timesPlanned,
        DateOnly? lastPlanned,
        int upcomingTimesPlanned) =>
        new()
        {
            Id = recipe.Id,
            Name = recipe.Name,
            Notes = recipe.Notes,
            Category = recipe.Category,
            BaseServings = recipe.BaseServings,
            IsFavorite = recipe.IsFavorite,
            Tags = recipe.Tags.ToDtos(),
            Images = recipe.Images.ToDtos(),
            Ingredients = recipe.Ingredients.ToDtos(),
            Steps = recipe.Steps.ToDtos(),
            Profiles = recipe.Profiles.ToSummaryDtos(),
            PlanningStatistics = new RecipePlanningStatisticsDto
            {
                TimesPlanned = timesPlanned,
                LastPlanned = lastPlanned,
                UpcomingTimesPlanned = upcomingTimesPlanned,
            },
        };

    public static ICollection<RecipeTagDto> ToDtos(this IEnumerable<RecipeTag> tags) => tags.Select(t => t.ToDto()).ToArray();

    public static RecipeTagDto ToDto(this RecipeTag tag) =>
        new()
        {
            Id = tag.Id,
            Name = tag.Name,
        };

    public static ICollection<RecipeImageDto> ToDtos(this IEnumerable<RecipeImage> images) =>
        images.OrderBy(i => i.Order).Select(i => i.ToDto()).ToArray();

    public static RecipeImageDto ToDto(this RecipeImage image) =>
        new()
        {
            Id = image.Id,
            Url = image.ToImageUrl(),
            Order = image.Order,
        };

    public static string ToImageUrl(this RecipeImage? image) =>
        image is null ? string.Empty : $"/api/recipes/{image.RecipeId}/images/{image.Id}";

    public static ICollection<RecipeIngredientDto> ToDtos(this IEnumerable<RecipeIngredient> ingredients) =>
        ingredients.OrderBy(i => i.Order).ThenBy(i => i.Id).Select(i => i.ToDto()).ToArray();

    public static RecipeIngredientDto ToDto(this RecipeIngredient ingredient) =>
        new()
        {
            Id = ingredient.Id,
            Name = ingredient.Name,
            Quantity = ingredient.Quantity,
            Unit = ingredient.Unit,
            Order = ingredient.Order,
        };

    public static ICollection<RecipeStepDto> ToDtos(this IEnumerable<RecipeStep> steps) =>
        steps.OrderBy(s => s.Order).Select(s => s.ToDto()).ToArray();

    public static RecipeStepDto ToDto(this RecipeStep step) =>
        new()
        {
            Id = step.Id,
            Description = step.Description,
            Order = step.Order,
        };

    public static ICollection<RecipeProfileSummaryDto> ToSummaryDtos(this IEnumerable<RecipeProfile> profiles) =>
        profiles.Select(p => p.ToSummaryDto()).ToArray();

    public static RecipeProfileSummaryDto ToSummaryDto(this RecipeProfile profile) =>
        new()
        {
            Id = profile.Id,
            Name = profile.Name,
            Servings = profile.Servings,
        };

    public static RecipeProfileDto ToDto(this RecipeProfile profile) =>
        new()
        {
            Id = profile.Id,
            Name = profile.Name,
            Servings = profile.Servings,
            Products = profile.Products.OrderBy(p => p.Order).Select(p => p.ToDto()).ToArray(),
        };

    public static RecipeProfileProductDto ToDto(this RecipeProfileProduct product) =>
        new()
        {
            Id = product.Id,
            Name = product.Name,
            Quantity = product.Quantity,
            AtHome = product.AtHome,
            Order = product.Order,
        };

    public static RecipeIngredientInputDto ToInput(this RecipeIngredientDto row) => new()
    {
        Id = row.Id,
        Name = row.Name,
        Quantity = row.Quantity,
        Unit = row.Unit,
    };

    public static RecipeStepInputDto ToInput(this RecipeStepDto row) => new()
    {
        Id = row.Id,
        Description = row.Description,
    };

    public static RecipeProfileProductInputDto ToInput(this RecipeProfileProductDto row) => new()
    {
        Id = row.Id,
        Name = row.Name,
        Quantity = row.Quantity,
        AtHome = row.AtHome,
    };
}
