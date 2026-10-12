using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class PlanningMealEntityConfiguration : IEntityTypeConfiguration<PlanningMeal>
{
    public void Configure(EntityTypeBuilder<PlanningMeal> builder)
    {
        builder.HasOne(meal => meal.Recipe)
            .WithMany()
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(meal => meal.RecipeProfile)
            .WithMany()
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasMany(meal => meal.Leftovers)
            .WithOne(leftover => leftover.OriginalMeal)
            .HasForeignKey(leftover => leftover.OriginalMealId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
