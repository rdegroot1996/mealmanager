using System.ComponentModel;
using MealManager.Common.Enums;

namespace MealManager.Application.DTO.Mcp;

public sealed record PlanningEntryInputDto
{
    [Description("Existing entry ID to retain or edit. Omit for a new entry.")]
    public Guid? Id { get; init; }
    [Description("Unique temporary key required for a new entry; returned with its persisted ID.")]
    public string? ClientKey { get; init; }
    [Description("Meal or Leftover. A leftover refers to an original meal, not a recipe/profile.")]
    public required PlanningEntryKind Kind { get; init; }
    public required DateOnly Date { get; init; }
    [Description("Required for an original Meal. Omit for a Leftover.")]
    public Guid? RecipeId { get; init; }
    [Description("Profile belonging to the meal recipe. Omit for a Leftover.")]
    public Guid? ProfileId { get; init; }
    [Description("Retained original meal ID for a Leftover. Supply this or originalMealKey.")]
    public Guid? OriginalMealId { get; init; }
    [Description("Client key of a new original Meal included in this same plan.")]
    public string? OriginalMealKey { get; init; }
}
