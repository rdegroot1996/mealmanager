using MealManager.Domain.Entities;
using MealManager.Common.Enums;

namespace MealManager.Application.Mapping;

public static class PlanningMappingExtensions
{
    public static PlanningNoteDto ToDto(this PlanningNote note) =>
        new()
        {
            Id = note.Id,
            Date = note.Date,
            Text = note.Text,
        };

    public static PlanningEntryDto ToDto(this PlanningEntry entry, Recipe recipe, RecipeProfile profile, bool hasGroceriesAdded) =>
        new()
        {
            Id = entry.Id,
            Kind = entry is PlanningLeftover ? PlanningEntryKind.Leftover : PlanningEntryKind.Meal,
            OriginalMealId = entry is PlanningLeftover leftover ? leftover.OriginalMealId : null,
            Recipe = recipe.ToSummaryDto(),
            RecipeProfile = profile.ToSummaryDto(),
            Date = entry.Date,
            SortOrder = entry.SortOrder,
            HasGroceriesAdded = hasGroceriesAdded,
        };

    public static PlanningMealSummaryDto ToSummaryDto(this PlanningMeal meal, Recipe recipe, RecipeProfile profile) =>
        new()
        {
            Id = meal.Id,
            Date = meal.Date,
            RecipeId = recipe.Id,
            RecipeName = recipe.Name,
            RecipeImageUrl = recipe.Images
                .OrderBy(i => i.Order)
                .Select(image => $"/api/recipes/{image.RecipeId}/images/{image.Id}")
                .FirstOrDefault() ?? string.Empty,
            ProfileName = profile.Name,
            ProfileServings = profile.Servings,
        };

}
