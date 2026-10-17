using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class PlanningCycleControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    [Fact]
    public async Task CreatePlanningCycle_Succeeds()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 6),
            EndDate = new DateOnly(2025, 1, 12),
        });
        response.EnsureSuccessStatusCode();

        var cycle = await response.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(cycle);
        Assert.Equal(new DateOnly(2025, 1, 6), cycle.StartDate);
        Assert.Equal(new DateOnly(2025, 1, 12), cycle.EndDate);
    }

    [Fact]
    public async Task GetPlanningCycle_ReturnsById()
    {
        var createResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 2, 3),
            EndDate = new DateOnly(2025, 2, 9),
        });
        var created = await createResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(created);

        var cycle = await HttpClient.GetFromJsonAsync<PlanningCycleDto>($"/api/planning-cycles/{created.Id}", JsonOptions);
        Assert.NotNull(cycle);
        Assert.Equal(created.Id, cycle.Id);
    }

    [Fact]
    public async Task GetCurrentPlanningCycle_ReturnsLatest()
    {
        await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = DateOnly.FromDateTime(DateTime.Today),
            EndDate = DateOnly.FromDateTime(DateTime.Today.AddDays(6)),
        });

        var cycle = await HttpClient.GetFromJsonAsync<PlanningCycleDto>("/api/planning-cycles/current", JsonOptions);
        Assert.NotNull(cycle);
    }

    [Fact]
    public async Task UpdatePlanningCycle_UpdatesDates()
    {
        var createResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 3, 3),
            EndDate = new DateOnly(2025, 3, 9),
        });
        var created = await createResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(created);

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/planning-cycles/{created.Id}", new UpdatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 3, 3),
            EndDate = new DateOnly(2025, 3, 16),
        });
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal(new DateOnly(2025, 3, 16), updated.EndDate);
    }

    [Fact]
    public async Task CreatePlanningCycle_Validation_EndBeforeStart_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 12),
            EndDate = new DateOnly(2025, 1, 6),
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreatePlanningCycle_DuplicateStartDate_ReturnsBadRequest()
    {
        var startDate = new DateOnly(2025, 1, 12);
        await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = startDate,
            EndDate = startDate.AddDays(6),
        });

        var response = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = startDate,
            EndDate = startDate.AddDays(6),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "CycleMustStartAfterExisting");
    }

    [Fact]
    public async Task UpdatePlanningCycle_DuplicateStartDate_ReturnsBadRequest()
    {
        var firstStartDate = new DateOnly(2025, 3, 3);
        await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = firstStartDate,
            EndDate = firstStartDate.AddDays(6),
        });
        var currentResponse = await HttpClient.PostAsJsonAsync(
            "/api/planning-cycles",
            new CreatePlanningCycleDto
            {
                StartDate = firstStartDate.AddDays(7),
                EndDate = firstStartDate.AddDays(13),
            });
        var current = await currentResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(current);

        var response = await HttpClient.PutAsJsonAsync(
            $"/api/planning-cycles/{current.Id}",
            new UpdatePlanningCycleDto
            {
                StartDate = firstStartDate,
                EndDate = firstStartDate.AddDays(13),
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "CycleStartDateExists");
    }

    [Fact]
    public async Task UpdateHistoricalPlanningCycle_ReturnsBadRequest()
    {
        var oldResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 4, 7),
            EndDate = new DateOnly(2025, 4, 13),
        });
        var oldCycle = await oldResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(oldCycle);

        await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 4, 14),
            EndDate = new DateOnly(2025, 4, 20),
        });

        var response = await HttpClient.PutAsJsonAsync($"/api/planning-cycles/{oldCycle.Id}", new UpdatePlanningCycleDto
        {
            StartDate = oldCycle.StartDate,
            EndDate = new DateOnly(2025, 4, 14),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task GetPlanningCycle_MissingCycle_ReturnsNotFound()
    {
        var response = await HttpClient.GetAsync($"/api/planning-cycles/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetCurrentPlanningCycle_WithoutCycles_ReturnsNotFound()
    {
        var response = await HttpClient.GetAsync("/api/planning-cycles/current");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePlanningCycle_MissingCycle_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsJsonAsync(
            $"/api/planning-cycles/{Guid.NewGuid()}",
            new UpdatePlanningCycleDto
            {
                StartDate = new DateOnly(2025, 1, 6),
                EndDate = new DateOnly(2025, 1, 12),
            });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePlanningCycle_EndBeforeStart_ReturnsBadRequest()
    {
        var createResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 6),
            EndDate = new DateOnly(2025, 1, 12),
        });
        var cycle = await createResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(cycle);

        var response = await HttpClient.PutAsJsonAsync($"/api/planning-cycles/{cycle.Id}", new UpdatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 12),
            EndDate = new DateOnly(2025, 1, 6),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task CreatePlanningCycle_BeforeLatestStartDate_ReturnsBadRequest()
    {
        await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 2, 10),
            EndDate = new DateOnly(2025, 2, 16),
        });

        var response = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 2, 3),
            EndDate = new DateOnly(2025, 2, 9),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "CycleMustStartAfterExisting");
    }

    [Fact]
    public async Task DeletePlanningCycle_RemovesPlanningAndShoppingData()
    {
        var createResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 6, 2),
            EndDate = new DateOnly(2025, 6, 8),
        });
        var cycle = await createResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(cycle);

        var groceryResponse = await HttpClient.PostAsJsonAsync(
            $"/api/shopping-lists/cycle/{cycle.Id}/items",
            new AddManualShoppingListItemDto { Name = "Coffee", Quantity = 1 });
        groceryResponse.EnsureSuccessStatusCode();

        var deleteResponse = await HttpClient.DeleteAsync($"/api/planning-cycles/{cycle.Id}");

        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await HttpClient.GetAsync($"/api/planning-cycles/{cycle.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await HttpClient.GetAsync($"/api/meal-plans/cycle/{cycle.Id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await HttpClient.GetAsync($"/api/shopping-lists/cycle/{cycle.Id}")).StatusCode);
    }

    [Fact]
    public async Task DeleteHistoricalPlanningCycle_ReturnsReadOnlyAndPreservesCycles()
    {
        var oldResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 7, 7),
            EndDate = new DateOnly(2025, 7, 13),
        });
        var oldCycle = await oldResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(oldCycle);

        var currentResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 7, 14),
            EndDate = new DateOnly(2025, 7, 20),
        });
        var currentCycle = await currentResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions);
        Assert.NotNull(currentCycle);

        var deleteResponse = await HttpClient.DeleteAsync($"/api/planning-cycles/{oldCycle.Id}");
        var remainingCycle = await HttpClient.GetFromJsonAsync<PlanningCycleDto>(
            $"/api/planning-cycles/{currentCycle.Id}", JsonOptions);

        Assert.Equal(HttpStatusCode.BadRequest, deleteResponse.StatusCode);
        Assert.NotNull(remainingCycle);
        Assert.Equal(oldCycle.Id, remainingCycle.PreviousPlanningCycleId);
        Assert.Null(remainingCycle.NextPlanningCycleId);
    }

    [Fact]
    public async Task DeletePlanningCycle_MissingCycle_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/planning-cycles/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateActiveCycle_CannotMoveBehindHistory()
    {
        var start = new DateOnly(2026, 1, 12);
        (await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = start,
            EndDate = start.AddDays(6),
        })).EnsureSuccessStatusCode();
        var created = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = start.AddDays(7),
            EndDate = start.AddDays(13),
        });
        var active = (await created.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
        var response = await HttpClient.PutAsJsonAsync($"/api/planning-cycles/{active.Id}", new UpdatePlanningCycleDto
        {
            StartDate = start.AddDays(-7),
            EndDate = start.AddDays(13),
        });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "CycleMustStartAfterExisting");
        var current = await HttpClient.GetFromJsonAsync<PlanningCycleDto>("/api/planning-cycles/current", JsonOptions);
        Assert.Equal(active.Id, current!.Id);
        Assert.Equal(active.StartDate, current.StartDate);
    }
}
