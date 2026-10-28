using MealManager.Domain.Entities;
using MealManager.Common.Enums;

namespace MealManager.Application.Mapping;

public static class MealPlanMappingExtensions
{
    public static PlanningDayNoteDto ToDto(this PlanningDayNote note) =>
        new()
        {
            Id = note.Id,
            Date = note.Date,
            Text = note.Text,
        };

    public static PlannedEntryDto ToDto(this PlannedEntry entry, Recipe recipe, RecipeProfile profile, bool hasReviewedGroceries) =>
        new()
        {
            Id = entry.Id,
            Kind = entry is PlannedLeftover ? PlannedEntryKind.Leftover : PlannedEntryKind.Meal,
            OriginalMealId = entry is PlannedLeftover leftover ? leftover.OriginalMealId : null,
            Recipe = recipe.ToSummaryDto(),
            RecipeProfile = profile.ToSummaryDto(),
            Date = entry.Date,
            SortOrder = entry.SortOrder,
            HasReviewedGroceries = hasReviewedGroceries,
        };

    public static PlannedMealSummaryDto ToSummaryDto(this PlannedMeal meal, Recipe recipe, RecipeProfile profile) =>
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
            RecipeProfileId = profile.Id,
            ProfileName = profile.Name,
            ProfileServings = profile.Servings,
        };

}
