using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Application.Queries;
using MealManager.Common.Enums;
using MealManager.Infrastructure.Database;
using MealManager.Infrastructure.Supermarkets;
using MealManager.Tests.Integration.Configuration;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class SupermarketControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private PicnicMockHandler Mock => Factory.Services.GetRequiredService<PicnicMockHandler>();
    private async Task Connect(string email = PicnicMockHandler.Email, string country = "NL", bool reset = false)
    {
        var login = await HttpClient.PostAsJsonAsync("/api/integrations/picnic/connect", new ConnectPicnicDto { Email = email, Password = PicnicMockHandler.Password, CountryCode = country, ResetProductMappings = reset });
        login.EnsureSuccessStatusCode();
        Assert.Equal("VerificationRequired", (await login.Content.ReadFromJsonAsync<PicnicConnectionDto>(JsonOptions))!.Status);
        (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/verification-code", new { })).EnsureSuccessStatusCode();
        (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/verify", new VerifyPicnicDto { Code = PicnicMockHandler.Code })).EnsureSuccessStatusCode();
    }
    private async Task<(PlanningCycleDto Cycle, ShoppingListItemDto Item)> Prepare()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto { StartDate = new(2026, 1, 1), EndDate = new(2026, 1, 7) });
        var cycle = (await response.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
        return (cycle, await AddItem(cycle.Id, "Woknoedels", 2));
    }
    private async Task<ShoppingListItemDto> AddItem(Guid cycle, string name, int quantity = 1) =>
        (await (await HttpClient.PostAsJsonAsync($"/api/shopping-lists/cycle/{cycle}/items", new AddManualShoppingListItemDto { Name = name, Quantity = quantity })).Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;
    private Task<SupermarketReviewDto?> Review(Guid id) => HttpClient.GetFromJsonAsync<SupermarketReviewDto>($"/api/supermarkets/cycles/{id}/review?provider=picnic", JsonOptions);
    private static SendSupermarketDto Selection(SupermarketReviewDto review, string product = "s1001") => new()
    {
        Provider = review.Provider,
        AccountId = review.AccountId,
        ConnectionGeneration = review.ConnectionGeneration,
        Revision = review.Revision,
        Items = review.Items.Select(x => new SupermarketSelectionDto
        {
            ShoppingListItemId = x.ShoppingListItemId,
            ProductId = product,
            Quantity = x.Quantity,
            Remember = false,
        }).ToList(),
        Totals = [new() { ProductId = product, Quantity = review.Items.Sum(x => x.Quantity) }],
    };
    private async Task<SupermarketSendDto> Send(Guid cycle, SendSupermarketDto command)
    {
        var response = await HttpClient.PostAsJsonAsync($"/api/supermarkets/cycles/{cycle}/send", command);
        response.EnsureSuccessStatusCode();
        return (await response.Content.ReadFromJsonAsync<SupermarketSendDto>(JsonOptions))!;
    }
    private async Task<List<ShoppingListItemDto>> Groceries(Guid cycle) => (await HttpClient.GetFromJsonAsync<ShoppingListDto>($"/api/shopping-lists/cycle/{cycle}", JsonOptions))!.Items.ToList();
    private async Task<PicnicSettings> Settings()
    {
        using var scope = Factory.Services.CreateScope();
        return ProviderSettingsStore.Picnic(await scope.ServiceProvider.GetRequiredService<ProviderSettingsStore>().Read(SupermarketProvider.Picnic, default));
    }
    private async Task<(RecipeProfileDto Profile, Guid MealId, Guid RecipeId)> AddProfileMeal(PlanningCycleDto cycle, DateOnly? date = null)
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", new CreateRecipeDto { Name = "Noodles", Category = RecipeCategory.Meals, BaseServings = 2, Tags = [], Ingredients = [], Steps = [] });
        var recipe = (await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        var profileResponse = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{recipe.Profiles.Single().Id}", new UpdateRecipeProfileDto { Name = "Default", Servings = 2, Groceries = [new() { Id = Guid.Empty, Name = "Woknoedels", Quantity = 2, AtHome = false }] });
        var profile = (await profileResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;
        var mealPlan = await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{cycle.Id}", JsonOptions);
        var mealResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto { MealPlanId = mealPlan!.Id, RecipeId = recipe.Id, RecipeProfileId = profile.Id, Date = date ?? cycle.StartDate });
        var meal = (await mealResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        await MealGroceryReview(meal.Id, profile.Groceries.Single().Id);
        return (profile, meal.Id, recipe.Id);
    }
    private async Task MealGroceryReview(Guid meal, Guid slot) =>
        (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal}/groceries", new ReviewMealGroceriesDto { Groceries = [new() { RecipeProfileGroceryItemId = slot, Name = "Woknoedels", Quantity = 2 }] })).EnsureSuccessStatusCode();

    [Fact]
    public async Task Review_PreservesShoppingListGroupAndReorderedItemOrder()
    {
        await Connect();
        var (cycle, manual) = await Prepare();
        var secondManual = await AddItem(cycle.Id, "Milk");
        await AddProfileMeal(cycle, cycle.StartDate.AddDays(1));
        var (_, earlierMeal, _) = await AddProfileMeal(cycle);
        var addedResponse = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{earlierMeal}/groceries/items",
            new AddManualShoppingListItemDto { Name = "Sauce", Quantity = 1 });
        addedResponse.EnsureSuccessStatusCode();
        var added = (await addedResponse.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;
        var list = (await HttpClient.GetFromJsonAsync<ShoppingListDto>($"/api/shopping-lists/cycle/{cycle.Id}", JsonOptions))!;
        var mealItems = list.MealGroups.Single(x => x.Meal.Id == earlierMeal).Items;
        (await HttpClient.PutAsJsonAsync($"/api/shopping-lists/{list.Id}/items/order",
            new UpdateShoppingListItemOrderDto { PlannedMealId = earlierMeal, ItemIds = [added.Id, mealItems.First(x => x.Id != added.Id).Id] })).EnsureSuccessStatusCode();
        (await HttpClient.PutAsJsonAsync($"/api/shopping-lists/{list.Id}/items/order",
            new UpdateShoppingListItemOrderDto { PlannedMealId = null, ItemIds = [secondManual.Id, manual.Id] })).EnsureSuccessStatusCode();

        list = (await HttpClient.GetFromJsonAsync<ShoppingListDto>($"/api/shopping-lists/cycle/{cycle.Id}", JsonOptions))!;
        var expected = list.MealGroups.SelectMany(x => x.Items).Concat(list.Items).Select(x => x.Id).ToArray();
        Assert.Equal(added.Id, expected[0]);
        Assert.Equal([secondManual.Id, manual.Id], expected.TakeLast(2));
        Assert.Equal(expected, (await Review(cycle.Id))!.Items.Select(x => x.ShoppingListItemId));
    }

    [Fact]
    public async Task Setup_StoresOneProtectedRuntimeDocument_AndExposesOnlySafeDtos()
    {
        await Connect(); await Connect();
        using var scope = Factory.Services.CreateScope();
        var records = await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().AppSettings.Where(x => x.Key == "Supermarkets:picnic").ToListAsync();
        var json = Assert.Single(records).Value;
        Assert.DoesNotContain("verified-", json); Assert.DoesNotContain("Picnic123", json);
        Assert.DoesNotContain("ApiVersion", json); Assert.DoesNotContain("Timeout", json);
        Assert.Equal("Connected", (await Settings()).Status);
        foreach (var route in new[] { "/api/config", "/api/supermarkets", "/api/integrations/picnic/connection" })
        {
            var body = await HttpClient.GetStringAsync(route);
            Assert.DoesNotContain("protectedToken", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("isMock", body, StringComparison.OrdinalIgnoreCase);
            Assert.DoesNotContain("verified-", body);
        }
        Assert.Contains("user/2fa/verify", Mock.Requests);
    }

    [Fact]
    public async Task Verification_WrongCodeCooldownExpiryAndOwnershipAreEnforced()
    {
        (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/connect", new ConnectPicnicDto { Email = PicnicMockHandler.Email, Password = PicnicMockHandler.Password })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/verify", new VerifyPicnicDto { Code = "000000" })).StatusCode);
        (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/verification-code", new { })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/verification-code", new { })).StatusCode);
        await UpdateSettings(x => x with { VerificationUserId = Guid.NewGuid() });
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/verify", new VerifyPicnicDto { Code = PicnicMockHandler.Code })).StatusCode);
        await Connect();
        (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/connect", new ConnectPicnicDto { Email = PicnicMockHandler.Email, Password = PicnicMockHandler.Password })).EnsureSuccessStatusCode();
        await UpdateSettings(x => x with { VerificationExpiresAt = DateTime.UtcNow.AddMinutes(-1) });
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/verify", new VerifyPicnicDto { Code = PicnicMockHandler.Code })).StatusCode);
    }
    private async Task UpdateSettings(Func<PicnicSettings, PicnicSettings> update)
    {
        using var scope = Factory.Services.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<ProviderSettingsStore>();
        var json = await store.Read(SupermarketProvider.Picnic, default);
        await store.Write(SupermarketProvider.Picnic, json, update(ProviderSettingsStore.Picnic(json)), default);
    }

    [Fact]
    public async Task MultipleRejections_DoNotHideOrPreventSuccessfulAdditions()
    {
        await Connect(); var (cycle, first) = await Prepare();
        var second = await AddItem(cycle.Id, "Rejected"); var third = await AddItem(cycle.Id, "Rejected twice"); var fourth = await AddItem(cycle.Id, "Milk");
        var review = (await Review(cycle.Id))!;
        var command = Selection(review) with
        {
            Items = [new SupermarketSelectionDto { ShoppingListItemId = first.Id, ProductId = "s1001", Quantity = 2, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = second.Id, ProductId = "s-rejected", Quantity = 1, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = third.Id, ProductId = "s-rejected-two", Quantity = 1, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = fourth.Id, ProductId = "s1003", Quantity = 1, Remember = false }],
            Totals = [new SupermarketQuantityDto { ProductId = "s1001", Quantity = 2 }, new SupermarketQuantityDto { ProductId = "s-rejected", Quantity = 1 }, new SupermarketQuantityDto { ProductId = "s-rejected-two", Quantity = 1 }, new SupermarketQuantityDto { ProductId = "s1003", Quantity = 1 }],
        };
        var send = await Send(cycle.Id, command);
        Assert.Equal(new[] { "Added", "Failed", "Failed", "Added" }, send.Lines.Select(x => x.Outcome));
        Assert.All(send.Lines.Where(x => x.Outcome == "Failed"), x => Assert.Equal("Rejected", x.Reason));
        Assert.Equal(2, Mock.AdditionCount);
        Assert.True((await Groceries(cycle.Id)).Single(x => x.Id == first.Id).Checked);
        Assert.False((await Groceries(cycle.Id)).Single(x => x.Id == second.Id).Checked);
        var fresh = (await Review(cycle.Id))!;
        var retry = Selection(fresh, "s1003") with { Items = [new SupermarketSelectionDto { ShoppingListItemId = second.Id, ProductId = "s1003", Quantity = 1, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = third.Id, ProductId = "s1003", Quantity = 1, Remember = false }], Totals = [new SupermarketQuantityDto { ProductId = "s1003", Quantity = 2 }] };
        Assert.Equal("Added", (await Send(cycle.Id, retry)).Lines.Single().Outcome);
        Assert.Equal(3, Mock.AdditionCount);
        Assert.DoesNotContain("cart", Mock.Requests);
    }

    [Fact]
    public async Task Unknown_StopsRemainingProducts_WithoutAutomaticRetry()
    {
        await Connect(); var (cycle, first) = await Prepare(); var second = await AddItem(cycle.Id, "Maybe"); var third = await AddItem(cycle.Id, "Remaining");
        var review = (await Review(cycle.Id))!;
        var send = await Send(cycle.Id, Selection(review) with
        {
            Items = [new SupermarketSelectionDto { ShoppingListItemId = first.Id, ProductId = "s1001", Quantity = 2, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = second.Id, ProductId = "s-uncertain", Quantity = 1, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = third.Id, ProductId = "s1003", Quantity = 1, Remember = false }],
            Totals = [new SupermarketQuantityDto { ProductId = "s1001", Quantity = 2 }, new SupermarketQuantityDto { ProductId = "s-uncertain", Quantity = 1 }, new SupermarketQuantityDto { ProductId = "s1003", Quantity = 1 }],
        });
        Assert.Equal(new[] { "Added", "Unknown", "NotAttempted" }, send.Lines.Select(x => x.Outcome));
        Assert.Equal(2, Mock.AdditionCount); Assert.Equal(2, Mock.Requests.Count(x => x == "cart/add_product"));
        Assert.False((await Groceries(cycle.Id)).Single(x => x.Id == second.Id).Checked);
        Assert.Equal(HttpStatusCode.MethodNotAllowed, (await HttpClient.GetAsync($"/api/supermarkets/cycles/{cycle.Id}/send")).StatusCode);
    }

    [Fact]
    public async Task ChangedSourceDuringAddition_IsNotChecked()
    {
        await Connect(); var (cycle, item) = await Prepare();
        Mock.AfterAddition = async () => (await HttpClient.PutAsJsonAsync($"/api/shopping-lists/{item.Id}", new UpdateShoppingListItemDto { Name = "Changed", Quantity = 1, Checked = false })).EnsureSuccessStatusCode();
        Assert.Equal("Added", (await Send(cycle.Id, Selection((await Review(cycle.Id))!))).Lines.Single().Outcome);
        Assert.False((await Groceries(cycle.Id)).Single().Checked);
    }

    [Fact]
    public async Task StaleUnavailableUnknownAndInvalidQuantitiesFailBeforeAdding()
    {
        await Connect(); var (cycle, item) = await Prepare(); var review = (await Review(cycle.Id))!;
        var commands = new[]
        {
            Selection(review) with { Items = [], Totals = [] }, Selection(review, "missing"), Selection(review, "s1004"),
            Selection(review) with { Totals = [new SupermarketQuantityDto { ProductId = "s1001", Quantity = 21 }] },
            Selection(review) with { Items = [new SupermarketSelectionDto { ShoppingListItemId = item.Id, ProductId = "s1001", Quantity = 0, Remember = false }] },
            Selection(review) with { Items = [new SupermarketSelectionDto { ShoppingListItemId = item.Id, ProductId = "s1001", Quantity = 2, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = item.Id, ProductId = "s1001", Quantity = 2, Remember = false }] },
        };
        foreach (var command in commands) Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync($"/api/supermarkets/cycles/{cycle.Id}/send", command)).StatusCode);
        (await HttpClient.PutAsJsonAsync($"/api/shopping-lists/{item.Id}", new UpdateShoppingListItemDto { Name = "Changed", Quantity = 1, Checked = false })).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync($"/api/supermarkets/cycles/{cycle.Id}/send", Selection(review))).StatusCode);
        Assert.Equal(0, Mock.AdditionCount);
    }

    [Fact]
    public async Task RefreshAllowsAnotherExplicitSend_AndHistoricalCheckedItemsCanSend()
    {
        await Connect(); var (cycle, _) = await Prepare();
        await Send(cycle.Id, Selection((await Review(cycle.Id))!));
        (await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto { StartDate = cycle.EndDate.AddDays(1), EndDate = cycle.EndDate.AddDays(7) })).EnsureSuccessStatusCode();
        Assert.True((await Review(cycle.Id))!.Items.Single().Checked);
        await Send(cycle.Id, Selection((await Review(cycle.Id))!));
        Assert.Equal(2, Mock.AdditionCount);
    }

    [Fact]
    public async Task ProfileMapping_InitialChoiceIsAutomatic_ReplacementOptOutSurvivesFailedSelection()
    {
        await Connect(); var (cycle, manual) = await Prepare();
        (await HttpClient.DeleteAsync($"/api/shopping-lists/{manual.Id}")).EnsureSuccessStatusCode();
        var (profile, _, _) = await AddProfileMeal(cycle);
        await Send(cycle.Id, Selection((await Review(cycle.Id))!));
        var mappedProduct = (await Review(cycle.Id))!.Items.Single().Product!;
        Assert.Equal("s1001", mappedProduct.Id);
        Assert.Equal("Picnic Woknoedels", mappedProduct.Name);
        Assert.Equal("250 g", mappedProduct.Pack);
        var failed = Selection((await Review(cycle.Id))!, "s-rejected") with { Items = (await Review(cycle.Id))!.Items.Select(x => new SupermarketSelectionDto { ShoppingListItemId = x.ShoppingListItemId, ProductId = "s-rejected", Quantity = 2, Remember = true }).ToList() };
        Assert.Equal("Failed", (await Send(cycle.Id, failed)).Lines.Single().Outcome);
        await Send(cycle.Id, Selection((await Review(cycle.Id))!, "s1002"));
        Assert.Equal("s1001", (await Review(cycle.Id))!.Items.Single().Product!.Id);
        Assert.Equal(2, (await HttpClient.GetFromJsonAsync<RecipeProfileDto>($"/api/recipe-profiles/{profile.Id}", JsonOptions))!.Groceries.Single().Quantity);
    }

    [Fact]
    public async Task RepeatedProfileConflict_AccountsForAutomaticFirstTimeRemembering()
    {
        await Connect(); var (cycle, manual) = await Prepare();
        (await HttpClient.DeleteAsync($"/api/shopping-lists/{manual.Id}")).EnsureSuccessStatusCode();
        var (profile, _, recipeId) = await AddProfileMeal(cycle);
        var mealPlan = await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{cycle.Id}", JsonOptions);
        var response = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto { MealPlanId = mealPlan!.Id, RecipeId = recipeId, RecipeProfileId = profile.Id, Date = cycle.StartDate.AddDays(1) });
        await MealGroceryReview((await response.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!.Id, profile.Groceries.Single().Id);
        var review = (await Review(cycle.Id))!;
        var ids = review.Items.Select(x => x.ShoppingListItemId).ToArray();
        var bad = Selection(review) with { Items = [new SupermarketSelectionDto { ShoppingListItemId = ids[0], ProductId = "s1001", Quantity = 2, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = ids[1], ProductId = "s1002", Quantity = 2, Remember = false }], Totals = [new SupermarketQuantityDto { ProductId = "s1001", Quantity = 2 }, new SupermarketQuantityDto { ProductId = "s1002", Quantity = 2 }] };
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync($"/api/supermarkets/cycles/{cycle.Id}/send", bad)).StatusCode);
        var send = await Send(cycle.Id, Selection(review));
        Assert.Equal(4, send.Lines.Single().Quantity);
        using var scope = Factory.Services.CreateScope();
        Assert.Single(await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().SupermarketProductMappings.ToListAsync());
        var replacement = Selection((await Review(cycle.Id))!, "s1002");
        replacement = replacement with { Items = replacement.Items.Select(x => x with { Remember = true }).ToList() };
        Assert.Null((await Send(cycle.Id, replacement)).Lines.Single().LocalWarning);
        Assert.All((await Review(cycle.Id))!.Items, x => Assert.Equal("s1002", x.Product!.Id));
    }

    [Fact]
    public async Task AcknowledgedAddition_LocalSaveFailureRemainsAddedAndStopsRemainingProducts()
    {
        await Connect(); var (cycle, first) = await Prepare(); var second = await AddItem(cycle.Id, "Milk");
        Mock.AfterAddition = async () =>
        {
            using var scope = Factory.Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.ExecuteSqlRawAsync(
                "CREATE TRIGGER fail_grocery_update BEFORE UPDATE ON ShoppingListItem BEGIN SELECT RAISE(ABORT, 'test persistence failure'); END");
        };
        try
        {
            var send = await Send(cycle.Id, Selection((await Review(cycle.Id))!) with
            { Items = [new SupermarketSelectionDto { ShoppingListItemId = first.Id, ProductId = "s1001", Quantity = 2, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = second.Id, ProductId = "s1003", Quantity = 1, Remember = false }], Totals = [new SupermarketQuantityDto { ProductId = "s1001", Quantity = 2 }, new SupermarketQuantityDto { ProductId = "s1003", Quantity = 1 }] });
            Assert.Equal(new[] { "Added", "NotAttempted" }, send.Lines.Select(x => x.Outcome));
            Assert.Equal("LocalPersistence", send.Lines.First().LocalWarning);
            Assert.Equal(1, Mock.AdditionCount);
            Assert.False((await Groceries(cycle.Id)).Single(x => x.Id == first.Id).Checked);
        }
        finally
        {
            using var scope = Factory.Services.CreateScope();
            await scope.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.ExecuteSqlRawAsync("DROP TRIGGER IF EXISTS fail_grocery_update");
        }
    }

    [Fact]
    public async Task LateTokenRotation_CannotRestoreReplacedConnectionAfterAcknowledgement()
    {
        await Connect(); var (cycle, _) = await Prepare(); Mock.RotateTokens = true;
        Mock.AfterAddition = () => UpdateSettings(x => new PicnicSettings { CountryCode = x.CountryCode });
        var send = await Send(cycle.Id, Selection((await Review(cycle.Id))!));
        Assert.Equal("Added", send.Lines.Single().Outcome);
        Assert.Equal("LocalPersistence", send.Lines.Single().LocalWarning);
        Assert.Equal("Disconnected", (await Settings()).Status);
        Assert.Null((await Settings()).ProtectedToken);
        Assert.Equal(1, Mock.AdditionCount);
    }

    [Fact]
    public async Task Rotation_ConcurrentSearchesUseFreshTokens_AndDoNotSaveCallerChanges()
    {
        await Connect(); var (cycle, _) = await Prepare(); Mock.RotateTokens = true;
        var initial = (await Settings()).ProtectedToken;
        using var scope = Factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        (await db.PlanningCycles.SingleAsync()).StartDate = new(2030, 1, 1);
        var queries = scope.ServiceProvider.GetRequiredService<SupermarketQueries>();
        await queries.Search(SupermarketProvider.Picnic, "wok", default);
        Assert.NotEqual(initial, (await Settings()).ProtectedToken);
        var searches = await Task.WhenAll(HttpClient.GetAsync("/api/supermarkets/picnic/products?query=wok"), HttpClient.GetAsync("/api/supermarkets/picnic/products?query=melk"));
        Assert.All(searches, x => x.EnsureSuccessStatusCode());
        Assert.Equal(cycle.StartDate, (await HttpClient.GetFromJsonAsync<PlanningCycleDto>($"/api/planning-cycles/{cycle.Id}", JsonOptions))!.StartDate);
    }

    [Fact]
    public async Task ConnectionGenerationRejectsOldReviews_AndCountryChangeRequiresExplicitReset()
    {
        await Connect(); var (cycle, _) = await Prepare(); var old = (await Review(cycle.Id))!;
        await Connect("other@example.test");
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync($"/api/supermarkets/cycles/{cycle.Id}/send", Selection(old))).StatusCode);
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.PostAsJsonAsync("/api/integrations/picnic/connect", new ConnectPicnicDto { Email = PicnicMockHandler.Email, Password = PicnicMockHandler.Password, CountryCode = "DE" })).StatusCode);
        await Connect(country: "DE", reset: true);
        Assert.Equal("DE", (await Settings()).CountryCode);
        Assert.Equal(0, Mock.AdditionCount);
    }

    [Fact]
    public async Task ExpiredSessionDuringBatch_PreservesSuccessAndStopsFurtherAdditions()
    {
        await Connect(); var (cycle, first) = await Prepare(); var second = await AddItem(cycle.Id, "Milk"); var third = await AddItem(cycle.Id, "Rice");
        Mock.AfterAddition = () => UpdateSettings(x => x with { ProtectedToken = Factory.Services.GetRequiredService<PicnicSessions>().Protect("expired") });
        var send = await Send(cycle.Id, Selection((await Review(cycle.Id))!) with
        { Items = [new SupermarketSelectionDto { ShoppingListItemId = first.Id, ProductId = "s1001", Quantity = 2, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = second.Id, ProductId = "s1003", Quantity = 1, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = third.Id, ProductId = "s1002", Quantity = 1, Remember = false }], Totals = [new SupermarketQuantityDto { ProductId = "s1001", Quantity = 2 }, new SupermarketQuantityDto { ProductId = "s1003", Quantity = 1 }, new SupermarketQuantityDto { ProductId = "s1002", Quantity = 1 }] });
        Assert.Equal(new[] { "Added", "Failed", "NotAttempted" }, send.Lines.Select(x => x.Outcome));
        Assert.Equal("SessionExpired", send.Lines[1].Reason);
        Assert.Equal("ReconnectRequired", (await Settings()).Status);
        Assert.Equal(1, Mock.AdditionCount);
    }

    [Fact]
    public async Task DisconnectDuringBatch_StopsBeforeNextAddition()
    {
        await Connect(); var (cycle, first) = await Prepare(); var second = await AddItem(cycle.Id, "Milk");
        Mock.AfterAddition = () => UpdateSettings(x => new PicnicSettings { CountryCode = x.CountryCode });
        var send = await Send(cycle.Id, Selection((await Review(cycle.Id))!) with { Items = [new SupermarketSelectionDto { ShoppingListItemId = first.Id, ProductId = "s1001", Quantity = 2, Remember = false }, new SupermarketSelectionDto { ShoppingListItemId = second.Id, ProductId = "s1003", Quantity = 1, Remember = false }], Totals = [new SupermarketQuantityDto { ProductId = "s1001", Quantity = 2 }, new SupermarketQuantityDto { ProductId = "s1003", Quantity = 1 }] });
        Assert.Equal(new[] { "Added", "NotAttempted" }, send.Lines.Select(x => x.Outcome));
        Assert.Equal(1, Mock.AdditionCount);
    }

    [Fact]
    public async Task CorruptDocumentAndLostKeys_CanBeResetThroughSettings()
    {
        await Connect();
        await UpdateSettings(x => x with { ProtectedToken = "unreadable" });
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.GetAsync("/api/supermarkets/picnic/products?query=wok")).StatusCode);
        using (var scope = Factory.Services.CreateScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await db.AppSettings.Where(x => x.Key == "Supermarkets:picnic").ExecuteUpdateAsync(x => x.SetProperty(s => s.Value, "{"));
        }
        Assert.Equal(HttpStatusCode.BadRequest, (await HttpClient.GetAsync("/api/integrations/picnic/connection")).StatusCode);
        (await HttpClient.DeleteAsync("/api/integrations/picnic/connection")).EnsureSuccessStatusCode();
        await Connect();
    }

    [Fact]
    public async Task SetupIsAdminOnly_ButHouseholdMembersCanSend()
    {
        Assert.Equal(HttpStatusCode.Unauthorized, (await CreateUnauthenticatedApiClient().GetAsync("/api/supermarkets")).StatusCode);
        (await HttpClient.PostAsJsonAsync("/api/users", new CreateUserDto { Email = "member@example.test", DisplayName = "Member", Password = "Member123!", IsAdmin = false })).EnsureSuccessStatusCode();
        var member = await CreateUserApiClient(new LoginDto { Email = "member@example.test", Password = "Member123!" });
        Assert.Equal(HttpStatusCode.Forbidden, (await member.PostAsJsonAsync("/api/integrations/picnic/connect", new ConnectPicnicDto { Email = PicnicMockHandler.Email, Password = PicnicMockHandler.Password })).StatusCode);
        await Connect(); var (cycle, _) = await Prepare();
        (await member.PostAsJsonAsync($"/api/supermarkets/cycles/{cycle.Id}/send", Selection((await Review(cycle.Id))!))).EnsureSuccessStatusCode();
    }
}
