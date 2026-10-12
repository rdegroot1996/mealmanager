using System.Net.Http.Json;
using System.Net;
using MealManager.Application.DTO;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class PlanningNoteControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private async Task<PlanningDto> SetupPlanningAsync()
    {
        var cycleResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 6),
            EndDate = new DateOnly(2025, 1, 12),
        });
        var cycle = (await cycleResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
        return (await HttpClient.GetFromJsonAsync<PlanningDto>($"/api/planning/cycle/{cycle.Id}", JsonOptions))!;
    }

    [Fact]
    public async Task AddPlanningNote_CreatesNote()
    {
        var planning = await SetupPlanningAsync();

        var response = await HttpClient.PostAsJsonAsync("/api/planning-notes", new AddPlanningNoteDto
        {
            PlanningId = planning.Id,
            Date = new DateOnly(2025, 1, 7),
            Text = "Buy groceries on Monday",
        });
        response.EnsureSuccessStatusCode();

        var note = await response.Content.ReadFromJsonAsync<PlanningNoteDto>(JsonOptions);
        Assert.NotNull(note);
        Assert.Equal("Buy groceries on Monday", note.Text);
        Assert.Equal(new DateOnly(2025, 1, 7), note.Date);
    }

    [Fact]
    public async Task DeletePlanningNote_RemovesNote()
    {
        var planning = await SetupPlanningAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-notes", new AddPlanningNoteDto
        {
            PlanningId = planning.Id,
            Date = new DateOnly(2025, 1, 8),
            Text = "Temporary note",
        });
        var note = (await addResponse.Content.ReadFromJsonAsync<PlanningNoteDto>(JsonOptions))!;

        var deleteResponse = await HttpClient.DeleteAsync($"/api/planning-notes/{note.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var updatedPlanning = await HttpClient.GetFromJsonAsync<PlanningDto>($"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions);
        Assert.NotNull(updatedPlanning);
        Assert.DoesNotContain(updatedPlanning.Notes, n => n.Id == note.Id);
    }

    [Fact]
    public async Task UpdatePlanningNote_ChangesText()
    {
        var planning = await SetupPlanningAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-notes", new AddPlanningNoteDto
        {
            PlanningId = planning.Id,
            Date = new DateOnly(2025, 1, 8),
            Text = "Original note",
        });
        var note = (await addResponse.Content.ReadFromJsonAsync<PlanningNoteDto>(JsonOptions))!;

        var updateResponse = await HttpClient.PutAsJsonAsync(
            $"/api/planning-notes/{note.Id}",
            new UpdatePlanningNoteDto { Text = "Updated note" });
        updateResponse.EnsureSuccessStatusCode();

        var updatedNote = await updateResponse.Content.ReadFromJsonAsync<PlanningNoteDto>(JsonOptions);
        Assert.NotNull(updatedNote);
        Assert.Equal(note.Id, updatedNote.Id);
        Assert.Equal("Updated note", updatedNote.Text);
    }

    [Fact]
    public async Task UpdatePlanningNote_EmptyText_ReturnsBadRequest()
    {
        var planning = await SetupPlanningAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-notes", new AddPlanningNoteDto
        {
            PlanningId = planning.Id,
            Date = new DateOnly(2025, 1, 8),
            Text = "Original note",
        });
        var note = (await addResponse.Content.ReadFromJsonAsync<PlanningNoteDto>(JsonOptions))!;

        var response = await HttpClient.PutAsJsonAsync(
            $"/api/planning-notes/{note.Id}",
            new UpdatePlanningNoteDto { Text = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePlanningNote_MissingNote_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsJsonAsync(
            $"/api/planning-notes/{Guid.NewGuid()}",
            new UpdatePlanningNoteDto { Text = "Missing note" });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddPlanningNote_ForDateThatAlreadyHasANote_ReturnsBadRequest()
    {
        var planning = await SetupPlanningAsync();
        var command = new AddPlanningNoteDto
        {
            PlanningId = planning.Id,
            Date = new DateOnly(2025, 1, 8),
            Text = "First note",
        };

        (await HttpClient.PostAsJsonAsync("/api/planning-notes", command)).EnsureSuccessStatusCode();

        var duplicate = await HttpClient.PostAsJsonAsync(
            "/api/planning-notes",
            command with { Text = "Second note" });

        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
        await AssertProblemCode(duplicate, "PlanningNoteExists");
    }

    [Fact]
    public async Task AddPlanningNote_EmptyText_ReturnsBadRequest()
    {
        var planning = await SetupPlanningAsync();
        var response = await HttpClient.PostAsJsonAsync("/api/planning-notes", new AddPlanningNoteDto
        {
            PlanningId = planning.Id,
            Date = new DateOnly(2025, 1, 7),
            Text = "",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddPlanningNote_MissingPlanning_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planning-notes", new AddPlanningNoteDto
        {
            PlanningId = Guid.NewGuid(),
            Date = new DateOnly(2025, 1, 7),
            Text = "Missing planning",
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddPlanningNote_OutsideCycle_ReturnsBadRequest()
    {
        var planning = await SetupPlanningAsync();
        var response = await HttpClient.PostAsJsonAsync("/api/planning-notes", new AddPlanningNoteDto
        {
            PlanningId = planning.Id,
            Date = new DateOnly(2025, 1, 13),
            Text = "Outside cycle",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeletePlanningNote_MissingNote_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/planning-notes/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
