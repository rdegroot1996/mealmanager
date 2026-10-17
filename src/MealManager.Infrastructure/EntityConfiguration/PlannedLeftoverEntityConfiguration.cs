using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class PlannedLeftoverEntityConfiguration : IEntityTypeConfiguration<PlannedLeftover>
{
    public void Configure(EntityTypeBuilder<PlannedLeftover> builder)
    {
        builder.HasIndex(leftover => new { leftover.OriginalMealId, leftover.Date })
            .IsUnique();
    }
}
