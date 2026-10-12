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
            .AddTransient<MealManager.Application.Supermarkets.SupermarketProviders>()
            .AddTransient<UserCommands>()
            .AddTransient<RecipeCommands>()
            .AddTransient<RecipeEditCommands>()
            .AddTransient<RecipeImageCommands>()
            .AddTransient<RecipeProfileCommands>()
            .AddTransient<PlanningCycleCommands>()
            .AddTransient<PlanningReplacementCommands>()
            .AddTransient<PlanningMealCommands>()
            .AddTransient<PlanningNoteCommands>()
            .AddTransient<GroceryListCommands>()
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
            .AddTransient<PlanningQueries>()
            .AddTransient<PlanningStateQueries>()
            .AddTransient<GroceryListQueries>();
}
