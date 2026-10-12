using MealManager.Common.Enums;
using MealManager.Application.Mapping;
using MealManager.Infrastructure.Supermarkets;
namespace MealManager.Application.Queries;

public sealed class PicnicConnectionQueries(ProviderSettingsStore store)
{
    public async Task<PicnicConnectionDto> Get(CancellationToken ct) =>
        ProviderSettingsStore.Picnic(await store.Read(SupermarketProvider.Picnic, ct)).ToDto();
}
