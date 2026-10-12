using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class UserControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    [Fact]
    public async Task GetUserInfo_ReturnsCurrentUser()
    {
        var user = await HttpClient.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions);

        Assert.NotNull(user);
        Assert.Equal("user@example.com", user.Email);
        Assert.Equal("Default User", user.DisplayName);
    }

    [Fact]
    public async Task GetUsers_ReturnsAllUsers()
    {
        var users = await HttpClient.GetFromJsonAsync<UserDto[]>("/api/users", JsonOptions);

        Assert.NotNull(users);
        Assert.Single(users);
    }

    [Fact]
    public async Task GetUsers_AsNonAdmin_ReturnsForbidden()
    {
        var email = "member@example.com";
        await HttpClient.PostAsJsonAsync("/api/users", new CreateUserDto
        {
            Email = email,
            Password = "Pass123!",
            DisplayName = "Member",
            IsAdmin = false,
        });
        var memberClient = await CreateUserApiClient(new LoginDto { Email = email, Password = "Pass123!" });

        var response = await memberClient.GetAsync("/api/users");

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task CreateUser_CreatesNewUser()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/users", new CreateUserDto
        {
            Email = "new@example.com",
            Password = "Pass123!",
            DisplayName = "New User",
            IsAdmin = false,
        });
        response.EnsureSuccessStatusCode();
        var user = await response.Content.ReadFromJsonAsync<UserDto>(JsonOptions);

        Assert.NotNull(user);
        Assert.Equal("new@example.com", user.Email);
        Assert.Equal("New User", user.DisplayName);
        Assert.False(user.IsAdmin);
    }

    [Fact]
    public async Task CreateUser_DuplicateEmail_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/users", new CreateUserDto
        {
            Email = UserLogin.Email,
            Password = "Pass123!",
            DisplayName = "Duplicate",
            IsAdmin = false,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateUserProfile_UpdatesDisplayName()
    {
        await HttpClient.PutAsJsonAsync("/api/users/me", new UpdateUserProfileDto
        {
            DisplayName = "Updated Name",
        });

        var user = await HttpClient.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions);
        Assert.NotNull(user);
        Assert.Equal("Updated Name", user.DisplayName);
    }

    [Fact]
    public async Task UpdateUser_UpdatesUserDetails()
    {
        var me = await HttpClient.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions);
        Assert.NotNull(me);

        await HttpClient.PutAsJsonAsync($"/api/users/{me.Id}", new UpdateUserDto
        {
            DisplayName = "Admin Updated",
            IsAdmin = true,
        });

        var updated = await HttpClient.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Admin Updated", updated.DisplayName);
    }

    [Fact]
    public async Task DeleteUser_RemovesUser()
    {
        var createResponse = await HttpClient.PostAsJsonAsync("/api/users", new CreateUserDto
        {
            Email = "delete-me@example.com",
            Password = "Pass123!",
            DisplayName = "Delete Me",
            IsAdmin = false,
        });
        var created = await createResponse.Content.ReadFromJsonAsync<UserDto>(JsonOptions);
        Assert.NotNull(created);

        var deleteResponse = await HttpClient.DeleteAsync($"/api/users/{created.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var users = await HttpClient.GetFromJsonAsync<UserDto[]>("/api/users", JsonOptions);
        Assert.NotNull(users);
        Assert.DoesNotContain(users, u => u.Id == created.Id);
    }

    [Fact]
    public async Task CreateUser_InvalidEmail_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/users", new CreateUserDto
        {
            Email = "not-an-email",
            Password = "Pass123!",
            DisplayName = "Invalid",
            IsAdmin = false,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateUserProfile_EmptyDisplayName_ReturnsBadRequest()
    {
        var response = await HttpClient.PutAsJsonAsync("/api/users/me", new UpdateUserProfileDto { DisplayName = "" });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateUser_MissingUser_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsJsonAsync(
            $"/api/users/{Guid.NewGuid()}",
            new UpdateUserDto { DisplayName = "Missing", IsAdmin = false });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteUser_MissingUser_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/users/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteUser_CurrentUser_ReturnsBadRequest()
    {
        var currentUser = await HttpClient.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions);
        Assert.NotNull(currentUser);

        var response = await HttpClient.DeleteAsync($"/api/users/{currentUser.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "CannotDeleteSelf");
    }
}
