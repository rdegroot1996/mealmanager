using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class PlanningDayNoteEntityConfiguration : IEntityTypeConfiguration<PlanningDayNote>
{
    public void Configure(EntityTypeBuilder<PlanningDayNote> builder)
    {

        builder.HasIndex(note => new { note.MealPlanId, note.Date }).IsUnique();
    }
}
