using System.Net;
using System.Net.Http.Json;
using MealManager.Application.Commands;
using MealManager.Application.DTO;
using MealManager.Domain.Entities;
using MealManager.Tests.Integration.Configuration;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class PasswordRecoveryTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    [Fact]
    public async Task ChangePassword_KeepsCurrentSessionAndRevokesOtherSessions()
    {
        using var other = await CreateUserApiClient(UserLogin);
        var change = await HttpClient.PostAsJsonAsync("/api/authentication/change-password",
            new ChangePasswordDto { CurrentPassword = UserLogin.Password, NewPassword = "Changed123!" });
        Assert.Equal(HttpStatusCode.NoContent, change.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await HttpClient.GetAsync("/api/recipes")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await other.GetAsync("/api/recipes")).StatusCode);
        using var replacement = await CreateUserApiClient(new LoginDto { Email = UserLogin.Email, Password = "Changed123!" });
        Assert.Equal(HttpStatusCode.OK, (await replacement.GetAsync("/api/recipes")).StatusCode);
    }

    [Theory]
    [InlineData("wrong", "Changed123!")]
    [InlineData("Pass123!", "weak")]
    [InlineData("Pass123!", "Pass123!")]
    public async Task InvalidChange_PreservesPasswordAndSession(string current, string next)
    {
        var response = await HttpClient.PostAsJsonAsync("/api/authentication/change-password",
            new ChangePasswordDto { CurrentPassword = current, NewPassword = next });
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await HttpClient.GetAsync("/api/recipes")).StatusCode);
        using var stillValid = await CreateUserApiClient(UserLogin);
        Assert.False((await stillValid.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions))!.MustChangePassword);
    }

    [Fact]
    public async Task Reset_ClearsLockoutRevokesSessionsAndRequiresReplacementBeforeAnyDataAccess()
    {
        var member = await CreateMember();
        var login = new LoginDto { Email = member.Email, Password = "Member123!" };
        using var existing = await CreateUserApiClient(login);
        using var failedLogin = CreateUnauthenticatedApiClient();
        await SetAntiforgeryToken(failedLogin);
        for (var i = 0; i < 5; i++)
            Assert.Equal(HttpStatusCode.Unauthorized, (await failedLogin.PostAsJsonAsync("/api/authentication/login",
                login with { Password = "wrong" })).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await failedLogin.PostAsJsonAsync("/api/authentication/login", login)).StatusCode);

        var reset = await HttpClient.PostAsJsonAsync($"/api/users/{member.Id}/reset-password",
            new ResetUserPasswordDto { TemporaryPassword = "Temporary123!" });
        Assert.Equal(HttpStatusCode.NoContent, reset.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await existing.GetAsync("/api/recipes")).StatusCode);
        using var temporary = await CreateUserApiClient(login with { Password = "Temporary123!" });
        Assert.True((await temporary.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions))!.MustChangePassword);
        var blocked = await temporary.GetAsync("/api/recipes");
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        await AssertProblemCode(blocked, "PasswordChangeRequired");
        Assert.Equal(HttpStatusCode.Forbidden, (await temporary.PutAsJsonAsync("/api/users/me",
            new UpdateUserProfileDto { DisplayName = "Blocked" })).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await temporary.PostAsJsonAsync("/api/authentication/change-password",
            new ChangePasswordDto { CurrentPassword = "Temporary123!", NewPassword = "Temporary123!" })).StatusCode);
        Assert.True((await temporary.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions))!.MustChangePassword);
        (await temporary.PostAsJsonAsync("/api/authentication/change-password",
            new ChangePasswordDto { CurrentPassword = "Temporary123!", NewPassword = "Personal123!" })).EnsureSuccessStatusCode();
        Assert.False((await temporary.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions))!.MustChangePassword);
        Assert.Equal(HttpStatusCode.OK, (await temporary.GetAsync("/api/recipes")).StatusCode);
        Assert.Equal(member.DisplayName, (await temporary.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions))!.DisplayName);
    }

    [Fact]
    public async Task Reset_RequiresAdministratorAndAntiforgeryAndRejectsSelfResetOrWeakPasswords()
    {
        var member = await CreateMember();
        using var memberClient = await CreateUserApiClient(new LoginDto { Email = member.Email, Password = "Member123!" });
        var command = new ResetUserPasswordDto { TemporaryPassword = "Temporary123!" };
        Assert.Equal(HttpStatusCode.Forbidden, (await memberClient.PostAsJsonAsync($"/api/users/{member.Id}/reset-password", command)).StatusCode);
        var me = (await HttpClient.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions))!;
        var own = await HttpClient.PostAsJsonAsync($"/api/users/{me.Id}/reset-password", command);
        Assert.Equal(HttpStatusCode.BadRequest, own.StatusCode);
        await AssertProblemCode(own, "CannotResetOwnPassword");
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync($"/api/users/{member.Id}/reset-password",
            new ResetUserPasswordDto { TemporaryPassword = "weak123" })).StatusCode);
        Assert.False((await memberClient.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions))!.MustChangePassword);
        HttpClient.DefaultRequestHeaders.Remove("X-XSRF-TOKEN");
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync($"/api/users/{member.Id}/reset-password", command)).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync("/api/authentication/change-password",
            new ChangePasswordDto { CurrentPassword = UserLogin.Password, NewPassword = "Changed123!" })).StatusCode);
    }

    [Fact]
    public async Task HostRecovery_PreservesHouseholdAndOnlyRecoversAnExistingAdministrator()
    {
        var member = await CreateMember();
        var me = (await HttpClient.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions))!;
        using (var scope = Factory.Services.CreateScope())
        {
            var manager = scope.ServiceProvider.GetRequiredService<UserManager<User>>();
            var admin = (await manager.FindByEmailAsync(me.Email))!;
            Assert.True((await manager.SetLockoutEndDateAsync(admin, DateTimeOffset.UtcNow.AddDays(1))).Succeeded);
            var commands = scope.ServiceProvider.GetRequiredService<PasswordCommands>();
            await Assert.ThrowsAnyAsync<Exception>(() => commands.RecoverAdministrator(member.Email, "Temporary123!"));
            await commands.RecoverAdministrator(me.Email, "Recovery123!");
        }
        Assert.Equal(HttpStatusCode.Unauthorized, (await HttpClient.GetAsync("/api/users")).StatusCode);
        using var recovered = await CreateUserApiClient(new LoginDto { Email = me.Email, Password = "Recovery123!" });
        var user = (await recovered.GetFromJsonAsync<UserDto>("/api/users/me", JsonOptions))!;
        Assert.True(user.MustChangePassword);
        Assert.True(user.IsAdmin);
        (await recovered.PostAsJsonAsync("/api/authentication/change-password",
            new ChangePasswordDto { CurrentPassword = "Recovery123!", NewPassword = "Personal123!" })).EnsureSuccessStatusCode();
        var users = await recovered.GetFromJsonAsync<UserDto[]>("/api/users", JsonOptions);
        Assert.Equal(2, users!.Length);
        Assert.Contains(users, item => item.Id == member.Id);
    }

    private async Task<UserDto> CreateMember()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/users", new CreateUserDto
        { Email = "member@example.test", DisplayName = "Member", Password = "Member123!", IsAdmin = false });
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<UserDto>(JsonOptions))!;
    }
}
