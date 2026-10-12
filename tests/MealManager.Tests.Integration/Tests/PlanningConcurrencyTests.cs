using MealManager.Application.DTO.Mcp;
using MealManager.Application;
using MealManager.Application.Commands;
using MealManager.Application.DTO;
using MealManager.Application.Queries;
using MealManager.Common.Errors;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public sealed class PlanningConcurrencyTests
{
    [Fact]
    public async Task CompetingIndependentConnectionsCannotBothApplyTheSameVersion()
    {
        var databasePath = Path.Combine(Path.GetTempPath(), $"mealmanager-mcp-{Guid.NewGuid():N}.db");
        await using var services = new ServiceCollection()
            .AddDbContext<ApplicationDbContext>(options => options.UseSqlite($"Data Source={databasePath};Pooling=False;Default Timeout=1"))
            .RegisterApplicationServices().BuildServiceProvider();
        try
        {
            PlanningStateDto initial;
            using (var setup = services.CreateScope())
            {
                await setup.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureCreatedAsync();
                initial = await setup.ServiceProvider.GetRequiredService<PlanningReplacementCommands>().Create(new CreateCyclePlanningDto
                {
                    StartDate = new DateOnly(2026, 10, 6),
                    EndDate = new DateOnly(2026, 10, 12),
                });
            }
            var gate = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
            async Task<string> Apply(string text)
            {
                using var scope = services.CreateScope();
                await gate.Task;
                try
                {
                    await scope.ServiceProvider.GetRequiredService<PlanningReplacementCommands>().Apply(new ApplyPlanningDto
                    {
                        CycleId = initial.Cycle!.Id,
                        ExpectedPlanningVersion = initial.PlanningVersion,
                        Entries = [],
                        Notes = [new PlanningNoteInputDto { ClientKey = "note", Date = initial.Cycle.StartDate, Text = text }],
                    });
                    return "success";
                }
                catch (InvalidOperationError error)
                {
                    return error.ErrorCode;
                }
            }
            var first = Task.Run(() => Apply("First plan"));
            var second = Task.Run(() => Apply("Second plan"));
            gate.SetResult();
            var results = await Task.WhenAll(first, second);
            Assert.Single(results, result => result == "success");
            Assert.Single(results, result => result == ErrorCodes.PlanningChanged);

            using var read = services.CreateScope();
            var current = await read.ServiceProvider.GetRequiredService<PlanningStateQueries>().GetActivePlanning();
            Assert.Single(current.Planning!.Notes);
            Assert.NotEqual(initial.PlanningVersion, current.PlanningVersion);

            // A reader must still see committed planning while another connection has a pending write.
            using var reservation = services.CreateScope();
            var db = reservation.ServiceProvider.GetRequiredService<ApplicationDbContext>();
            await using var transaction = await db.Database.BeginTransactionAsync();
            var cycle = await db.PlanningCycles.SingleAsync(item => item.Id == current.Cycle!.Id);
            cycle.EndDate = cycle.EndDate.AddDays(1);
            await db.SaveChangesAsync();
            var duringWrite = await read.ServiceProvider.GetRequiredService<PlanningStateQueries>().GetActivePlanning();
            Assert.Equal(current.Cycle!.EndDate, duringWrite.Cycle!.EndDate);
            Assert.Equal(current.PlanningVersion, duringWrite.PlanningVersion);

            // Competing mutations still require an immediate reservation and a fresh version.
            using var contender = services.CreateScope();
            var error = await Assert.ThrowsAsync<InvalidOperationError>(() =>
                contender.ServiceProvider.GetRequiredService<PlanningReplacementCommands>().Apply(new ApplyPlanningDto
                {
                    CycleId = current.Cycle!.Id,
                    ExpectedPlanningVersion = current.PlanningVersion,
                    Entries = [],
                    Notes = [],
                }));
            Assert.Equal(ErrorCodes.PlanningChanged, error.ErrorCode);
            await transaction.RollbackAsync();
            var afterContention = await read.ServiceProvider.GetRequiredService<PlanningStateQueries>().GetActivePlanning();
            Assert.Equal(current.PlanningVersion, afterContention.PlanningVersion);
        }
        finally
        {
            using var cleanup = services.CreateScope();
            await cleanup.ServiceProvider.GetRequiredService<ApplicationDbContext>().Database.EnsureDeletedAsync();
        }
    }
}
