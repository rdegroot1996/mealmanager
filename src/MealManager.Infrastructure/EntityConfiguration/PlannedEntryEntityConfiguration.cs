using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class PlannedEntryEntityConfiguration : IEntityTypeConfiguration<PlannedEntry>
{
    public void Configure(EntityTypeBuilder<PlannedEntry> builder)
    {
        builder.Property(entry => entry.Id).ValueGeneratedNever();
        builder.HasDiscriminator<string>("EntryType")
            .HasValue<PlannedMeal>("meal")
            .HasValue<PlannedLeftover>("leftover");

        builder.HasIndex(entry => new { entry.MealPlanId, entry.Date, entry.SortOrder })
            .IsUnique();

        builder.ToTable("PlannedEntry", table => table.HasCheckConstraint(
            "CK_PlannedEntry_ValidKind",
            "(EntryType = 'meal' AND OriginalMealId IS NULL AND RecipeId IS NOT NULL AND RecipeProfileId IS NOT NULL) " +
            "OR (EntryType = 'leftover' AND OriginalMealId IS NOT NULL AND RecipeId IS NULL AND RecipeProfileId IS NULL)"));
    }
}
