using MealManager.Domain.Entities;

namespace MealManager.Application.Queries;

internal sealed record RecipeWithPlanningHistory
{
    public required Recipe Recipe { get; init; }
    public int PastCount { get; init; }
    public DateOnly? LastPastDate { get; init; }
    public int UpcomingCount { get; init; }
    public int RecentCount { get; init; }
}
