using MealManager.Application.Supermarkets;
using MealManager.Domain.Contracts;
using MealManager.Domain.Entities;
using MealManager.Infrastructure.Database;
using MealManager.Infrastructure.Supermarkets;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace MealManager.Application.Commands;

public sealed class SupermarketSendCommands(
    ApplicationDbContext dbContext,
    SupermarketProviders supermarkets,
    SupermarketQueries queries,
    IServiceScopeFactory scopes)
{
    public async Task<SupermarketSendDto> Send(Guid cycleId, SendSupermarketDto command, CancellationToken ct)
    {
        using var deadline = new CancellationTokenSource(SupermarketLimits.SendTimeout);
        using var operation = CancellationTokenSource.CreateLinkedTokenSource(ct, deadline.Token);
        var token = operation.Token;
        var groceries = await queries.Groceries(cycleId, token);
        CheckRevision(groceries, command.Revision);
        ValidateSelection(command, groceries);
        var adapter = supermarkets.Provider(command.Provider);
        var connection = await supermarkets.Connection(command.Provider, token);
        if (command.AccountId != connection.AccountId || command.ConnectionGeneration != connection.Generation)
            throw new InvalidOperationError(ErrorCodes.SupermarketConnectionRequired, "The supermarket connection changed. Open a new review.");
        var profileIds = groceries.Where(x => x.RecipeProfileGroceryItemId.HasValue).Select(x => x.RecipeProfileGroceryItemId!.Value).Distinct().ToArray();
        var mappings = await dbContext.SupermarketProductMappings.AsNoTracking()
            .Where(x => x.Provider == command.Provider && profileIds.Contains(x.RecipeProfileGroceryItemId)).ToDictionaryAsync(x => x.RecipeProfileGroceryItemId, token);
        var remembered = command.Items.Where(x => groceries.Single(g => g.Id == x.ShoppingListItemId).RecipeProfileGroceryItemId is Guid id && (x.Remember || !mappings.ContainsKey(id)))
            .GroupBy(x => groceries.Single(g => g.Id == x.ShoppingListItemId).RecipeProfileGroceryItemId);
        if (remembered.Any(x => x.Select(s => s.ProductId).Distinct().Count() > 1)) throw InvalidSelection();
        var products = new Dictionary<string, SupermarketProduct>();
        try
        {
            foreach (var total in command.Totals)
            {
                var product = await adapter.GetProduct(total.ProductId, connection, token);
                if (product.Availability != ProductAvailability.Available || total.Quantity > (product.MaxQuantity ?? SupermarketLimits.MaxQuantity))
                    throw InvalidSelection();
                products.Add(product.Id, product);
            }
        }
        catch (SupermarketException exception)
        {
            throw SupermarketProviders.Error(exception);
        }
        CheckRevision(await queries.Groceries(cycleId, token), command.Revision);

        var results = new List<SupermarketSendLineDto>();
        string? stopped = null;
        foreach (var total in command.Totals)
        {
            var product = products[total.ProductId];
            var selections = command.Items.Where(x => x.ProductId == product.Id).ToArray();
            var sources = selections.Select(x => groceries.Single(g => g.Id == x.ShoppingListItemId)).ToArray();
            var outcome = "NotAttempted";
            string? reason = stopped;
            string? warning = null;
            if (stopped is null && token.IsCancellationRequested) stopped = reason = "Deadline";
            if (stopped is null)
            {
                try
                {
                    await adapter.AddProduct(product.Id, total.Quantity, connection, token);
                    outcome = "Added";
                }
                catch (SupermarketException ex)
                {
                    outcome = ex.Failure switch
                    {
                        SupermarketFailure.Uncertain => "Unknown",
                        SupermarketFailure.LocalPersistence => "Added",
                        SupermarketFailure.ConnectionChanged => "NotAttempted",
                        _ => "Failed",
                    };
                    reason = ex.Failure.ToString();
                    if (ex.Failure == SupermarketFailure.LocalPersistence) warning = "LocalPersistence";
                    if (ex.Failure is SupermarketFailure.SessionExpired or SupermarketFailure.ConnectionChanged or SupermarketFailure.Uncertain or SupermarketFailure.LocalPersistence)
                        stopped = reason;
                }
                catch (OperationCanceledException)
                {
                    stopped = reason = "Deadline";
                }
                catch (InvalidOperationError)
                {
                    stopped = reason = "ConnectionChanged";
                }
                catch (Exception)
                {
                    // Once a mutation was invoked an unexpected failure must not hide prior successes.
                    outcome = "Unknown";
                    stopped = reason = "Uncertain";
                }
                if (outcome == "Added")
                {
                    try
                    {
                        using var cleanup = new CancellationTokenSource(SupermarketLimits.LocalSaveTimeout);
                        var localWarning = await CompleteLocal(command, product, selections, sources, mappings, cleanup.Token);
                        warning ??= localWarning;
                    }
                    catch (Exception)
                    {
                        warning = "LocalPersistence";
                        stopped = "LocalPersistence";
                    }
                }
            }
            results.Add(new SupermarketSendLineDto
            {
                ProductId = product.Id,
                ProductName = product.Name,
                Pack = product.Pack,
                Quantity = total.Quantity,
                Outcome = outcome,
                Reason = reason,
                ShoppingListItemIds = sources.Select(x => x.Id).ToArray(),
                LocalWarning = warning,
            });
        }
        return new SupermarketSendDto
        {
            PlanningCycleId = cycleId,
            Provider = command.Provider,
            AccountId = command.AccountId,
            AccountLabel = connection.AccountLabel ?? "",
            ConnectionGeneration = connection.Generation,
            Lines = results,
        };
    }

    private async Task<string?> CompleteLocal(SendSupermarketDto command, SupermarketProduct product, SupermarketSelectionDto[] selections,
        ShoppingListItem[] sources, Dictionary<Guid, SupermarketProductMapping> originals, CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var local = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
        await using var transaction = await local.Database.BeginTransactionAsync(ct);
        var sourceIds = sources.Select(x => x.Id).ToArray();
        var current = await local.Set<ShoppingListItem>().Where(x => sourceIds.Contains(x.Id)).ToDictionaryAsync(x => x.Id, ct);
        var profileIds = sources.Where(x => x.RecipeProfileGroceryItemId.HasValue).Select(x => x.RecipeProfileGroceryItemId!.Value).Distinct().ToArray();
        var survivingProfiles = await local.Set<RecipeProfileGroceryItem>().Where(x => profileIds.Contains(x.Id)).Select(x => x.Id).ToListAsync(ct);
        var mappings = await local.SupermarketProductMappings.Where(x => x.Provider == command.Provider && profileIds.Contains(x.RecipeProfileGroceryItemId))
            .ToDictionaryAsync(x => x.RecipeProfileGroceryItemId, ct);
        var connectionJson = await local.AppSettings.Where(x => x.Key == ProviderSettingsStore.Key(command.Provider)).Select(x => x.Value).SingleOrDefaultAsync(ct);
        var sameConnection = command.Provider != MealManager.Common.Enums.SupermarketProvider.Picnic ||
            ProviderSettingsStore.Picnic(connectionJson).ConnectionGeneration == command.ConnectionGeneration;
        string? warning = null;
        var updatedProfiles = new HashSet<Guid>();
        foreach (var source in sources)
        {
            if (!current.TryGetValue(source.Id, out var item) || item.Name != source.Name || item.Quantity != source.Quantity || item.RecipeProfileGroceryItemId != source.RecipeProfileGroceryItemId)
                continue;
            item.Checked = true;
            if (!sameConnection)
            {
                warning = "MappingChanged";
                continue;
            }
            if (source.RecipeProfileGroceryItemId is not Guid profileId || !survivingProfiles.Contains(profileId)) continue;
            var selection = selections.Single(x => x.ShoppingListItemId == source.Id);
            originals.TryGetValue(profileId, out var original);
            if (!selection.Remember && original is not null) continue;
            if (updatedProfiles.Contains(profileId)) continue;
            mappings.TryGetValue(profileId, out var mapping);
            if ((original is null && mapping is not null && mapping.ProductId != product.Id) ||
                (original is not null && (mapping is null || mapping.ProductId != original.ProductId || mapping.ProductName != original.ProductName || mapping.Pack != original.Pack)))
            {
                warning = "MappingChanged";
                continue;
            }
            if (mapping is null)
            {
                mapping = new()
                {
                    Id = Guid.CreateVersion7(),
                    Provider = command.Provider,
                    RecipeProfileGroceryItemId = profileId,
                    ProductId = product.Id,
                    ProductName = product.Name,
                    Pack = product.Pack,
                };
                local.Add(mapping);
                mappings.Add(profileId, mapping);
            }
            else
            {
                mapping.ProductId = product.Id;
                mapping.ProductName = product.Name;
                mapping.Pack = product.Pack;
            }
            updatedProfiles.Add(profileId);
        }
        await local.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return warning;
    }

    private static void ValidateSelection(SendSupermarketDto command, List<ShoppingListItem> groceries)
    {
        var ids = groceries.Select(x => x.Id).ToHashSet();
        var productIds = command.Items.Select(x => x.ProductId).ToHashSet();
        if (command.Items.Select(x => x.ShoppingListItemId).Distinct().Count() != command.Items.Count || command.Items.Any(x => !ids.Contains(x.ShoppingListItemId)) ||
            command.Totals.Count != productIds.Count || command.Totals.Select(x => x.ProductId).Distinct().Count() != productIds.Count || command.Totals.Any(x => !productIds.Contains(x.ProductId)))
            throw InvalidSelection();
    }
    private static void CheckRevision(List<ShoppingListItem> items, string revision)
    {
        if (SupermarketQueries.Revision(items) != revision)
            throw new InvalidOperationError(ErrorCodes.SupermarketReviewChanged, "The groceries changed. Reopen the supermarket review.");
    }
    private static InvalidOperationError InvalidSelection() => new(ErrorCodes.SupermarketSelectionInvalid, "Select valid products and whole pack quantities.");
}
