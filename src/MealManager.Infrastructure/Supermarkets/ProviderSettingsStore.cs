using System.Text.Json;
using MealManager.Common.Enums;
using MealManager.Common.Errors;
using MealManager.Domain.Contracts;
using MealManager.Infrastructure.Database;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MealManager.Infrastructure.Supermarkets;

// Each operation owns its context: token writes cannot flush a caller's grocery mutations.
public sealed class ProviderSettingsStore(IServiceScopeFactory scopes)
{
    public static string Key(SupermarketProvider provider) => $"Supermarkets:{provider.ToString().ToLowerInvariant()}";

    public async Task<string?> Read(SupermarketProvider provider, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        return await db.AppSettings.AsNoTracking().Where(x => x.Key == Key(provider)).Select(x => x.Value).SingleOrDefaultAsync(ct);
    }

    public static PicnicSettings Picnic(string? json)
    {
        if (json is null) return new();
        try
        {
            var value = JsonSerializer.Deserialize<PicnicSettings>(json);
            if (value is null || value.SchemaVersion != 1 || value.ConnectionGeneration == Guid.Empty ||
                !PicnicProtocol.ValidCountry(value.CountryCode) ||
                value.Status is not ("Disconnected" or "Connected" or "VerificationRequired" or "ReconnectRequired"))
                throw new JsonException();
            return value;
        }
        catch (JsonException)
        {
            throw new InvalidOperationError(ErrorCodes.SupermarketAuthentication, "The Picnic connection cannot be read. Reset it in Settings.");
        }
    }

    public async Task Write(SupermarketProvider provider, string? previous, object value, CancellationToken ct, bool clearMappings = false)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var key = Key(provider);
        var json = JsonSerializer.Serialize(value);
        if (previous is null)
        {
            db.AppSettings.Add(new() { Key = key, Value = json });
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException) { throw new SupermarketException(SupermarketFailure.ConnectionChanged); }
        }
        else if (await db.AppSettings.Where(x => x.Key == key && x.Value == previous)
            .ExecuteUpdateAsync(update => update.SetProperty(x => x.Value, json), ct) != 1)
            throw new SupermarketException(SupermarketFailure.ConnectionChanged);
        if (clearMappings)
            await db.SupermarketProductMappings.Where(x => x.Provider == provider).ExecuteDeleteAsync(ct);
        await transaction.CommitAsync(ct);
    }
}
