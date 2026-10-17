using MealManager.Domain;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Authentication;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Infrastructure.Database;

public class ApplicationDbContext : IdentityDbContext<User, Role, Guid>
{
    public DbSet<AppSetting> AppSettings { get; set; }

    public DbSet<Recipe> Recipes { get; set; }

    public DbSet<PlanningCycle> PlanningCycles { get; set; }

    public DbSet<MealPlan> MealPlans { get; set; }

    public DbSet<ShoppingList> ShoppingLists { get; set; }

    public DbSet<SupermarketProductMapping> SupermarketProductMappings { get; set; }


    public ApplicationDbContext(
        DbContextOptions options) : base(options)
    {
    }

    protected override void ConfigureConventions(ModelConfigurationBuilder configurationBuilder)
    {
        base.ConfigureConventions(configurationBuilder);

        // Configure DateTime properties to be of kind UTC
        configurationBuilder.Properties<DateTime>().HaveConversion<DateTimeUtcConverter>();
        configurationBuilder.Properties<DateTime?>().HaveConversion<NullableDateTimeUtcConverter>();
    }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
