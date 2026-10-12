namespace MealManager.Application.DTO;

public class RecipePlanningStatisticsDto
{
    public required int TimesPlanned { get; init; }
    public DateOnly? LastPlanned { get; init; }
    public int UpcomingTimesPlanned { get; init; }
}
