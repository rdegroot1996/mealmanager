using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Tests.Integration.Configuration;
using Microsoft.Net.Http.Headers;
using Microsoft.AspNetCore.Hosting;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class AuthenticationControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    [Fact]
    public async Task ProtectedApi_WithoutAuthentication_ReturnsUnauthorizedWithoutRedirect()
    {
        var response = await CreateUnauthenticatedApiClient().GetAsync("/api/recipes");

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Null(response.Headers.Location);
    }

    [Fact]
    public async Task Session_WithoutAuthentication_ReturnsAnonymousStateAndAntiforgeryToken()
    {
        var client = CreateUnauthenticatedApiClient();

        var response = await client.GetAsync("/api/authentication/session");
        var session = await response.Content.ReadFromJsonAsync<AuthenticationSessionDto>(JsonOptions);

        Assert.NotNull(session);
        Assert.False(session.IsAuthenticated);
        Assert.False(string.IsNullOrWhiteSpace(session.AntiforgeryToken));
        Assert.Equal("no-store", response.Headers.CacheControl?.ToString());
    }

    [Fact]
    public async Task LoginAccount_Correct_SetsCookieAndAuthenticatesSession()
    {
        var client = CreateUnauthenticatedApiClient();
        await SetAntiforgeryToken(client);

        var beforeLogin = DateTimeOffset.UtcNow;
        var loginResponse = await client.PostAsJsonAsync("/api/authentication/login", UserLogin);
        var afterLogin = DateTimeOffset.UtcNow;
        Assert.Equal(HttpStatusCode.NoContent, loginResponse.StatusCode);
        var authenticationCookie = loginResponse.Headers.GetValues(HeaderNames.SetCookie)
            .Select(value => SetCookieHeaderValue.Parse(value))
            .Single(cookie => cookie.Name == ".MealManager.Authentication");
        Assert.True(authenticationCookie.HttpOnly);
        Assert.Equal(SameSiteMode.Strict, authenticationCookie.SameSite);
        Assert.NotNull(authenticationCookie.Expires);
        Assert.InRange(
            authenticationCookie.Expires.Value,
            beforeLogin.AddDays(14).AddMinutes(-1),
            afterLogin.AddDays(14).AddMinutes(1));

        var session = await client.GetFromJsonAsync<AuthenticationSessionDto>(
            "/api/authentication/session",
            JsonOptions);
        Assert.NotNull(session);
        Assert.True(session.IsAuthenticated);

        var protectedResponse = await client.GetAsync("/api/recipes");
        Assert.Equal(HttpStatusCode.OK, protectedResponse.StatusCode);
    }

    [Fact]
    public async Task LoginAccount_WithoutAntiforgeryToken_ReturnsBadRequest()
    {
        var client = CreateUnauthenticatedApiClient();

        var response = await client.PostAsJsonAsync("/api/authentication/login", UserLogin);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task LoginAccount_WithInvalidPassword_ReturnsUnauthorized()
    {
        var client = CreateUnauthenticatedApiClient();
        await SetAntiforgeryToken(client);

        var response = await client.PostAsJsonAsync(
            "/api/authentication/login",
            new LoginDto
            {
                Email = UserLogin.Email,
                Password = "not-the-password",
            });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }

    [Fact]
    public async Task LoginAccount_EmptyCredentials_ReturnsBadRequest()
    {
        var client = CreateUnauthenticatedApiClient();
        await SetAntiforgeryToken(client);

        var response = await client.PostAsJsonAsync(
            "/api/authentication/login",
            new LoginDto { Email = "", Password = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task LoginAccount_LocksOutAfterRepeatedFailures()
    {
        var client = CreateUnauthenticatedApiClient();
        await SetAntiforgeryToken(client);
        var invalidLogin = new LoginDto { Email = UserLogin.Email, Password = "not-the-password" };

        for (var attempt = 0; attempt < 5; attempt++)
        {
            var response = await client.PostAsJsonAsync("/api/authentication/login", invalidLogin);
            Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        }

        var validResponse = await client.PostAsJsonAsync("/api/authentication/login", UserLogin);
        Assert.Equal(HttpStatusCode.Unauthorized, validResponse.StatusCode);
    }

    [Fact]
    public async Task Logout_ExpiresCookieAndEndsSession()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/authentication/logout", new { });
        Assert.Equal(HttpStatusCode.NoContent, response.StatusCode);

        var session = await HttpClient.GetFromJsonAsync<AuthenticationSessionDto>(
            "/api/authentication/session",
            JsonOptions);
        Assert.NotNull(session);
        Assert.False(session.IsAuthenticated);

        var protectedResponse = await HttpClient.GetAsync("/api/recipes");
        Assert.Equal(HttpStatusCode.Unauthorized, protectedResponse.StatusCode);
    }

    [Fact]
    public async Task Logout_WithoutAuthentication_ReturnsUnauthorized()
    {
        var client = CreateUnauthenticatedApiClient();
        await SetAntiforgeryToken(client);

        var response = await client.PostAsJsonAsync("/api/authentication/logout", new { });

        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
    }


    [Theory]
    [InlineData("Production", true, "http", false)]
    [InlineData("Production", true, "https", true)]
    [InlineData("Production", false, "https", true)]
    [InlineData("Development", false, "http", false)]
    public async Task Session_CookiesShareConfiguredSecurePolicy(string environment, bool allowInsecureHttp, string scheme, bool secure)
    {
        using var configured = Factory.WithWebHostBuilder(builder =>
        {
            builder.UseEnvironment(environment);
            builder.UseSetting("Authentication:AllowInsecureHttp", allowInsecureHttp.ToString());
        });
        using var client = configured.CreateClient(new() { BaseAddress = new Uri($"{scheme}://household.test") });
        var response = await client.GetAsync("/api/authentication/session");
        response.EnsureSuccessStatusCode();
        var cookies = response.Headers.GetValues(HeaderNames.SetCookie).Select(value => SetCookieHeaderValue.Parse(value)).ToArray();
        var serverCookie = Assert.Single(cookies, cookie => cookie.Name == ".MealManager.Antiforgery");
        var readableCookie = Assert.Single(cookies, cookie => cookie.Name == "XSRF-TOKEN");
        Assert.Equal(secure, serverCookie.Secure);
        Assert.Equal(secure, readableCookie.Secure);
        Assert.True(serverCookie.HttpOnly);
        Assert.False(readableCookie.HttpOnly);
        Assert.Equal(serverCookie.SameSite, readableCookie.SameSite);
    }
}
