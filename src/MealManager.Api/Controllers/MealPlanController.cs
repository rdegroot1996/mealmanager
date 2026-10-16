namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/meal-plans")]
public class MealPlanController : ControllerBase
{
    [HttpGet("upcoming")]
    public Task<UpcomingMealPlanDto> GetUpcomingMealPlan(
        [FromServices] MealPlanQueries queries,
        [FromQuery, Microsoft.AspNetCore.Mvc.ModelBinding.BindRequired] DateOnly fromDate) => queries.GetUpcomingMealPlan(fromDate);

    [HttpGet("cycle/{cycleId:guid}")]
    public async Task<MealPlanDto> GetCycleMealPlan(
        [FromServices] MealPlanQueries queries,
        [FromRoute] Guid cycleId) =>
        await queries.GetCycleMealPlan(cycleId);
}
