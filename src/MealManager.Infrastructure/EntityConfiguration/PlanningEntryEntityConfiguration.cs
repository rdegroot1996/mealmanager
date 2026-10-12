using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class PlanningEntryEntityConfiguration : IEntityTypeConfiguration<PlanningEntry>
{
    public void Configure(EntityTypeBuilder<PlanningEntry> builder)
    {
        builder.Property(entry => entry.Id).ValueGeneratedNever();
        builder.HasDiscriminator<string>("EntryType")
            .HasValue<PlanningMeal>("meal")
            .HasValue<PlanningLeftover>("leftover");

        builder.HasIndex(entry => new { entry.PlanningId, entry.Date, entry.SortOrder })
            .IsUnique();

        builder.ToTable("PlanningEntry", table => table.HasCheckConstraint(
            "CK_PlanningEntry_ValidKind",
            "(EntryType = 'meal' AND OriginalMealId IS NULL AND RecipeId IS NOT NULL AND RecipeProfileId IS NOT NULL) " +
            "OR (EntryType = 'leftover' AND OriginalMealId IS NOT NULL AND RecipeId IS NULL AND RecipeProfileId IS NULL)"));
    }
}
