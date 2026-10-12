using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class ConfigControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    [Fact]
    public async Task GetConfig_ReturnsConfig()
    {
        var config = await HttpClient.GetFromJsonAsync<AppConfigDto>("/api/config", JsonOptions);

        Assert.NotNull(config);
        Assert.True(config.AppInitialized);
    }

    [Fact]
    public async Task InitializeConfig_WhenAlreadyInitialized_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/config/initialize", new InitializeConfigDto
        {
            AdminEmail = "admin2@example.com",
            AdminPassword = "Pass123!",
            AdminDisplayName = "Admin 2",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task InitializeConfig_ValidRequest_InitializesApplication()
    {
        await Factory.Reset();
        var client = CreateUnauthenticatedApiClient();
        await SetAntiforgeryToken(client);

        var response = await client.PostAsJsonAsync("/api/config/initialize", new InitializeConfigDto
        {
            AdminEmail = "first@example.com",
            AdminPassword = "Pass123!",
            AdminDisplayName = "First Admin",
        });

        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);
        var config = await client.GetFromJsonAsync<AppConfigDto>("/api/config", JsonOptions);
        Assert.NotNull(config);
        Assert.True(config.AppInitialized);
    }

    [Fact]
    public async Task InitializeConfig_InvalidEmail_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/config/initialize", new InitializeConfigDto
        {
            AdminEmail = "invalid",
            AdminPassword = "Pass123!",
            AdminDisplayName = "Admin",
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
