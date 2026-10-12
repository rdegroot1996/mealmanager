using MealManager.Common.Enums;

namespace MealManager.Domain.Entities;

public class Recipe : BaseEntity
{
    public required string Name { get; set; }
    public string? Notes { get; set; }
    public required RecipeCategory Category { get; set; }
    public required int BaseServings { get; set; }
    public bool IsFavorite { get; set; }

    public required List<RecipeTag> Tags { get; set; }
    public List<RecipeImage> Images { get; set; } = [];

    public required List<RecipeIngredient> Ingredients { get; set; }
    public required List<RecipeStep> Steps { get; set; }
    public List<RecipeProfile> Profiles { get; set; } = [];
}
