using System.Net;
using System.Net.Http.Json;
using System.Net.Http.Headers;
using MealManager.Application.DTO;
using MealManager.Application.Mapping;
using MealManager.Common.Enums;
using MealManager.Domain.Contracts;
using MealManager.Tests.Integration.Configuration;
using Microsoft.AspNetCore.Mvc;
using ImageMagick;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public partial class RecipeControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private static CreateRecipeDto CreateTestRecipe(string name = "Test Recipe") => new()
    {
        Name = name,
        Category = RecipeCategory.Meals,
        BaseServings = 2,
        Tags = ["quick", "easy"],
        Ingredients =
        [
            new RecipeIngredientInputDto { Id = Guid.Empty, Name = "Chicken", Quantity = 500, Unit = "g"},
            new RecipeIngredientInputDto { Id = Guid.Empty, Name = "Rice",    Quantity = 200, Unit = "g"},
        ],
        Steps =
        [
            new RecipeStepInputDto { Id = Guid.Empty, Description = "Cook chicken"},
            new RecipeStepInputDto { Id = Guid.Empty, Description = "Serve with rice"},
        ],
    };

    [Fact]
    public async Task CreateRecipe_ReturnsCreated()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var recipe = await response.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);
        Assert.Equal("Test Recipe", recipe.Name);
        Assert.Equal(RecipeCategory.Meals, recipe.Category);
        Assert.Equal(2, recipe.Ingredients.Count);
        Assert.Collection(
            recipe.Ingredients,
            ingredient => Assert.Equal(("Chicken", 0), (ingredient.Name, ingredient.Order)),
            ingredient => Assert.Equal(("Rice", 1), (ingredient.Name, ingredient.Order)));
        Assert.Equal(2, recipe.Steps.Count);
        var defaultProfile = Assert.Single(recipe.Profiles);
        Assert.Equal("Default", defaultProfile.Name);
        Assert.Equal(recipe.BaseServings, defaultProfile.Servings);
    }

    [Fact]
    public async Task CreateRecipe_AllowsEmptyIngredientsAndSteps()
    {
        var response = await HttpClient.PostAsJsonAsync(
            "/api/recipes",
            CreateTestRecipe("Takeaway night") with { Ingredients = [], Steps = [] });

        response.EnsureSuccessStatusCode();
        var recipe = await response.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);
        Assert.Empty(recipe.Ingredients);
        Assert.Empty(recipe.Steps);
    }

    [Fact]
    public async Task GetRecipes_ReturnsAll()
    {
        await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe("Recipe 1"));
        await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe("Recipe 2"));

        var recipes = await HttpClient.GetFromJsonAsync<RecipeSummaryDto[]>("/api/recipes", JsonOptions);
        Assert.NotNull(recipes);
        Assert.Equal(2, recipes.Length);
    }

    [Fact]
    public async Task GetRecipes_FiltersFavoritesAndReturnsPastPlanningStatistics()
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe("Tomato Pasta"));
        var recipe = (await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        (await HttpClient.PutAsJsonAsync($"/api/recipes/{recipe.Id}/favorite",
            new SetRecipeFavoriteDto { IsFavorite = true })).EnsureSuccessStatusCode();
        await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe("Not a favorite"));

        var today = DateOnly.FromDateTime(DateTime.Today);
        var cycleResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = today,
            EndDate = today,
        });
        var cycle = (await cycleResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
        var mealPlan = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{cycle.Id}", JsonOptions))!;
        (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = Assert.Single(recipe.Profiles).Id,
            Date = today,
        })).EnsureSuccessStatusCode();

        var discovered = await HttpClient.GetFromJsonAsync<RecipeSearchResultDto[]>(
            "/api/recipes?favorite=true&sort=LeastPlanned", JsonOptions);

        var result = Assert.Single(discovered!);
        Assert.Equal(recipe.Id, result.Id);
        Assert.Equal(1, result.PastTimesPlanned);
        Assert.Equal(today, result.LastPastPlanned);
    }

    [Fact]
    public async Task GetFavoriteRecipes_OrdersByRecentPlanningCountThenName()
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var cycleResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = today.AddDays(-1),
            EndDate = today,
        });
        cycleResponse.EnsureSuccessStatusCode();
        var cycle = (await cycleResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
        var mealPlan = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{cycle.Id}", JsonOptions))!;

        async Task<RecipeDto> CreateFavorite(string name)
        {
            var createResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe(name));
            var recipe = (await createResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
            (await HttpClient.PutAsJsonAsync($"/api/recipes/{recipe.Id}/favorite",
                new SetRecipeFavoriteDto { IsFavorite = true })).EnsureSuccessStatusCode();
            return recipe;
        }

        async Task AddMeal(RecipeDto recipe, DateOnly date)
        {
            var response = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
            {
                MealPlanId = mealPlan.Id,
                RecipeId = recipe.Id,
                RecipeProfileId = Assert.Single(recipe.Profiles).Id,
                Date = date,
            });
            response.EnsureSuccessStatusCode();
        }

        var applePie = await CreateFavorite("Apple Pie");
        var beanSoup = await CreateFavorite("Bean Soup");
        await CreateFavorite("Carrot Soup");
        await AddMeal(applePie, today);
        await AddMeal(beanSoup, today.AddDays(-1));
        await AddMeal(beanSoup, today);

        var favorites = await HttpClient.GetFromJsonAsync<RecipeSummaryDto[]>(
            "/api/recipes?favorite=true&sort=RecentPlanningPopularity", JsonOptions);

        Assert.NotNull(favorites);
        Assert.Equal(["Bean Soup", "Apple Pie", "Carrot Soup"], favorites.Select(recipe => recipe.Name));
    }

    [Fact]
    public async Task OthersCategory_CanBeCreatedAndFiltered()
    {
        var response = await HttpClient.PostAsJsonAsync(
            "/api/recipes",
            CreateTestRecipe("Pepper Sauce") with { Category = RecipeCategory.Other });
        response.EnsureSuccessStatusCode();

        var created = await response.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.Equal(RecipeCategory.Other, created.Category);

        var recipes = await HttpClient.GetFromJsonAsync<RecipeSummaryDto[]>(
            "/api/recipes?category=Other",
            JsonOptions);
        Assert.NotNull(recipes);
        Assert.Equal(created.Id, Assert.Single(recipes).Id);
    }

    [Fact]
    public async Task GetRecipe_ReturnsById()
    {
        var addResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var created = await addResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(created);

        var recipe = await HttpClient.GetFromJsonAsync<RecipeDetailsDto>($"/api/recipes/{created.Id}", JsonOptions);
        Assert.NotNull(recipe);
        Assert.Equal(created.Id, recipe.Id);
        Assert.Equal("Test Recipe", recipe.Name);
        Assert.Equal(0, recipe.PlanningStatistics.TimesPlanned);
        Assert.Null(recipe.PlanningStatistics.LastPlanned);
    }

    [Fact]
    public async Task GetRecipe_NotFound_Returns404()
    {
        var response = await HttpClient.GetAsync($"/api/recipes/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRecipe_UpdatesFields()
    {
        var addResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var created = await addResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(created);

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/recipes/{created.Id}", CreateTestRecipe("Updated Recipe"));
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal("Updated Recipe", updated.Name);
    }

    [Fact]
    public async Task UpdateRecipe_UpdatesExistingIngredientsAndSteps()
    {
        var addResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var created = await addResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(created);

        var update = CreateTestRecipe() with
        {
            Ingredients =
            [
                created.Ingredients.ToArray()[1].ToInput(),
                created.Ingredients.ToArray()[0].ToInput() with { Name = "Updated Chicken", Quantity = 750 },
            ],
            Steps =
            [
                created.Steps.ToArray()[1].ToInput(),
                created.Steps.ToArray()[0].ToInput() with { Description = "Updated cooking step" },
            ],
        };

        var updateResponse = await HttpClient.PutAsJsonAsync($"/api/recipes/{created.Id}", update);
        updateResponse.EnsureSuccessStatusCode();

        var persisted = await HttpClient.GetFromJsonAsync<RecipeDto>($"/api/recipes/{created.Id}", JsonOptions);
        Assert.NotNull(persisted);
        Assert.Contains(persisted.Ingredients, ingredient => ingredient.Name == "Updated Chicken" && ingredient.Quantity == 750);
        Assert.Collection(
            persisted.Ingredients,
            ingredient => Assert.Equal(("Rice", 0), (ingredient.Name, ingredient.Order)),
            ingredient => Assert.Equal(("Updated Chicken", 1), (ingredient.Name, ingredient.Order)));
        Assert.Contains(persisted.Steps, step => step.Description == "Updated cooking step" && step.Order == 1);
    }

    [Fact]
    public async Task CreateRecipe_PreservesDecimalIngredientQuantity()
    {
        var recipe = CreateTestRecipe() with
        {
            Ingredients = [new RecipeIngredientInputDto { Id = Guid.Empty, Name = "Flour", Quantity = 125.5m, Unit = "g" }],
        };

        var response = await HttpClient.PostAsJsonAsync("/api/recipes", recipe);
        response.EnsureSuccessStatusCode();

        var created = await response.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(created);
        Assert.Equal(125.5m, Assert.Single(created.Ingredients).Quantity);
    }

    [Fact]
    public async Task RecipeImages_CanBeUploadedReorderedReadAndDeleted()
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);

        var firstImage = await UploadImageAsync(recipe.Id);
        var secondImage = await UploadImageAsync(recipe.Id);
        Assert.Equal(0, firstImage.Order);
        Assert.Equal(1, secondImage.Order);

        var imageResponse = await HttpClient.GetAsync(firstImage.Url);
        imageResponse.EnsureSuccessStatusCode();
        Assert.Equal("image/jpeg", imageResponse.Content.Headers.ContentType?.MediaType);
        Assert.NotEmpty(await imageResponse.Content.ReadAsByteArrayAsync());

        var reorderResponse = await HttpClient.PutAsJsonAsync(
            $"/api/recipes/{recipe.Id}/images/order",
            new UpdateRecipeImageOrderDto { ImageIds = [secondImage.Id, firstImage.Id] });
        reorderResponse.EnsureSuccessStatusCode();

        var reloaded = await HttpClient.GetFromJsonAsync<RecipeDto>($"/api/recipes/{recipe.Id}", JsonOptions);
        Assert.NotNull(reloaded);
        Assert.Equal([secondImage.Id, firstImage.Id], reloaded.Images.Select(image => image.Id));
        Assert.Equal([0, 1], reloaded.Images.Select(image => image.Order));

        var deleteResponse = await HttpClient.DeleteAsync($"/api/recipes/{recipe.Id}/images/{secondImage.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var afterDelete = await HttpClient.GetFromJsonAsync<RecipeDto>($"/api/recipes/{recipe.Id}", JsonOptions);
        Assert.NotNull(afterDelete);
        var remainingImage = Assert.Single(afterDelete.Images);
        Assert.Equal(firstImage.Id, remainingImage.Id);
        Assert.Equal(0, remainingImage.Order);
        Assert.Equal(HttpStatusCode.NotFound, (await HttpClient.GetAsync(secondImage.Url)).StatusCode);
    }

    [Fact]
    public async Task AddRecipeImage_HeicContent_IsNormalizedAndReturnedAsJpeg()
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);

        using var content = new MultipartFormDataContent();
        await using var stream = File.OpenRead(Path.Combine(AppContext.BaseDirectory, "Fixtures", "image4.heic"));
        using var image = new StreamContent(stream);
        image.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        content.Add(image, "image", "misreported.jpg");

        var uploadResponse = await HttpClient.PostAsync($"/api/recipes/{recipe.Id}/images", content);
        var responseBody = await uploadResponse.Content.ReadAsStringAsync();
        Assert.True(uploadResponse.IsSuccessStatusCode, $"Status: {uploadResponse.StatusCode}, Body: {responseBody}");
        var uploaded = System.Text.Json.JsonSerializer.Deserialize<RecipeImageDto>(responseBody, JsonOptions);
        Assert.NotNull(uploaded);

        var imageResponse = await HttpClient.GetAsync(uploaded.Url);
        imageResponse.EnsureSuccessStatusCode();
        Assert.Equal("image/jpeg", imageResponse.Content.Headers.ContentType?.MediaType);

        await using var normalizedStream = await imageResponse.Content.ReadAsStreamAsync();
        using var normalized = new MagickImage(normalizedStream);
        Assert.Equal(700U, normalized.Width);
        Assert.Equal(476U, normalized.Height);
        using var pixels = normalized.GetPixels();
        var centerPixel = pixels.GetPixel((int)normalized.Width / 2, (int)normalized.Height / 2).ToColor()!;
        Assert.True(centerPixel.R + centerPixel.G + centerPixel.B > 30, "The normalized image should contain visible RGB content.");
    }

    [Theory]
    [InlineData(MagickFormat.Jpeg)]
    [InlineData(MagickFormat.Png)]
    [InlineData(MagickFormat.WebP)]
    [InlineData(MagickFormat.Gif)]
    public async Task AddRecipeImage_StandardFormats_AreResizedAndReturnedAsJpeg(MagickFormat format)
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);
        using var original = new MagickImage(MagickColors.Red, 3200, 1600);
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(original.ToByteArray(format)), "image", "upload.dat");
        var upload = await HttpClient.PostAsync($"/api/recipes/{recipe.Id}/images", content);
        upload.EnsureSuccessStatusCode();
        var stored = await upload.Content.ReadFromJsonAsync<RecipeImageDto>(JsonOptions);
        Assert.NotNull(stored);
        var response = await HttpClient.GetAsync(stored.Url);
        Assert.Equal("image/jpeg", response.Content.Headers.ContentType?.MediaType);
        using var normalized = new MagickImage(await response.Content.ReadAsByteArrayAsync());
        Assert.Equal(1600U, normalized.Width);
        Assert.Equal(800U, normalized.Height);
        Assert.Empty(normalized.ProfileNames);
    }

    [Fact]
    public async Task AddRecipeImage_Transparency_IsFlattenedWithoutUpscaling()
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);
        using var original = new MagickImage(MagickColors.Transparent, 20, 10);
        using var content = new MultipartFormDataContent();
        content.Add(new ByteArrayContent(original.ToByteArray(MagickFormat.Png)), "image", "transparent.png");
        var upload = await HttpClient.PostAsync($"/api/recipes/{recipe.Id}/images", content);
        upload.EnsureSuccessStatusCode();
        var stored = await upload.Content.ReadFromJsonAsync<RecipeImageDto>(JsonOptions);
        Assert.NotNull(stored);
        using var normalized = new MagickImage(await HttpClient.GetByteArrayAsync(stored.Url));
        Assert.Equal(20U, normalized.Width);
        Assert.Equal(10U, normalized.Height);
        using var pixels = normalized.GetPixels();
        var color = pixels.GetPixel(0, 0).ToColor()!;
        Assert.True(color.R > 250 && color.G > 250 && color.B > 250);
    }

    [Fact]
    public async Task AddRecipeImage_MalformedHeicImage_ReturnsBadRequest()
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);

        using var content = new MultipartFormDataContent();
        using var image = new ByteArrayContent(
        [
            0, 0, 0, 16,
            (byte)'f', (byte)'t', (byte)'y', (byte)'p',
            (byte)'h', (byte)'e', (byte)'i', (byte)'c',
            0, 0, 0, 0,
        ]);
        image.Headers.ContentType = new MediaTypeHeaderValue("image/heic");
        content.Add(image, "image", "malformed.heic");

        var response = await HttpClient.PostAsync($"/api/recipes/{recipe.Id}/images", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var problem = await response.Content.ReadFromJsonAsync<ProblemDetails>(JsonOptions);
        Assert.Equal(
            "We couldn't read this image. Choose a JPEG, PNG, WebP, GIF, HEIC, or HEIF image, or export it as JPEG.",
            problem?.Detail);
    }

    [Fact]
    public async Task DeleteRecipe_RemovesRecipeAndStoredImages()
    {
        var addResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var created = await addResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(created);

        var imageRoot = Path.Combine(AppContext.BaseDirectory, "data", "recipe-images");
        var filesBeforeUpload = Directory.GetFiles(imageRoot).ToHashSet();
        await UploadImageAsync(created.Id);
        var uploadedFile = Assert.Single(Directory.GetFiles(imageRoot), path => !filesBeforeUpload.Contains(path));

        var deleteResponse = await HttpClient.DeleteAsync($"/api/recipes/{created.Id}");
        Assert.Equal(HttpStatusCode.NoContent, deleteResponse.StatusCode);

        var getResponse = await HttpClient.GetAsync($"/api/recipes/{created.Id}");
        Assert.Equal(HttpStatusCode.NotFound, getResponse.StatusCode);
        Assert.False(File.Exists(uploadedFile));
    }

    [Fact]
    public async Task AddRecipeImage_RejectsFilesLargerThanTenMegabytes()
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);

        using var content = new MultipartFormDataContent();
        using var image = new ByteArrayContent(new byte[IImageStorage.MaximumUploadBytes + 1]);
        image.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
        content.Add(image, "image", "large.jpg");

        var response = await HttpClient.PostAsync($"/api/recipes/{recipe.Id}/images", content);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddRecipe_Validation_EmptyName_ReturnsBadRequest()
    {
        var dto = CreateTestRecipe() with { Name = "" };
        var response = await HttpClient.PostAsJsonAsync("/api/recipes", dto);
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddRecipe_Validation_ZeroBaseServings_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync(
            "/api/recipes",
            CreateTestRecipe() with { BaseServings = 0 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRecipe_MissingRecipe_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsJsonAsync($"/api/recipes/{Guid.NewGuid()}", CreateTestRecipe());

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task SetFavorite_PersistsAndFiltersHouseholdFavorites()
    {
        var firstResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe("Apple Pie"));
        var first = (await firstResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;
        await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe("Bean Soup"));

        var favoriteResponse = await HttpClient.PutAsJsonAsync($"/api/recipes/{first.Id}/favorite",
            new SetRecipeFavoriteDto { IsFavorite = true });
        favoriteResponse.EnsureSuccessStatusCode();
        var favorite = (await favoriteResponse.Content.ReadFromJsonAsync<RecipeSummaryDto>(JsonOptions))!;
        Assert.True(favorite.IsFavorite);

        var favorites = await HttpClient.GetFromJsonAsync<RecipeSummaryDto[]>("/api/recipes?favorite=true", JsonOptions);
        Assert.NotNull(favorites);
        Assert.Equal(first.Id, Assert.Single(favorites).Id);
        Assert.True((await HttpClient.GetFromJsonAsync<RecipeDto>($"/api/recipes/{first.Id}", JsonOptions))!.IsFavorite);

        var removeResponse = await HttpClient.PutAsJsonAsync($"/api/recipes/{first.Id}/favorite",
            new SetRecipeFavoriteDto { IsFavorite = false });
        removeResponse.EnsureSuccessStatusCode();
        Assert.Empty((await HttpClient.GetFromJsonAsync<RecipeSummaryDto[]>("/api/recipes?favorite=true", JsonOptions))!);
    }

    [Fact]
    public async Task SetFavorite_MissingRecipe_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsJsonAsync($"/api/recipes/{Guid.NewGuid()}/favorite",
            new SetRecipeFavoriteDto { IsFavorite = true });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRecipe_AllowsEmptyIngredientsAndSteps()
    {
        var createResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await createResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);

        var response = await HttpClient.PutAsJsonAsync(
            $"/api/recipes/{recipe.Id}",
            CreateTestRecipe() with { Ingredients = [], Steps = [] });

        response.EnsureSuccessStatusCode();
        var updated = await response.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Empty(updated.Ingredients);
        Assert.Empty(updated.Steps);
    }

    [Fact]
    public async Task AddRecipeImage_MissingRecipe_ReturnsNotFound()
    {
        using var content = CreateImageContent();

        var response = await HttpClient.PostAsync($"/api/recipes/{Guid.NewGuid()}/images", content);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task GetRecipeImage_MissingImage_ReturnsNotFound()
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);

        var response = await HttpClient.GetAsync($"/api/recipes/{recipe.Id}/images/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task UpdateRecipeImageOrder_IncompleteOrder_ReturnsBadRequest()
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);
        await UploadImageAsync(recipe.Id);

        var response = await HttpClient.PutAsJsonAsync(
            $"/api/recipes/{recipe.Id}/images/order",
            new UpdateRecipeImageOrderDto { ImageIds = [] });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        await AssertProblemCode(response, "InvalidRecipeImageOrder");
    }

    [Fact]
    public async Task DeleteRecipeImage_MissingImage_ReturnsNotFound()
    {
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", CreateTestRecipe());
        var recipe = await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions);
        Assert.NotNull(recipe);

        var response = await HttpClient.DeleteAsync($"/api/recipes/{recipe.Id}/images/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeleteRecipe_MissingRecipe_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/recipes/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    private static MultipartFormDataContent CreateImageContent()
    {
        var content = new MultipartFormDataContent();
        var image = new ByteArrayContent(Convert.FromBase64String(
            "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="));
        image.Headers.ContentType = new MediaTypeHeaderValue("image/gif");
        content.Add(image, "image", "image.gif");
        return content;
    }

    private async Task<RecipeImageDto> UploadImageAsync(Guid recipeId)
    {
        var content = new MultipartFormDataContent();
        var image = new ByteArrayContent(Convert.FromBase64String(
            "R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="));
        image.Headers.ContentType = new MediaTypeHeaderValue("image/gif");
        content.Add(image, "image", "image.gif");

        var response = await HttpClient.PostAsync($"/api/recipes/{recipeId}/images", content);
        var responseBody = await response.Content.ReadAsStringAsync();
        Assert.True(response.IsSuccessStatusCode, $"Status: {response.StatusCode}, Body: {responseBody}");
        return System.Text.Json.JsonSerializer.Deserialize<RecipeImageDto>(responseBody, JsonOptions)!;
    }
}
