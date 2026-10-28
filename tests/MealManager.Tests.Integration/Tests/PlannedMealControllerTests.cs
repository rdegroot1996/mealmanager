using System.Net;
using System.Net.Http.Json;
using MealManager.Application.DTO;
using MealManager.Common.Enums;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class PlannedMealControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private async Task<(MealPlanDto MealPlan, RecipeDto Recipe, RecipeProfileDto Profile)> SetupAsync()
    {
        // Create a cycle and mealPlan
        var cycleResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 6),
            EndDate = new DateOnly(2025, 1, 12),
        });
        var cycle = (await cycleResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
        var mealPlan = (await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{cycle.Id}", JsonOptions))!;

        // Create a recipe
        var recipeResponse = await HttpClient.PostAsJsonAsync("/api/recipes", new CreateRecipeDto
        {
            Name = "Pasta",
            Category = RecipeCategory.Meals,
            BaseServings = 2,
            Tags = ["italian"],
            Ingredients = [new RecipeIngredientInputDto { Id = Guid.Empty, Name = "Pasta", Quantity = 500, Unit = "g" }],
            Steps = [new RecipeStepInputDto { Id = Guid.Empty, Description = "Boil pasta" }],
        });
        var recipe = (await recipeResponse.Content.ReadFromJsonAsync<RecipeDto>(JsonOptions))!;

        // Create a profile for the recipe
        var profileResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Default",
            Servings = 2,
        });
        var profile = (await profileResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;

        return (mealPlan, recipe, profile);
    }

    [Fact]
    public async Task AddPlannedMeal_CreatesMeal()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();

        var response = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        response.EnsureSuccessStatusCode();

        var meal = await response.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions);
        Assert.NotNull(meal);
        Assert.Equal("Pasta", meal.Recipe.Name);
        Assert.Equal(new DateOnly(2025, 1, 7), meal.Date);
    }

    [Fact]
    public async Task AddPlannedMeal_OutsideCycle_ReturnsBadRequest()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();

        var response = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 20),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task HistoricalPlan_AllowsMealAndGroceryEdits()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        (await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        { StartDate = new DateOnly(2025, 1, 13), EndDate = new DateOnly(2025, 1, 19) })).EnsureSuccessStatusCode();
        var command = new AddPlannedMealDto
        { MealPlanId = mealPlan.Id, RecipeId = recipe.Id, RecipeProfileId = profile.Id, Date = new DateOnly(2025, 1, 7) };
        var added = await HttpClient.PostAsJsonAsync("/api/planned-meals", command);
        added.EnsureSuccessStatusCode();
        var meal = (await added.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        var reviewed = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries", new ReviewMealGroceriesDto { Groceries = [] });
        reviewed.EnsureSuccessStatusCode();
        Assert.Equal(profile.Id, (await reviewed.Content.ReadFromJsonAsync<MealShoppingGroupDto>(JsonOptions))!.Meal.RecipeProfileId);
        (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/leftovers",
            new PlanLeftoversDto { Date = new DateOnly(2025, 1, 8) })).EnsureSuccessStatusCode();
        (await HttpClient.DeleteAsync($"/api/planned-meals/{meal.Id}")).EnsureSuccessStatusCode();
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        Assert.Empty(persisted.Entries);
    }

    [Fact]
    public async Task DeletePlannedMeal_RemovesMeal()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 8),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var deleteResponse = await HttpClient.DeleteAsync($"/api/planned-meals/{meal.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var updatedMealPlan = await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions);
        Assert.NotNull(updatedMealPlan);
        Assert.DoesNotContain(updatedMealPlan.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal), m => m.Id == meal.Id);
    }

    [Fact]
    public async Task DeleteReferencedRecipe_IsRejected()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        addResponse.EnsureSuccessStatusCode();

        var deleteResponse = await HttpClient.DeleteAsync($"/api/recipes/{recipe.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, deleteResponse.StatusCode);
        var planningAfterDelete = await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions);
        Assert.NotNull(planningAfterDelete);
        Assert.Contains(planningAfterDelete.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal), meal => meal.Recipe.Id == recipe.Id);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DeleteLeftover_PreservesOriginalGroceriesAndOtherEntries(bool historical)
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var original = (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        var leftovers = new List<PlannedEntryDto>();
        foreach (var day in new[] { 8, 9 })
        {
            var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{original.Id}/leftovers",
                new PlanLeftoversDto { Date = new DateOnly(2025, 1, day) });
            response.EnsureSuccessStatusCode();
            leftovers.Add((await response.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!);
        }
        var companion = (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{original.Id}/groceries", new ReviewMealGroceriesDto
        {
            Groceries = [new AddShoppingListItemDto { Name = "Pasta", Quantity = 2 }],
        })).EnsureSuccessStatusCode();
        if (historical)
            (await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
            {
                StartDate = new DateOnly(2025, 1, 13),
                EndDate = new DateOnly(2025, 1, 19),
            })).EnsureSuccessStatusCode();

        var deletion = await HttpClient.DeleteAsync($"/api/planned-meals/{leftovers[0].Id}");
        Assert.Equal(HttpStatusCode.NoContent, deletion.StatusCode);
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        Assert.Contains(persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal), item => item.Id == original.Id && item.HasReviewedGroceries);
        Assert.Contains(persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal), item => item.Id == companion.Id && item.SortOrder == 0);
        Assert.Contains(persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Leftover), item => item.Id == leftovers[1].Id);
        Assert.DoesNotContain(persisted.Entries, item => item.Id == leftovers[0].Id);
        var groceries = (await HttpClient.GetFromJsonAsync<MealShoppingGroupDto>(
            $"/api/planned-meals/{original.Id}/groceries", JsonOptions))!;
        Assert.Equal("Pasta", Assert.Single(groceries.Items).Name);
        Assert.Equal(HttpStatusCode.NotFound,
                (await HttpClient.DeleteAsync($"/api/planned-meals/{leftovers[0].Id}")).StatusCode);
    }

    [Fact]
    public async Task PlanLeftovers_Succeeds()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var leftoversResponse = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        });
        leftoversResponse.EnsureSuccessStatusCode();

        var leftovers = await leftoversResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions);
        Assert.NotNull(leftovers);
        Assert.Equal(meal.Id, leftovers.OriginalMealId);
    }

    [Fact]
    public async Task PlanLeftovers_ForSameMealAndDate_ReturnsBadRequest()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        var command = new PlanLeftoversDto { Date = new DateOnly(2025, 1, 8) };

        (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/leftovers", command)).EnsureSuccessStatusCode();
        var duplicate = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/leftovers", command);

        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
    }

    [Theory]
    [InlineData(6)]
    [InlineData(7)]
    [InlineData(13)]
    public async Task PlanLeftovers_OnEarlierSameOrOutsideCycleDate_ReturnsBadRequest(int day)
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var meal = (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, day),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MovePlannedMeal_PersistsDateAndKeepsGroceries()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries", new ReviewMealGroceriesDto
        {
            Groceries = [new AddShoppingListItemDto { Name = "Pasta", Quantity = 1 }],
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
        });

        response.EnsureSuccessStatusCode();
        var moved = (await response.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        Assert.Equal(new DateOnly(2025, 1, 8), moved.Date);
        Assert.True(moved.HasReviewedGroceries);
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>($"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        Assert.Contains(persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal), item => item.Id == meal.Id && item.Date == new DateOnly(2025, 1, 8) && item.HasReviewedGroceries);
    }

    [Fact]
    public async Task PlanningEntries_AppendAndSameDayReorder_PersistMergedOrder()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var original = await AddMeal(new DateOnly(2025, 1, 7));
        var first = await AddMeal(new DateOnly(2025, 1, 8));
        var second = await AddMeal(new DateOnly(2025, 1, 8));
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        Assert.Equal(0, first.SortOrder);
        Assert.Equal(1, second.SortOrder);
        Assert.Equal(2, leftovers.SortOrder);

        (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{second.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
            TargetIndex = 0,
        })).EnsureSuccessStatusCode();

        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        Assert.Equal(0, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(meal => meal.Id == second.Id).SortOrder);
        Assert.Equal(1, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(meal => meal.Id == first.Id).SortOrder);
        Assert.Equal(2, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Leftover).Single(item => item.Id == leftovers.Id).SortOrder);

        async Task<PlannedEntryDto> AddMeal(DateOnly date) =>
            (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
            {
                MealPlanId = mealPlan.Id,
                RecipeId = recipe.Id,
                RecipeProfileId = profile.Id,
                Date = date,
            })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
    }

    [Fact]
    public async Task MovePlannedMeal_CrossDay_PersistsRequestedInsertionPointAndNormalizesSource()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var sourceFirst = await AddMeal(new DateOnly(2025, 1, 8));
        var moved = await AddMeal(new DateOnly(2025, 1, 8));
        var targetFirst = await AddMeal(new DateOnly(2025, 1, 9));
        var targetSecond = await AddMeal(new DateOnly(2025, 1, 9));

        (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{moved.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 9),
            TargetIndex = 1,
        })).EnsureSuccessStatusCode();

        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        Assert.Equal(0, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(meal => meal.Id == sourceFirst.Id).SortOrder);
        Assert.Equal(0, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(meal => meal.Id == targetFirst.Id).SortOrder);
        Assert.Equal(1, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(meal => meal.Id == moved.Id).SortOrder);
        Assert.Equal(2, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(meal => meal.Id == targetSecond.Id).SortOrder);

        async Task<PlannedEntryDto> AddMeal(DateOnly date) =>
            (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
            {
                MealPlanId = mealPlan.Id,
                RecipeId = recipe.Id,
                RecipeProfileId = profile.Id,
                Date = date,
            })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
    }

    [Fact]
    public async Task MovePlannedMeal_InHistoricalCycle_PersistsDateAndOrder()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var meal = (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 13),
            EndDate = new DateOnly(2025, 1, 19),
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
            TargetIndex = 0,
        });

        response.EnsureSuccessStatusCode();
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        var moved = persisted.Entries.Single(item => item.Id == meal.Id);
        Assert.Equal(new DateOnly(2025, 1, 8), moved.Date);
        Assert.Equal(0, moved.SortOrder);
    }

    [Fact]
    public async Task MovePlannedMeal_RejectsDateOnOrAfterLeftover()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MovePlannedMeal_OutsideCycle_ReturnsBadRequestWithoutChangingOrder()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var meal = (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 13),
            TargetIndex = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        var unchanged = persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(item => item.Id == meal.Id);
        Assert.Equal(new DateOnly(2025, 1, 7), unchanged.Date);
        Assert.Equal(0, unchanged.SortOrder);
    }

    [Fact]
    public async Task MovePlannedLeftovers_PersistsCrossDayInsertionAndNormalizesSource()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var original = await AddMeal(new DateOnly(2025, 1, 7));
        var sourceMeal = await AddMeal(new DateOnly(2025, 1, 8));
        var targetFirst = await AddMeal(new DateOnly(2025, 1, 9));
        var targetSecond = await AddMeal(new DateOnly(2025, 1, 9));
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{leftovers.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 9),
            TargetIndex = 1,
        });

        response.EnsureSuccessStatusCode();
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        Assert.Equal(0, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(meal => meal.Id == sourceMeal.Id).SortOrder);
        Assert.Equal(0, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(meal => meal.Id == targetFirst.Id).SortOrder);
        Assert.Equal(1, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Leftover).Single(item => item.Id == leftovers.Id).SortOrder);
        Assert.Equal(2, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(meal => meal.Id == targetSecond.Id).SortOrder);

        async Task<PlannedEntryDto> AddMeal(DateOnly date) =>
            (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
            {
                MealPlanId = mealPlan.Id,
                RecipeId = recipe.Id,
                RecipeProfileId = profile.Id,
                Date = date,
            })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
    }

    [Fact]
    public async Task MovePlannedLeftovers_SameDayReorder_PersistsMergedOrder()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var original = await AddMeal(new DateOnly(2025, 1, 7));
        var meal = await AddMeal(new DateOnly(2025, 1, 8));
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{leftovers.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
            TargetIndex = 0,
        });

        response.EnsureSuccessStatusCode();
        var moved = (await response.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        Assert.Equal(0, moved.SortOrder);
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        Assert.Equal(0, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Leftover).Single(item => item.Id == leftovers.Id).SortOrder);
        Assert.Equal(1, persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal).Single(item => item.Id == meal.Id).SortOrder);

        async Task<PlannedEntryDto> AddMeal(DateOnly date) =>
            (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
            {
                MealPlanId = mealPlan.Id,
                RecipeId = recipe.Id,
                RecipeProfileId = profile.Id,
                Date = date,
            })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
    }

    [Fact]
    public async Task MovePlannedLeftovers_OnOrBeforeOriginal_ReturnsBadRequestWithoutChangingOrder()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var original = (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{leftovers.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = original.Date,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        var unchanged = persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Leftover).Single(item => item.Id == leftovers.Id);
        Assert.Equal(new DateOnly(2025, 1, 8), unchanged.Date);
        Assert.Equal(0, unchanged.SortOrder);
    }

    [Fact]
    public async Task MovePlannedLeftovers_OutsideCycle_ReturnsBadRequestWithoutChangingOrder()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var original = (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{leftovers.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 13),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        Assert.Contains(persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Leftover), item =>
            item.Id == leftovers.Id && item.Date == new DateOnly(2025, 1, 8) && item.SortOrder == 0);
    }

    [Fact]
    public async Task MovePlannedLeftovers_InHistoricalCycle_PersistsDateAndOrder()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var original = (await (await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 13),
            EndDate = new DateOnly(2025, 1, 19),
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{leftovers.Id}/move", new MovePlannedEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 9),
            TargetIndex = 0,
        });

        response.EnsureSuccessStatusCode();
        var persisted = (await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions))!;
        Assert.Contains(persisted.Entries.Where(entry => entry.Kind == PlannedEntryKind.Leftover), item =>
            item.Id == leftovers.Id && item.Date == new DateOnly(2025, 1, 9) && item.SortOrder == 0);
    }

    [Fact]
    public async Task ReviewMealGroceries_Succeeds()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var groceriesResponse = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries", new ReviewMealGroceriesDto
        {
            Groceries =
            [
                new AddShoppingListItemDto { Name = "Pasta",        Quantity = 500 },
                new AddShoppingListItemDto { Name = "Tomato Sauce", Quantity = 1 },
            ],
        });
        groceriesResponse.EnsureSuccessStatusCode();

        var result = await groceriesResponse.Content.ReadFromJsonAsync<MealShoppingGroupDto>(JsonOptions);
        Assert.NotNull(result);
        Assert.Equal(2, result.Items.Count);

        var planningAfterCommit = await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions);
        Assert.NotNull(planningAfterCommit);
        Assert.Contains(planningAfterCommit.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal), m => m.Id == meal.Id && m.HasReviewedGroceries);

        var currentGroceries = await HttpClient.GetFromJsonAsync<MealShoppingGroupDto>(
            $"/api/planned-meals/{meal.Id}/groceries", JsonOptions);
        Assert.NotNull(currentGroceries);
        Assert.Equal(2, currentGroceries.Items.Count);
    }

    [Fact]
    public async Task AddMealShoppingListItem_AddsManualGroceryItemToExistingMealGroup()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var mealResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await mealResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries", new ReviewMealGroceriesDto
        {
            Groceries = [],
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{meal.Id}/groceries/items",
            new AddManualShoppingListItemDto { Name = "Croutons", Quantity = 2 });

        response.EnsureSuccessStatusCode();
        var item = (await response.Content.ReadFromJsonAsync<ShoppingListItemDto>(JsonOptions))!;
        Assert.Equal(meal.Id, item.PlannedMealId);
        Assert.Null(item.RecipeProfileGroceryItemId);
        var list = await HttpClient.GetFromJsonAsync<ShoppingListDto>(
            $"/api/shopping-lists/cycle/{mealPlan.PlanningCycleId}", JsonOptions);
        Assert.Contains(Assert.Single(list!.MealGroups).Items, grocery => grocery.Id == item.Id);
    }

    [Fact]
    public async Task ReviewMealGroceries_PersistsStableProfileGroceryItemIdentifierForSubstitution()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var profileResponse = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{profile.Id}",
            new UpdateRecipeProfileDto
            {
                Name = profile.Name,
                Servings = profile.Servings,
                Groceries =
                [
                    new RecipeProfileGroceryItemInputDto
                    {
                        Id = Guid.Empty,
                        Name = "Bell pepper",
                        Quantity = 1,
                        AtHome = false,
                    },
                ],
            });
        var updatedProfile = (await profileResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;
        var sourceGroceryItem = Assert.Single(updatedProfile.Groceries);
        var mealResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await mealResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries",
            new ReviewMealGroceriesDto
            {
                Groceries =
                [
                    new AddShoppingListItemDto
                    {
                        RecipeProfileGroceryItemId = sourceGroceryItem.Id,
                        Name = "Zucchini",
                        Quantity = 2,
                    },
                ],
            });
        response.EnsureSuccessStatusCode();

        var persisted = (await HttpClient.GetFromJsonAsync<MealShoppingGroupDto>(
            $"/api/planned-meals/{meal.Id}/groceries", JsonOptions))!;
        var grocery = Assert.Single(persisted.Items);
        Assert.Equal(sourceGroceryItem.Id, grocery.RecipeProfileGroceryItemId);
        Assert.Equal("Zucchini", grocery.Name);

        var removeGroceryResponse = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{profile.Id}",
            new UpdateRecipeProfileDto
            {
                Name = profile.Name,
                Servings = profile.Servings,
                Groceries = [],
            });
        removeGroceryResponse.EnsureSuccessStatusCode();
        var afterSourceRemoval = (await HttpClient.GetFromJsonAsync<MealShoppingGroupDto>(
            $"/api/planned-meals/{meal.Id}/groceries", JsonOptions))!;
        var preserved = Assert.Single(afterSourceRemoval.Items);
        Assert.Null(preserved.RecipeProfileGroceryItemId);
        Assert.Equal("Zucchini", preserved.Name);
    }

    [Fact]
    public async Task ReviewMealGroceries_RejectsGroceryItemIdentifierFromAnotherProfile()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var otherResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Other",
            Servings = 2,
        });
        var other = (await otherResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;
        var updatedResponse = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{other.Id}",
            new UpdateRecipeProfileDto
            {
                Name = other.Name,
                Servings = other.Servings,
                Groceries =
                [
                    new RecipeProfileGroceryItemInputDto
                    {
                        Id = Guid.Empty,
                        Name = "Foreign",
                        Quantity = 1,
                        AtHome = false,
                    },
                ],
            });
        var foreignGroceryItem = Assert.Single(
            (await updatedResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!.Groceries);
        var mealResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await mealResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries",
            new ReviewMealGroceriesDto
            {
                Groceries =
                [
                    new AddShoppingListItemDto
                    {
                        RecipeProfileGroceryItemId = foreignGroceryItem.Id,
                        Name = foreignGroceryItem.Name,
                        Quantity = 1,
                    },
                ],
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ReviewMealGroceries_EmptySelection_ConfirmsMeal()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries", new ReviewMealGroceriesDto
        {
            Groceries = [],
        });

        response.EnsureSuccessStatusCode();
        var updatedMealPlan = await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions);
        Assert.NotNull(updatedMealPlan);
        Assert.Contains(updatedMealPlan.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal), m => m.Id == meal.Id && m.HasReviewedGroceries);
    }

    [Fact]
    public async Task UpdatePlannedMealProfile_ChangesProfile()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();

        // Add meal
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        // Create a second profile
        var profileResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Family",
            Servings = 6,
        });
        var newProfile = (await profileResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;

        // Change profile
        var updateResponse = await HttpClient.PutAsync($"/api/planned-meals/{meal.Id}/profile/{newProfile.Id}", null);
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal(newProfile.Id, updated.RecipeProfile.Id);
    }

    [Fact]
    public async Task UpdatePlannedMealProfile_RemovesPreviousGroceries()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries", new ReviewMealGroceriesDto
        {
            Groceries = [new AddShoppingListItemDto { Name = "Pasta", Quantity = 500 }],
        });

        var profileResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Family",
            Servings = 6,
        });
        var newProfile = (await profileResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;

        var updateResponse = await HttpClient.PutAsync($"/api/planned-meals/{meal.Id}/profile/{newProfile.Id}", null);
        updateResponse.EnsureSuccessStatusCode();

        var planningAfterUpdate = await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions);
        var shoppingList = await HttpClient.GetFromJsonAsync<ShoppingListDto>(
            $"/api/shopping-lists/cycle/{mealPlan.PlanningCycleId}", JsonOptions);

        Assert.NotNull(planningAfterUpdate);
        Assert.NotNull(shoppingList);
        Assert.Contains(planningAfterUpdate.Entries.Where(entry => entry.Kind == PlannedEntryKind.Meal), m => m.Id == meal.Id && !m.HasReviewedGroceries);
        Assert.Empty(shoppingList.MealGroups);
    }

    [Fact]
    public async Task DeletePlannedMeal_RemovesGroceriesAndLeftovers()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/groceries", new ReviewMealGroceriesDto
        {
            Groceries = [new AddShoppingListItemDto { Name = "Pasta", Quantity = 500 }],
        });
        await HttpClient.PostAsJsonAsync($"/api/planned-meals/{meal.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        });

        var deleteResponse = await HttpClient.DeleteAsync($"/api/planned-meals/{meal.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var planningAfterDelete = await HttpClient.GetFromJsonAsync<MealPlanDto>(
            $"/api/meal-plans/cycle/{mealPlan.PlanningCycleId}", JsonOptions);
        var shoppingList = await HttpClient.GetFromJsonAsync<ShoppingListDto>(
            $"/api/shopping-lists/cycle/{mealPlan.PlanningCycleId}", JsonOptions);

        Assert.NotNull(planningAfterDelete);
        Assert.NotNull(shoppingList);
        Assert.DoesNotContain(planningAfterDelete.Entries.Where(entry => entry.Kind == PlannedEntryKind.Leftover), l => l.OriginalMealId == meal.Id);
        Assert.DoesNotContain(shoppingList.MealGroups, g => g.Meal.Id == meal.Id);
    }

    [Fact]
    public async Task GetMealShoppingGroup_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.GetAsync($"/api/planned-meals/{Guid.NewGuid()}/groceries");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddPlannedMeal_EmptyReferences_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = Guid.Empty,
            RecipeId = Guid.Empty,
            RecipeProfileId = Guid.Empty,
            Date = new DateOnly(2025, 1, 7),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddPlannedMeal_MissingPlanning_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = Guid.NewGuid(),
            RecipeId = Guid.NewGuid(),
            RecipeProfileId = Guid.NewGuid(),
            Date = new DateOnly(2025, 1, 7),
        });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task PlanLeftovers_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{Guid.NewGuid()}/leftovers",
            new PlanLeftoversDto { Date = new DateOnly(2025, 1, 8) });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MovePlannedMeal_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{Guid.NewGuid()}/move",
            new MovePlannedEntryDto { TargetDate = new DateOnly(2025, 1, 8) });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MovePlannedMeal_EmptyDate_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{Guid.NewGuid()}/move",
            new MovePlannedEntryDto { TargetDate = default });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MovePlannedLeftovers_MissingLeftovers_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{Guid.NewGuid()}/move",
            new MovePlannedEntryDto { TargetDate = new DateOnly(2025, 1, 8) });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MovePlannedLeftovers_EmptyDate_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{Guid.NewGuid()}/move",
            new MovePlannedEntryDto { TargetDate = default });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ReviewMealGroceries_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{Guid.NewGuid()}/groceries",
            new ReviewMealGroceriesDto { Groceries = [] });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddMealShoppingListItem_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{Guid.NewGuid()}/groceries/items",
            new AddManualShoppingListItemDto { Name = "Croutons", Quantity = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddMealShoppingListItem_UnreviewedMeal_ReturnsBadRequest()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{meal.Id}/groceries/items",
            new AddManualShoppingListItemDto { Name = "Croutons", Quantity = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task ReviewMealGroceries_InvalidItem_ReturnsBadRequest()
    {
        var (mealPlan, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planned-meals", new AddPlannedMealDto
        {
            MealPlanId = mealPlan.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = await addResponse.Content.ReadFromJsonAsync<PlannedEntryDto>(JsonOptions);
        Assert.NotNull(meal);

        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planned-meals/{meal.Id}/groceries",
            new ReviewMealGroceriesDto
            {
                Groceries = [new AddShoppingListItemDto { Name = "", Quantity = 0 }],
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePlannedMealProfile_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsync(
            $"/api/planned-meals/{Guid.NewGuid()}/profile/{Guid.NewGuid()}",
            null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeletePlannedMeal_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/planned-meals/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
