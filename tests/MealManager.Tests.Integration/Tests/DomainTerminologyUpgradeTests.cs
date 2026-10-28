using MealManager.Application.Queries;
using MealManager.Common.Enums;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public sealed class DomainTerminologyUpgradeTests
{
    [Fact]
    public async Task UpgradePreservesMealPlansReviewsShoppingAndProductMappings()
    {
        var path = Path.Combine(Path.GetTempPath(), $"mealmanager-upgrade-{Guid.NewGuid():N}.db");
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlite($"Data Source={path};Pooling=False").Options;
        var recipeId = Guid.NewGuid();
        var profileId = Guid.NewGuid();
        var sourceId = Guid.NewGuid();
        var cycleId = Guid.NewGuid();
        var planId = Guid.NewGuid();
        var mealId = Guid.NewGuid();
        var emptyMealId = Guid.NewGuid();
        var leftoverId = Guid.NewGuid();
        var listId = Guid.NewGuid();
        var itemId = Guid.NewGuid();
        var date = new DateOnly(2026, 10, 16);
        try
        {
            await using (var before = new ApplicationDbContext(options))
            {
                var previousMigration = before.Database.GetMigrations()
                    .TakeWhile(migration => !migration.EndsWith("_AlignDomainTerminology", StringComparison.Ordinal)).Last();
                await before.GetService<IMigrator>().MigrateAsync(previousMigration);
                // Seed using the deployed identifiers, independently of current EF mappings.
                await before.Database.ExecuteSqlInterpolatedAsync($"""
                    INSERT INTO Recipes (Id, Name, Category, BaseServings, IsFavorite)
                    VALUES ({recipeId}, 'Upgrade recipe', {(int)RecipeCategory.Meals}, 2, 0);
                    INSERT INTO RecipeProfile (Id, RecipeId, Name, Servings)
                    VALUES ({profileId}, {recipeId}, 'Default', 2);
                    INSERT INTO RecipeProfileProduct (Id, RecipeProfileId, Name, Quantity, AtHome, "Order")
                    VALUES ({sourceId}, {profileId}, 'Rice', 2, 0, 0);
                    INSERT INTO PlanningCycles (Id, StartDate, EndDate)
                    VALUES ({cycleId}, {date}, {date.AddDays(6)});
                    INSERT INTO Plannings (Id, PlanningCycleId) VALUES ({planId}, {cycleId});
                    INSERT INTO PlanningEntry (Id, PlanningId, Date, SortOrder, EntryType, RecipeId, RecipeProfileId)
                    VALUES ({mealId}, {planId}, {date}, 0, 'meal', {recipeId}, {profileId}),
                           ({emptyMealId}, {planId}, {date}, 1, 'meal', {recipeId}, {profileId});
                    INSERT INTO PlanningEntry (Id, PlanningId, Date, SortOrder, EntryType, OriginalMealId)
                    VALUES ({leftoverId}, {planId}, {date.AddDays(1)}, 0, 'leftover', {mealId});
                    INSERT INTO PlanningNote (Id, PlanningId, Date, Text)
                    VALUES ({Guid.NewGuid()}, {planId}, {date}, 'Visitors');
                    INSERT INTO MealGroceries (Id, PlanningMealId)
                    VALUES ({Guid.NewGuid()}, {mealId}), ({Guid.NewGuid()}, {emptyMealId});
                    INSERT INTO GroceryLists (Id, PlanningCycleId) VALUES ({listId}, {cycleId});
                    INSERT INTO GroceryItem (Id, GroceryListId, PlanningMealId, RecipeProfileProductId, Name, Quantity, "Order", Checked)
                    VALUES ({itemId}, {listId}, {mealId}, {sourceId}, 'Rice pack', 2, 0, 1);
                    INSERT INTO SupermarketProductMappings (Id, RecipeProfileProductId, Provider, ProductId, ProductName, Pack)
                    VALUES ({Guid.NewGuid()}, {sourceId}, {(int)SupermarketProvider.Picnic}, 's1001', 'Rice', '1 kg');
                    """);
            }

            await using var after = new ApplicationDbContext(options);
            await after.Database.MigrateAsync();
            var plan = await new MealPlanQueries(after).GetCycleMealPlan(cycleId);
            Assert.Equal(planId, plan.Id);
            Assert.Equal(3, plan.Entries.Count);
            Assert.All(plan.Entries, entry => Assert.True(entry.HasReviewedGroceries));
            Assert.Equal(mealId, plan.Entries.Single(entry => entry.Id == leftoverId).OriginalMealId);
            Assert.Equal("Visitors", Assert.Single(plan.Notes).Text);
            var list = await new ShoppingListQueries(after).GetCycleShoppingList(cycleId);
            Assert.Equal(listId, list.Id);
            Assert.Empty(list.Items);
            Assert.Empty(list.MealGroups.Single(group => group.Meal.Id == emptyMealId).Items);
            var item = Assert.Single(list.MealGroups.Single(group => group.Meal.Id == mealId).Items);
            Assert.Equal(itemId, item.Id);
            Assert.Equal(sourceId, item.RecipeProfileGroceryItemId);
            Assert.True(item.Checked);
            Assert.Equal(2, item.Quantity);
            Assert.Equal("s1001", (await after.SupermarketProductMappings.SingleAsync()).ProductId);
            Assert.Equal(sourceId, (await after.Set<RecipeProfileGroceryItem>().SingleAsync()).Id);
        }
        finally
        {
            foreach (var suffix in new[] { "", "-wal", "-shm" }) File.Delete(path + suffix);
        }
    }
}
