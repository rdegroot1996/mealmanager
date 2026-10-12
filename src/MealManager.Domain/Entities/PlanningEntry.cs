using System.ComponentModel.DataAnnotations;

namespace MealManager.Domain.Entities;

public abstract class PlanningEntry
{
    [Key]
    public required Guid Id { get; set; }
    public required Guid PlanningId { get; set; }
    public Planning Planning { get; set; } = null!;
    public required DateOnly Date { get; set; }
    public int SortOrder { get; set; }
}
