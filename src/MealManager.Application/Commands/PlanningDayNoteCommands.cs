using MealManager.Application.Mapping;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;

namespace MealManager.Application.Commands;

public class PlanningDayNoteCommands(ApplicationDbContext dbContext, PlanningCycleAccess cycleAccess)
{
    public async Task<PlanningDayNoteDto> AddPlanningDayNote(AddPlanningDayNoteDto command)
    {
        var mealPlan = await dbContext.MealPlans
                .Include(p => p.Notes)
                .FirstOrDefaultAsync(p => p.Id == command.MealPlanId)
         ?? throw new NotFoundError(nameof(MealPlan));
        await cycleAccess.EnsureDateInCycle(mealPlan.PlanningCycleId, command.Date);

        if (mealPlan.Notes.Any(note => note.Date == command.Date))
        {
            throw new InvalidOperationError(
                ErrorCodes.PlanningDayNoteExists,
                "A meal plan note already exists for this date.");
        }

        var note = new PlanningDayNote
        {
            Id = Guid.CreateVersion7(),
            MealPlanId = mealPlan.Id,
            Date = command.Date,
            Text = command.Text,
        };

        mealPlan.Notes.Add(note);
        await dbContext.SaveChangesAsync();

        return new PlanningDayNoteDto
        {
            Id = note.Id,
            Date = note.Date,
            Text = note.Text,
        };
    }

    public async Task DeletePlanningDayNote(Guid id)
    {
        var mealPlan = await dbContext.MealPlans
                .Include(p => p.Notes)
                .Where(p => p.Notes.Any(n => n.Id == id))
                .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(PlanningDayNote));
        await cycleAccess.EnsureEditable(mealPlan.PlanningCycleId);
        var note = mealPlan.Notes.First(n => n.Id == id);

        dbContext.Remove(note);
        await dbContext.SaveChangesAsync();
    }

    public async Task<PlanningDayNoteDto> UpdatePlanningDayNote(Guid id, UpdatePlanningDayNoteDto command)
    {
        var mealPlan = await dbContext.MealPlans
                .Include(p => p.Notes)
                .Where(p => p.Notes.Any(n => n.Id == id))
                .FirstOrDefaultAsync()
         ?? throw new NotFoundError(nameof(PlanningDayNote));
        await cycleAccess.EnsureEditable(mealPlan.PlanningCycleId);
        var note = mealPlan.Notes.First(n => n.Id == id);

        note.Text = command.Text;
        await dbContext.SaveChangesAsync();

        return note.ToDto();
    }
}
