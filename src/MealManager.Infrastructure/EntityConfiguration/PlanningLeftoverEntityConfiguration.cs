using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class PlanningLeftoverEntityConfiguration : IEntityTypeConfiguration<PlanningLeftover>
{
    public void Configure(EntityTypeBuilder<PlanningLeftover> builder)
    {
        builder.HasIndex(leftover => new { leftover.OriginalMealId, leftover.Date })
            .IsUnique();
    }
}
