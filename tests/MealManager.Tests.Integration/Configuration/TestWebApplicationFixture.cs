using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using MealManager.Application.DTO;
using Xunit;

namespace MealManager.Tests.Integration.Configuration;

[Collection(TestWebApplicationCollection.Name)]
public class TestWebApplicationFixture : IAsyncLifetime
{
    private readonly CustomWebApplicationFactory _factory;

    protected CustomWebApplicationFactory Factory => _factory;

    protected static JsonSerializerOptions JsonOptions { get; } = new(JsonSerializerDefaults.Web)
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Converters = { new JsonStringEnumConverter() },
    };

    protected LoginDto UserLogin { get; private set; } = null!;
    protected HttpClient HttpClient { get; private set; } = null!;

    protected TestWebApplicationFixture(CustomWebApplicationFactory factory)
    {
        _factory = factory;
    }

    public async ValueTask InitializeAsync()
    {
        // Reset the database to a clean state
        await _factory.Reset();

        // Create a default user
        UserLogin = new()
        {
            Email = "user@example.com",
            Password = "Pass123!",
        };
        var httpClient = _factory.CreateClient();
        await SetAntiforgeryToken(httpClient);
        await httpClient.PostAsJsonAsync(
            "/api/config/initialize",
            new InitializeConfigDto
            {
                AdminEmail = UserLogin.Email,
                AdminPassword = UserLogin.Password,
                AdminDisplayName = "Default User",
            });

        // Initialize an API client for the default user
        HttpClient = await CreateUserApiClient(UserLogin);
    }

    protected async Task<HttpClient> CreateUserApiClient(LoginDto userLogin)
    {
        var httpClient = _factory.CreateClient();
        await SetAntiforgeryToken(httpClient);
        var response = await httpClient.PostAsJsonAsync(
            "/api/authentication/login",
            new LoginDto
            {
                Email = userLogin.Email,
                Password = userLogin.Password,
            });
        if (!response.IsSuccessStatusCode)
        {
            var responseBody = await response.Content.ReadAsStringAsync();
            throw new InvalidOperationException($"Login failed with {(int)response.StatusCode}. Response: {responseBody}");
        }

        await SetAntiforgeryToken(httpClient);
        return httpClient;
    }

    protected HttpClient CreateUnauthenticatedApiClient() => _factory.CreateClient();

    protected static async Task AssertProblemCode(HttpResponseMessage response, string expectedCode)
    {
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal(expectedCode, problem.RootElement.GetProperty("code").GetString());
    }

    protected async Task SetAntiforgeryToken(HttpClient httpClient)
    {
        var response = await httpClient.GetAsync("/api/authentication/session");
        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException(
                $"The authentication session failed with {(int)response.StatusCode}. Response: {await response.Content.ReadAsStringAsync()}");
        }

        var session = await response.Content.ReadFromJsonAsync<AuthenticationSessionDto>(JsonOptions);
        if (session is null)
        {
            throw new InvalidOperationException("The authentication session did not return an antiforgery token.");
        }

        httpClient.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        httpClient.DefaultRequestHeaders.Add("X-XSRF-TOKEN", session.AntiforgeryToken);
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
