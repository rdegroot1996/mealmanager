using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class PlanningEntityConfiguration : IEntityTypeConfiguration<Planning>
{
    public void Configure(EntityTypeBuilder<Planning> builder)
    {
        builder.HasIndex(p => p.PlanningCycleId).IsUnique();

        builder.HasMany(p => p.Entries)
            .WithOne(entry => entry.Planning)
            .HasForeignKey(entry => entry.PlanningId)
            .IsRequired();
    }
}
