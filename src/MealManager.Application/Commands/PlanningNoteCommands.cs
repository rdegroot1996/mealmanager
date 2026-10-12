using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public class PlanningNoteCommands(ApplicationDbContext dbContext, PlanningCycleAccess cycleAccess)
{
    public async Task<PlanningNoteDto> AddPlanningNote(AddPlanningNoteDto command)
    {
        var planning = await dbContext.Plannings
                .Include(p => p.Notes)
                .FirstOrDefaultAsync(p => p.Id == command.PlanningId)
         ?? throw new NotFoundError(nameof(Planning));
        await cycleAccess.EnsureDateInCycle(planning.PlanningCycleId, command.Date);

        if (planning.Notes.Any(note => note.Date == command.Date))
        {
            throw new InvalidOperationError(
                ErrorCodes.PlanningNoteExists,
                "A planning note already exists for this date.");
        }

        var note = new PlanningNote
        {
            Id = Guid.CreateVersion7(),
            PlanningId = planning.Id,
            Date = command.Date,
            Text = command.Text,
        };

        planning.Notes.Add(note);
        await dbContext.SaveChangesAsync();

        return new PlanningNoteDto
        {
            Id = note.Id,
            Date = note.Date,
            Text = note.Text,
        };
    }

    public async Task DeletePlanningNote(Guid id)
    {
        var planning = await dbContext.Plannings
                .Include(p => p.Notes)
                .Where(p => p.Notes.Any(n => n.Id == id))
                .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(PlanningNote));
        await cycleAccess.EnsureEditable(planning.PlanningCycleId);
        var note = planning.Notes.First(n => n.Id == id);

        dbContext.Remove(note);
        await dbContext.SaveChangesAsync();
    }

    public async Task<PlanningNoteDto> UpdatePlanningNote(Guid id, UpdatePlanningNoteDto command)
    {
        var planning = await dbContext.Plannings
                .Include(p => p.Notes)
                .Where(p => p.Notes.Any(n => n.Id == id))
                .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(PlanningNote));
        await cycleAccess.EnsureEditable(planning.PlanningCycleId);
        var note = planning.Notes.First(n => n.Id == id);

        note.Text = command.Text;
        await dbContext.SaveChangesAsync();

        return note.ToDto();
    }
}
