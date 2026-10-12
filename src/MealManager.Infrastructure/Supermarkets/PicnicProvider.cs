using MealManager.Common.Enums;
using MealManager.Domain.Contracts;

namespace MealManager.Infrastructure.Supermarkets;

public sealed class PicnicProvider(ProviderSettingsStore store, PicnicSessions sessions) : ISupermarketProvider
{
    public SupermarketProvider Id => SupermarketProvider.Picnic;
    public string Name => "Picnic";
    public async Task<SupermarketConnectionInfo> GetConnection(CancellationToken ct)
    {
        var settings = ProviderSettingsStore.Picnic(await store.Read(Id, ct));
        var status = settings.Status is "Connected" or "ReconnectRequired" ? settings.Status : "Disconnected";
        return new(status, settings.AccountId, settings.AccountLabel, settings.ConnectionGeneration);
    }
    public Task<IReadOnlyList<SupermarketProduct>> Search(string query, SupermarketConnectionInfo connection, CancellationToken ct) =>
        sessions.Use(connection, (api, access) => api.Search(access, query, ct), ct);
    public Task<SupermarketProduct> GetProduct(string id, SupermarketConnectionInfo connection, CancellationToken ct) =>
        sessions.Use(connection, (api, access) => api.GetProduct(access, id, ct), ct);
    public async Task AddProduct(string id, int quantity, SupermarketConnectionInfo connection, CancellationToken ct) =>
        await sessions.Use(connection, async (api, access) => { await api.AddProduct(access, id, quantity, ct); return true; }, ct, mutation: true);
}
