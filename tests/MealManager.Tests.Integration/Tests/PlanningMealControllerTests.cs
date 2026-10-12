using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using MealManager.Application.DTO;
using MealManager.Common.Enums;
using MealManager.Tests.Integration.Configuration;
using Xunit;
using PlanningEntryDto = MealManager.Application.DTO.PlanningEntryDto;
using MovePlanningEntryDto = MealManager.Application.DTO.MovePlanningEntryDto;

namespace MealManager.Tests.Integration.Tests;

public class PlanningMealControllerTests(CustomWebApplicationFactory factory) : TestWebApplicationFixture(factory)
{
    private async Task<(PlanningDto Planning, RecipeDto Recipe, RecipeProfileDto Profile)> SetupAsync()
    {
        // Create a cycle and planning
        var cycleResponse = await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 6),
            EndDate = new DateOnly(2025, 1, 12),
        });
        var cycle = (await cycleResponse.Content.ReadFromJsonAsync<PlanningCycleDto>(JsonOptions))!;
        var planning = (await HttpClient.GetFromJsonAsync<PlanningDto>($"/api/planning/cycle/{cycle.Id}", JsonOptions))!;

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

        return (planning, recipe, profile);
    }

    [Fact]
    public async Task AddPlanningMeal_CreatesMeal()
    {
        var (planning, recipe, profile) = await SetupAsync();

        var response = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        response.EnsureSuccessStatusCode();

        var meal = await response.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions);
        Assert.NotNull(meal);
        Assert.Equal("Pasta", meal.Recipe.Name);
        Assert.Equal(new DateOnly(2025, 1, 7), meal.Date);
    }

    [Fact]
    public async Task AddPlanningMeal_OutsideCycle_ReturnsBadRequest()
    {
        var (planning, recipe, profile) = await SetupAsync();

        var response = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 20),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task DeletePlanningMeal_RemovesMeal()
    {
        var (planning, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 8),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var deleteResponse = await HttpClient.DeleteAsync($"/api/planning-meals/{meal.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var updatedPlanning = await HttpClient.GetFromJsonAsync<PlanningDto>($"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions);
        Assert.NotNull(updatedPlanning);
        Assert.DoesNotContain(updatedPlanning.Meals, m => m.Id == meal.Id);
    }

    [Fact]
    public async Task DeleteReferencedRecipe_IsRejected()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        addResponse.EnsureSuccessStatusCode();

        var deleteResponse = await HttpClient.DeleteAsync($"/api/recipes/{recipe.Id}");

        Assert.Equal(HttpStatusCode.BadRequest, deleteResponse.StatusCode);
        var planningAfterDelete = await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions);
        Assert.NotNull(planningAfterDelete);
        Assert.Contains(planningAfterDelete.Meals, meal => meal.Recipe.Id == recipe.Id);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public async Task DeleteLeftover_PreservesOriginalGroceriesAndOtherEntries(bool historical)
    {
        var (planning, recipe, profile) = await SetupAsync();
        var original = (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        var leftovers = new List<PlanningEntryDto>();
        foreach (var day in new[] { 8, 9 })
        {
            var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{original.Id}/leftovers",
                new PlanLeftoversDto { Date = new DateOnly(2025, 1, day) });
            response.EnsureSuccessStatusCode();
            leftovers.Add((await response.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!);
        }
        var companion = (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{original.Id}/groceries", new AddMealGroceriesDto
        {
            Groceries = [new AddGroceryItemDto { Name = "Pasta", Quantity = 2 }],
        })).EnsureSuccessStatusCode();
        if (historical)
            (await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
            {
                StartDate = new DateOnly(2025, 1, 13),
                EndDate = new DateOnly(2025, 1, 19),
            })).EnsureSuccessStatusCode();

        var deletion = await HttpClient.DeleteAsync($"/api/planning-meals/{leftovers[0].Id}");
        Assert.Equal(historical ? HttpStatusCode.BadRequest : HttpStatusCode.NoContent, deletion.StatusCode);
        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        Assert.Contains(persisted.Meals, item => item.Id == original.Id && item.HasGroceriesAdded);
        Assert.Contains(persisted.Meals, item => item.Id == companion.Id && item.SortOrder == (historical ? 1 : 0));
        Assert.Contains(persisted.Leftovers, item => item.Id == leftovers[1].Id);
        Assert.Equal(historical, persisted.Leftovers.Any(item => item.Id == leftovers[0].Id));
        var groceries = (await HttpClient.GetFromJsonAsync<PlanningMealGroceriesDto>(
            $"/api/planning-meals/{original.Id}/groceries", JsonOptions))!;
        Assert.Equal("Pasta", Assert.Single(groceries.Groceries).Name);
        if (!historical)
            Assert.Equal(HttpStatusCode.NotFound,
                (await HttpClient.DeleteAsync($"/api/planning-meals/{leftovers[0].Id}")).StatusCode);
    }

    [Fact]
    public async Task PlanLeftovers_Succeeds()
    {
        var (planning, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var leftoversResponse = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        });
        leftoversResponse.EnsureSuccessStatusCode();

        var leftovers = await leftoversResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions);
        Assert.NotNull(leftovers);
        Assert.Equal(meal.Id, leftovers.OriginalMealId);
    }

    [Fact]
    public async Task PlanLeftovers_ForSameMealAndDate_ReturnsBadRequest()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        var command = new PlanLeftoversDto { Date = new DateOnly(2025, 1, 8) };

        (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/leftovers", command)).EnsureSuccessStatusCode();
        var duplicate = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/leftovers", command);

        Assert.Equal(HttpStatusCode.BadRequest, duplicate.StatusCode);
    }

    [Theory]
    [InlineData(6)]
    [InlineData(7)]
    [InlineData(13)]
    public async Task PlanLeftovers_OnEarlierSameOrOutsideCycleDate_ReturnsBadRequest(int day)
    {
        var (planning, recipe, profile) = await SetupAsync();
        var meal = (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, day),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MovePlanningMeal_PersistsDateAndKeepsGroceries()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/groceries", new AddMealGroceriesDto
        {
            Groceries = [new AddGroceryItemDto { Name = "Pasta", Quantity = 1 }],
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
        });

        response.EnsureSuccessStatusCode();
        var moved = (await response.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        Assert.Equal(new DateOnly(2025, 1, 8), moved.Date);
        Assert.True(moved.HasGroceriesAdded);
        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>($"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        Assert.Contains(persisted.Meals, item => item.Id == meal.Id && item.Date == new DateOnly(2025, 1, 8) && item.HasGroceriesAdded);
    }

    [Fact]
    public async Task PlanningEntries_AppendAndSameDayReorder_PersistMergedOrder()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var original = await AddMeal(new DateOnly(2025, 1, 7));
        var first = await AddMeal(new DateOnly(2025, 1, 8));
        var second = await AddMeal(new DateOnly(2025, 1, 8));
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        Assert.Equal(0, first.SortOrder);
        Assert.Equal(1, second.SortOrder);
        Assert.Equal(2, leftovers.SortOrder);

        (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{second.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
            TargetIndex = 0,
        })).EnsureSuccessStatusCode();

        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        Assert.Equal(0, persisted.Meals.Single(meal => meal.Id == second.Id).SortOrder);
        Assert.Equal(1, persisted.Meals.Single(meal => meal.Id == first.Id).SortOrder);
        Assert.Equal(2, persisted.Leftovers.Single(item => item.Id == leftovers.Id).SortOrder);

        async Task<PlanningEntryDto> AddMeal(DateOnly date) =>
            (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
            {
                PlanningId = planning.Id,
                RecipeId = recipe.Id,
                RecipeProfileId = profile.Id,
                Date = date,
            })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
    }

    [Fact]
    public async Task MovePlanningMeal_CrossDay_PersistsRequestedInsertionPointAndNormalizesSource()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var sourceFirst = await AddMeal(new DateOnly(2025, 1, 8));
        var moved = await AddMeal(new DateOnly(2025, 1, 8));
        var targetFirst = await AddMeal(new DateOnly(2025, 1, 9));
        var targetSecond = await AddMeal(new DateOnly(2025, 1, 9));

        (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{moved.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 9),
            TargetIndex = 1,
        })).EnsureSuccessStatusCode();

        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        Assert.Equal(0, persisted.Meals.Single(meal => meal.Id == sourceFirst.Id).SortOrder);
        Assert.Equal(0, persisted.Meals.Single(meal => meal.Id == targetFirst.Id).SortOrder);
        Assert.Equal(1, persisted.Meals.Single(meal => meal.Id == moved.Id).SortOrder);
        Assert.Equal(2, persisted.Meals.Single(meal => meal.Id == targetSecond.Id).SortOrder);

        async Task<PlanningEntryDto> AddMeal(DateOnly date) =>
            (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
            {
                PlanningId = planning.Id,
                RecipeId = recipe.Id,
                RecipeProfileId = profile.Id,
                Date = date,
            })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
    }

    [Fact]
    public async Task MovePlanningMeal_InHistoricalCycle_ReturnsBadRequestWithoutChangingOrder()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var meal = (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 13),
            EndDate = new DateOnly(2025, 1, 19),
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
            TargetIndex = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        using var problem = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        Assert.Equal("HistoricalCycleReadOnly", problem.RootElement.GetProperty("code").GetString());
        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        var unchanged = persisted.Meals.Single(item => item.Id == meal.Id);
        Assert.Equal(new DateOnly(2025, 1, 7), unchanged.Date);
        Assert.Equal(0, unchanged.SortOrder);
    }

    [Fact]
    public async Task MovePlanningMeal_RejectsDateOnOrAfterLeftover()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MovePlanningMeal_OutsideCycle_ReturnsBadRequestWithoutChangingOrder()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var meal = (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 13),
            TargetIndex = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        var unchanged = persisted.Meals.Single(item => item.Id == meal.Id);
        Assert.Equal(new DateOnly(2025, 1, 7), unchanged.Date);
        Assert.Equal(0, unchanged.SortOrder);
    }

    [Fact]
    public async Task MovePlanningLeftovers_PersistsCrossDayInsertionAndNormalizesSource()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var original = await AddMeal(new DateOnly(2025, 1, 7));
        var sourceMeal = await AddMeal(new DateOnly(2025, 1, 8));
        var targetFirst = await AddMeal(new DateOnly(2025, 1, 9));
        var targetSecond = await AddMeal(new DateOnly(2025, 1, 9));
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{leftovers.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 9),
            TargetIndex = 1,
        });

        response.EnsureSuccessStatusCode();
        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        Assert.Equal(0, persisted.Meals.Single(meal => meal.Id == sourceMeal.Id).SortOrder);
        Assert.Equal(0, persisted.Meals.Single(meal => meal.Id == targetFirst.Id).SortOrder);
        Assert.Equal(1, persisted.Leftovers.Single(item => item.Id == leftovers.Id).SortOrder);
        Assert.Equal(2, persisted.Meals.Single(meal => meal.Id == targetSecond.Id).SortOrder);

        async Task<PlanningEntryDto> AddMeal(DateOnly date) =>
            (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
            {
                PlanningId = planning.Id,
                RecipeId = recipe.Id,
                RecipeProfileId = profile.Id,
                Date = date,
            })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
    }

    [Fact]
    public async Task MovePlanningLeftovers_SameDayReorder_PersistsMergedOrder()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var original = await AddMeal(new DateOnly(2025, 1, 7));
        var meal = await AddMeal(new DateOnly(2025, 1, 8));
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{leftovers.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 8),
            TargetIndex = 0,
        });

        response.EnsureSuccessStatusCode();
        var moved = (await response.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        Assert.Equal(0, moved.SortOrder);
        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        Assert.Equal(0, persisted.Leftovers.Single(item => item.Id == leftovers.Id).SortOrder);
        Assert.Equal(1, persisted.Meals.Single(item => item.Id == meal.Id).SortOrder);

        async Task<PlanningEntryDto> AddMeal(DateOnly date) =>
            (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
            {
                PlanningId = planning.Id,
                RecipeId = recipe.Id,
                RecipeProfileId = profile.Id,
                Date = date,
            })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
    }

    [Fact]
    public async Task MovePlanningLeftovers_OnOrBeforeOriginal_ReturnsBadRequestWithoutChangingOrder()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var original = (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{leftovers.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = original.Date,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        var unchanged = persisted.Leftovers.Single(item => item.Id == leftovers.Id);
        Assert.Equal(new DateOnly(2025, 1, 8), unchanged.Date);
        Assert.Equal(0, unchanged.SortOrder);
    }

    [Fact]
    public async Task MovePlanningLeftovers_OutsideCycle_ReturnsBadRequestWithoutChangingOrder()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var original = (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{leftovers.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 13),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        Assert.Contains(persisted.Leftovers, item =>
            item.Id == leftovers.Id && item.Date == new DateOnly(2025, 1, 8) && item.SortOrder == 0);
    }

    [Fact]
    public async Task MovePlanningLeftovers_InHistoricalCycle_ReturnsBadRequestWithoutChangingOrder()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var original = (await (await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        var leftovers = (await (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{original.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        })).Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync("/api/planning-cycles", new CreatePlanningCycleDto
        {
            StartDate = new DateOnly(2025, 1, 13),
            EndDate = new DateOnly(2025, 1, 19),
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{leftovers.Id}/move", new MovePlanningEntryDto
        {
            TargetDate = new DateOnly(2025, 1, 9),
            TargetIndex = 0,
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var persisted = (await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions))!;
        Assert.Contains(persisted.Leftovers, item =>
            item.Id == leftovers.Id && item.Date == new DateOnly(2025, 1, 8) && item.SortOrder == 0);
    }

    [Fact]
    public async Task AddMealGroceries_Succeeds()
    {
        var (planning, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var groceriesResponse = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/groceries", new AddMealGroceriesDto
        {
            Groceries =
            [
                new AddGroceryItemDto { Name = "Pasta",        Quantity = 500 },
                new AddGroceryItemDto { Name = "Tomato Sauce", Quantity = 1 },
            ],
        });
        groceriesResponse.EnsureSuccessStatusCode();

        var result = await groceriesResponse.Content.ReadFromJsonAsync<PlanningMealGroceriesDto>(JsonOptions);
        Assert.NotNull(result);
        Assert.Equal(2, result.Groceries.Count);

        var planningAfterCommit = await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions);
        Assert.NotNull(planningAfterCommit);
        Assert.Contains(planningAfterCommit.Meals, m => m.Id == meal.Id && m.HasGroceriesAdded);

        var currentGroceries = await HttpClient.GetFromJsonAsync<PlanningMealGroceriesDto>(
            $"/api/planning-meals/{meal.Id}/groceries", JsonOptions);
        Assert.NotNull(currentGroceries);
        Assert.Equal(2, currentGroceries.Groceries.Count);
    }

    [Fact]
    public async Task AddMealGroceryItem_AddsManualProductToExistingMealGroup()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var mealResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await mealResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;
        (await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/groceries", new AddMealGroceriesDto
        {
            Groceries = [],
        })).EnsureSuccessStatusCode();

        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planning-meals/{meal.Id}/groceries/items",
            new AddManualGroceryItemDto { Name = "Croutons", Quantity = 2 });

        response.EnsureSuccessStatusCode();
        var item = (await response.Content.ReadFromJsonAsync<GroceryItemDto>(JsonOptions))!;
        Assert.Equal(meal.Id, item.PlanningMealId);
        Assert.Null(item.RecipeProfileProductId);
        var list = await HttpClient.GetFromJsonAsync<GroceryListDto>(
            $"/api/grocery-lists/cycle/{planning.PlanningCycleId}", JsonOptions);
        Assert.Contains(Assert.Single(list!.PlanningMealGroceries).Groceries, grocery => grocery.Id == item.Id);
    }

    [Fact]
    public async Task AddMealGroceries_PersistsStableProfileProductIdentifierForSubstitution()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var profileResponse = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{profile.Id}",
            new UpdateRecipeProfileDto
            {
                Name = profile.Name,
                Servings = profile.Servings,
                Products =
                [
                    new RecipeProfileProductInputDto
                    {
                        Id = Guid.Empty,
                        Name = "Bell pepper",
                        Quantity = 1,
                        AtHome = false,
                    },
                ],
            });
        var updatedProfile = (await profileResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;
        var sourceProduct = Assert.Single(updatedProfile.Products);
        var mealResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await mealResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/groceries",
            new AddMealGroceriesDto
            {
                Groceries =
                [
                    new AddGroceryItemDto
                    {
                        RecipeProfileProductId = sourceProduct.Id,
                        Name = "Zucchini",
                        Quantity = 2,
                    },
                ],
            });
        response.EnsureSuccessStatusCode();

        var persisted = (await HttpClient.GetFromJsonAsync<PlanningMealGroceriesDto>(
            $"/api/planning-meals/{meal.Id}/groceries", JsonOptions))!;
        var grocery = Assert.Single(persisted.Groceries);
        Assert.Equal(sourceProduct.Id, grocery.RecipeProfileProductId);
        Assert.Equal("Zucchini", grocery.Name);

        var removeProductResponse = await HttpClient.PutAsJsonAsync($"/api/recipe-profiles/{profile.Id}",
            new UpdateRecipeProfileDto
            {
                Name = profile.Name,
                Servings = profile.Servings,
                Products = [],
            });
        removeProductResponse.EnsureSuccessStatusCode();
        var afterSourceRemoval = (await HttpClient.GetFromJsonAsync<PlanningMealGroceriesDto>(
            $"/api/planning-meals/{meal.Id}/groceries", JsonOptions))!;
        var preserved = Assert.Single(afterSourceRemoval.Groceries);
        Assert.Null(preserved.RecipeProfileProductId);
        Assert.Equal("Zucchini", preserved.Name);
    }

    [Fact]
    public async Task AddMealGroceries_RejectsProductIdentifierFromAnotherProfile()
    {
        var (planning, recipe, profile) = await SetupAsync();
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
                Products =
                [
                    new RecipeProfileProductInputDto
                    {
                        Id = Guid.Empty,
                        Name = "Foreign",
                        Quantity = 1,
                        AtHome = false,
                    },
                ],
            });
        var foreignProduct = Assert.Single(
            (await updatedResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!.Products);
        var mealResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await mealResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/groceries",
            new AddMealGroceriesDto
            {
                Groceries =
                [
                    new AddGroceryItemDto
                    {
                        RecipeProfileProductId = foreignProduct.Id,
                        Name = foreignProduct.Name,
                        Quantity = 1,
                    },
                ],
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddMealGroceries_EmptySelection_ConfirmsMeal()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/groceries", new AddMealGroceriesDto
        {
            Groceries = [],
        });

        response.EnsureSuccessStatusCode();
        var updatedPlanning = await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions);
        Assert.NotNull(updatedPlanning);
        Assert.Contains(updatedPlanning.Meals, m => m.Id == meal.Id && m.HasGroceriesAdded);
    }

    [Fact]
    public async Task UpdatePlanningMealProfile_ChangesProfile()
    {
        var (planning, recipe, profile) = await SetupAsync();

        // Add meal
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        // Create a second profile
        var profileResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Family",
            Servings = 6,
        });
        var newProfile = (await profileResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;

        // Change profile
        var updateResponse = await HttpClient.PutAsync($"/api/planning-meals/{meal.Id}/profile/{newProfile.Id}", null);
        updateResponse.EnsureSuccessStatusCode();

        var updated = await updateResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions);
        Assert.NotNull(updated);
        Assert.Equal(newProfile.Id, updated.RecipeProfile.Id);
    }

    [Fact]
    public async Task UpdatePlanningMealProfile_RemovesPreviousGroceries()
    {
        var (planning, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/groceries", new AddMealGroceriesDto
        {
            Groceries = [new AddGroceryItemDto { Name = "Pasta", Quantity = 500 }],
        });

        var profileResponse = await HttpClient.PostAsJsonAsync("/api/recipe-profiles", new AddRecipeProfileDto
        {
            RecipeId = recipe.Id,
            Name = "Family",
            Servings = 6,
        });
        var newProfile = (await profileResponse.Content.ReadFromJsonAsync<RecipeProfileDto>(JsonOptions))!;

        var updateResponse = await HttpClient.PutAsync($"/api/planning-meals/{meal.Id}/profile/{newProfile.Id}", null);
        updateResponse.EnsureSuccessStatusCode();

        var planningAfterUpdate = await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions);
        var groceryList = await HttpClient.GetFromJsonAsync<GroceryListDto>(
            $"/api/grocery-lists/cycle/{planning.PlanningCycleId}", JsonOptions);

        Assert.NotNull(planningAfterUpdate);
        Assert.NotNull(groceryList);
        Assert.Contains(planningAfterUpdate.Meals, m => m.Id == meal.Id && !m.HasGroceriesAdded);
        Assert.Empty(groceryList.PlanningMealGroceries);
    }

    [Fact]
    public async Task DeletePlanningMeal_RemovesGroceriesAndLeftovers()
    {
        var (planning, recipe, profile) = await SetupAsync();

        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/groceries", new AddMealGroceriesDto
        {
            Groceries = [new AddGroceryItemDto { Name = "Pasta", Quantity = 500 }],
        });
        await HttpClient.PostAsJsonAsync($"/api/planning-meals/{meal.Id}/leftovers", new PlanLeftoversDto
        {
            Date = new DateOnly(2025, 1, 8),
        });

        var deleteResponse = await HttpClient.DeleteAsync($"/api/planning-meals/{meal.Id}");
        deleteResponse.EnsureSuccessStatusCode();

        var planningAfterDelete = await HttpClient.GetFromJsonAsync<PlanningDto>(
            $"/api/planning/cycle/{planning.PlanningCycleId}", JsonOptions);
        var groceryList = await HttpClient.GetFromJsonAsync<GroceryListDto>(
            $"/api/grocery-lists/cycle/{planning.PlanningCycleId}", JsonOptions);

        Assert.NotNull(planningAfterDelete);
        Assert.NotNull(groceryList);
        Assert.DoesNotContain(planningAfterDelete.Leftovers, l => l.OriginalMealId == meal.Id);
        Assert.DoesNotContain(groceryList.PlanningMealGroceries, g => g.PlanningMeal.Id == meal.Id);
    }

    [Fact]
    public async Task GetPlanningMealGroceries_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.GetAsync($"/api/planning-meals/{Guid.NewGuid()}/groceries");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddPlanningMeal_EmptyReferences_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = Guid.Empty,
            RecipeId = Guid.Empty,
            RecipeProfileId = Guid.Empty,
            Date = new DateOnly(2025, 1, 7),
        });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddPlanningMeal_MissingPlanning_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = Guid.NewGuid(),
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
            $"/api/planning-meals/{Guid.NewGuid()}/leftovers",
            new PlanLeftoversDto { Date = new DateOnly(2025, 1, 8) });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MovePlanningMeal_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planning-meals/{Guid.NewGuid()}/move",
            new MovePlanningEntryDto { TargetDate = new DateOnly(2025, 1, 8) });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MovePlanningMeal_EmptyDate_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planning-meals/{Guid.NewGuid()}/move",
            new MovePlanningEntryDto { TargetDate = default });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task MovePlanningLeftovers_MissingLeftovers_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planning-meals/{Guid.NewGuid()}/move",
            new MovePlanningEntryDto { TargetDate = new DateOnly(2025, 1, 8) });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task MovePlanningLeftovers_EmptyDate_ReturnsBadRequest()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planning-meals/{Guid.NewGuid()}/move",
            new MovePlanningEntryDto { TargetDate = default });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddMealGroceries_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planning-meals/{Guid.NewGuid()}/groceries",
            new AddMealGroceriesDto { Groceries = [] });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddMealGroceryItem_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planning-meals/{Guid.NewGuid()}/groceries/items",
            new AddManualGroceryItemDto { Name = "Croutons", Quantity = 1 });

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task AddMealGroceryItem_UnreviewedMeal_ReturnsBadRequest()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = (await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions))!;

        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planning-meals/{meal.Id}/groceries/items",
            new AddManualGroceryItemDto { Name = "Croutons", Quantity = 1 });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task AddMealGroceries_InvalidItem_ReturnsBadRequest()
    {
        var (planning, recipe, profile) = await SetupAsync();
        var addResponse = await HttpClient.PostAsJsonAsync("/api/planning-meals", new AddPlanningMealDto
        {
            PlanningId = planning.Id,
            RecipeId = recipe.Id,
            RecipeProfileId = profile.Id,
            Date = new DateOnly(2025, 1, 7),
        });
        var meal = await addResponse.Content.ReadFromJsonAsync<PlanningEntryDto>(JsonOptions);
        Assert.NotNull(meal);

        var response = await HttpClient.PostAsJsonAsync(
            $"/api/planning-meals/{meal.Id}/groceries",
            new AddMealGroceriesDto
            {
                Groceries = [new AddGroceryItemDto { Name = "", Quantity = 0 }],
            });

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task UpdatePlanningMealProfile_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.PutAsync(
            $"/api/planning-meals/{Guid.NewGuid()}/profile/{Guid.NewGuid()}",
            null);

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }

    [Fact]
    public async Task DeletePlanningMeal_MissingMeal_ReturnsNotFound()
    {
        var response = await HttpClient.DeleteAsync($"/api/planning-meals/{Guid.NewGuid()}");

        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
    }
}
