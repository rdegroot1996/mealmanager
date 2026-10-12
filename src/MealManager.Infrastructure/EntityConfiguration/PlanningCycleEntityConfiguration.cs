using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class PlanningCycleEntityConfiguration : IEntityTypeConfiguration<PlanningCycle>
{
    public void Configure(EntityTypeBuilder<PlanningCycle> builder)
    {
        builder.HasIndex(cycle => cycle.StartDate).IsUnique();
    }
}
