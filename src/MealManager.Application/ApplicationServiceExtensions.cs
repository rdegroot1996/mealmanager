using MealManager.Application.Supermarkets;
using Microsoft.Extensions.DependencyInjection;

namespace MealManager.Application;

public static class ApplicationServiceExtensions
{
    public static IServiceCollection RegisterApplicationServices(this IServiceCollection services) =>
        services
            .AddValidatorsFromAssemblyContaining(typeof(ApplicationServiceExtensions))
            .AddCommands()
            .AddQueries();

    private static IServiceCollection AddCommands(this IServiceCollection services) =>
        services
            .AddTransient<ConfigCommands>()
            .AddTransient<PicnicConnectionCommands>()
            .AddTransient<SupermarketSendCommands>()
            .AddTransient<SupermarketProviders>()
            .AddTransient<UserCommands>()
            .AddTransient<PasswordCommands>()
            .AddTransient<RecipeCommands>()
            .AddTransient<RecipeEditCommands>()
            .AddTransient<RecipeImageCommands>()
            .AddTransient<RecipeProfileCommands>()
            .AddTransient<PlanningCycleCommands>()
            .AddTransient<MealPlanReplacementCommands>()
            .AddTransient<PlannedMealCommands>()
            .AddTransient<PlanningDayNoteCommands>()
            .AddTransient<ShoppingListCommands>()
            .AddTransient<PlanningCycleAccess>();

    private static IServiceCollection AddQueries(this IServiceCollection services) =>
        services
            .AddTransient<ConfigQueries>()
            .AddTransient<SupermarketQueries>()
            .AddTransient<PicnicConnectionQueries>()
            .AddTransient<UserQueries>()
            .AddTransient<RecipeQueries>()
            .AddTransient<RecipeDiscoveryQueries>()
            .AddTransient<RecipeCatalogQueries>()
            .AddTransient<RecipeImageQueries>()
            .AddTransient<RecipeProfileQueries>()
            .AddTransient<PlanningCycleQueries>()
            .AddTransient<MealPlanQueries>()
            .AddTransient<MealPlanStateQueries>()
            .AddTransient<ShoppingListQueries>();
}
