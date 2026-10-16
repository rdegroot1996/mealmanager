using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class MealPlanEntityConfiguration : IEntityTypeConfiguration<MealPlan>
{
    public void Configure(EntityTypeBuilder<MealPlan> builder)
    {

        builder.HasIndex(p => p.PlanningCycleId).IsUnique();

        builder.HasMany(p => p.Entries)
            .WithOne(entry => entry.MealPlan)
            .HasForeignKey(entry => entry.MealPlanId)
            .IsRequired();
    }
}
