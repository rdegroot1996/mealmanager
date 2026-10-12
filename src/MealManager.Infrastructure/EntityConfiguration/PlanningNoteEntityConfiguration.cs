using MealManager.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace MealManager.Infrastructure.EntityConfiguration;

public class PlanningNoteEntityConfiguration : IEntityTypeConfiguration<PlanningNote>
{
    public void Configure(EntityTypeBuilder<PlanningNote> builder)
    {
        builder.HasIndex(note => new { note.PlanningId, note.Date }).IsUnique();
    }
}
