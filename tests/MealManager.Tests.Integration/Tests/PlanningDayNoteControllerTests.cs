using System.Net.Http.Json;
using System.Net;
using MealManager.Application.DTO;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class PlanningDayNoteControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private async Task<MealPlanDto> SetupPlanningAsync()
    {
        var cycleResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 6),
            EndDate = new DateOnly(2025, 1, 12),
        });
        var cycle = (await cycleResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
        return (await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{cycle.Id}", JsonOptions))!;
    }

    [Fact]
    public async Task AddPlanningDayNote_CreatesNote()
    {
        var mealPlan = await SetupPlanningAsync();

        var response = await HttpClient.PostAsJsonAsync("/api/planning-day-notes", new AddPlanningDayNoteDto
        {
            MealPlanId = mealPlan.Id,
            Date = new DateOnly(2025, 1, 7),
            Text = "Buy groceries on Monday",
        });
        response.EnsureSuccessStatusCode();

        var note = await response.Content.ReadFromJsonAsync<PlanningDayNoteDto>(JsonOptions);
        Assert.NotNull(note);
        Assert.Equal("Buy groceries on Monday", note.Text);
        Assert.Equal(new DateOnly(2025, 1, 7), note.Date);
    }

    [Fact]
    public async Task DeletePlanningDayNote_RemovesNote()
    {
        var mealPlan = await SetupPlanningAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-day-notes", new AddPlanningDayNoteDto
        {
            MealPlanId = mealPlan.Id,
            Date = new DateOnly(2025, 1, 8),
            Text = "Temporary note",
        });
        var note = (await addResponse.Content.ReadFromJsonAsync<PlanningDayNoteDto>(JsonOptions))!;

        var deleteResponse = await HttpClient.DeleteAsync($"/api/planning-day-notes/{note.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var updatedMealPlan = await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions);
        Assert.NotNull(updatedMealPlan);
        Assert.DoesNotContain(updatedMealPlan.Notes, n => n.Id == note.Id);
    }

    [Fact]
    public async Task UpdatePlanningDayNote_ChangesText()
    {
        var mealPlan = await SetupPlanningAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-day-notes", new AddPlanningDayNoteDto
        {
            MealPlanId = mealPlan.Id,
            Date = new DateOnly(2025, 1, 8),
            Text = "Original note",
        });
        var note = (await addResponse.Content.ReadFromJsonAsync<PlanningDayNoteDto>(JsonOptions))!;

        var updateResponse = await HttpClient.PutAsJsonAsync(
            $"/api/planning-day-notes/{note.Id}",
            new UpdatePlanningDayNoteDto { Text = "Updated note" });
        updateResponse.EnsureSuccessStatusCode();

        var updatedNote = await updateResponse.Content.ReadFromJsonAsync<PlanningDayNoteDto>(JsonOptions);
        Assert.NotNull(updatedNote);
        Assert.Equal(note.Id, updatedNote.Id);
        Assert.Equal("Updated note", updatedNote.Text);
    }

    [Fact]
    public async Task UpdatePlanningDayNote_EmptyText_ReturnsBadRequest()
    {
        var mealPlan = await SetupPlanningAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-day-notes", new AddPlanningDayNoteDto
        {
            MealPlanId = mealPlan.Id,
            Date = new DateOnly(2025, 1, 8),
            Text = "Original note",
        });
        var note = (await addResponse.Content.ReadFromJsonAsync<PlanningDayNoteDto>(JsonOptions))!;

        var response = await HttpClient.PutAsJsonAsync(
            $"/api/planning-day-notes/{note.Id}",
            new UpdatePlanningDayNoteDto { Text = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePlanningDayNote_MissingNote_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsJsonAsync(
            $"/api/planning-day-notes/{Guid.NewGuid()}",
            new UpdatePlanningDayNoteDto { Text = "Missing note" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddPlanningDayNote_ForDateThatAlreadyHasANote_ReturnsBadRequest()
    {
        var mealPlan = await SetupPlanningAsync();
        var command = new AddPlanningDayNoteDto
        {
            MealPlanId = mealPlan.Id,
            Date = new DateOnly(2025, 1, 8),
            Text = "First note",
        };

        (await HttpClient.PostAsJsonAsync("/api/planning-day-notes", command)).EnsureSuccessStatusCode();

        var duplicate = await HttpClient.PostAsJsonAsync(
            "/api/planning-day-notes",
            command with { Text = "Second note" });

        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        await AssertProblemCode(duplicate, "PlanningDayNoteExists");
    }

    [Fact]
    public async Task AddPlanningDayNote_EmptyText_ReturnsBadRequest()
    {
        var mealPlan = await SetupPlanningAsync();
        var response = await HttpClient.PostAsJsonAsync("/api/planning-day-notes", new AddPlanningDayNoteDto
        {
            MealPlanId = mealPlan.Id,
            Date = new DateOnly(2025, 1, 7),
            Text = "",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddPlanningDayNote_MissingPlanning_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planning-day-notes", new AddPlanningDayNoteDto
        {
            MealPlanId = Guid.NewGuid(),
            Date = new DateOnly(2025, 1, 7),
            Text = "Missing mealPlan",
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddPlanningDayNote_OutsideCycle_ReturnsBadRequest()
    {
        var mealPlan = await SetupPlanningAsync();
        var response = await HttpClient.PostAsJsonAsync("/api/planning-day-notes", new AddPlanningDayNoteDto
        {
            MealPlanId = mealPlan.Id,
            Date = new DateOnly(2025, 1, 13),
            Text = "Outside cycle",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeletePlanningDayNote_MissingNote_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/planning-day-notes/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
