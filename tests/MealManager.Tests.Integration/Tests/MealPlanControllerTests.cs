using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class MealPlanControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private async Task<PlanningCycleDto> CreateCycleAsync()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 6),
            EndDate = new DateOnly(2025, 1, 12),
        });
        return (await response.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
    }

    [Fact]
    public async Task GetCycleMealPlan_CreatesEmptyPlanning()
    {
        var cycle = await CreateCycleAsync();

        var mealPlan = await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{cycle.Id}", JsonOptions);
        Assert.NotNull(mealPlan);
        Assert.Equal(cycle.Id, mealPlan.PlanningCycleId);
        Assert.Empty(mealPlan.Entries);
        Assert.Empty(mealPlan.Notes);
    }

    [Fact]
    public async Task GetCycleMealPlan_ReturnsSamePlanningOnSecondCall()
    {
        var cycle = await CreateCycleAsync();

        var planning1 = await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{cycle.Id}", JsonOptions);
        var planning2 = await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{cycle.Id}", JsonOptions);

        Assert.NotNull(planning1);
        Assert.NotNull(planning2);
        Assert.Equal(planning1.Id, planning2.Id);
    }

    [Fact]
    public async Task GetCycleMealPlan_MissingCycle_ReturnsNotFound()
    {
        var response = await HttpClient.GetAsync($"/api/meal-plans/cycle/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
