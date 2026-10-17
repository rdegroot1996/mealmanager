using System.ComponentModel.DataAnnotations;

namespace MealManager.Domain.Entities;

public abstract class PlannedEntry
{
    [Key]
    public required Guid Id { get; set; }
    public required Guid MealPlanId { get; set; }
    public MealPlan MealPlan { get; set; } = null!;
    public required DateOnly Date { get; set; }
    public int SortOrder { get; set; }
}
