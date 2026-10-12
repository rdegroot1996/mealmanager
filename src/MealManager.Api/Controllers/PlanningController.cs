namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/planning")]
public class PlanningController : ControllerBase
{
    [HttpGet("upcoming")]
    public Task<UpcomingPlanningDto> GetUpcomingPlanning(
        [FromServices] PlanningQueries queries,
        [FromQuery, Microsoft.AspNetCore.Mvc.ModelBinding.BindRequired] DateOnly fromDate) => queries.GetUpcomingPlanning(fromDate);

    [HttpGet("cycle/{cycleId:guid}")]
    public async Task<PlanningDto> GetCyclePlanning(
        [FromServices] PlanningQueries queries,
        [FromRoute] Guid cycleId) =>
        await queries.GetCyclePlanning(cycleId);
}
