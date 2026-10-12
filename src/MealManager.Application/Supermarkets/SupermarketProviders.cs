using MealManager.Common.Enums;
using MealManager.Domain.Contracts;

namespace MealManager.Application.Supermarkets;

// Registry and account-bound shopping access. No provider credentials or login flow.
public sealed class SupermarketProviders(IEnumerable<ISupermarketProvider> providers)
{
    public ISupermarketProvider Provider(SupermarketProvider id) => providers.SingleOrDefault(x => x.Id == id) ?? throw new NotFoundError("Supermarket");
    public IEnumerable<ISupermarketProvider> Providers => providers;
    public async Task<SupermarketConnectionInfo> Connection(SupermarketProvider id, CancellationToken ct)
    {
        var connection = await Provider(id).GetConnection(ct);
        if (connection.Status != "Connected" || connection.AccountId is null)
            throw new InvalidOperationError(ErrorCodes.SupermarketConnectionRequired, "Connect or reconnect this supermarket in Settings.");
        return connection;
    }
    public static InvalidOperationError Error(SupermarketException ex) => new(
        ex.Failure is SupermarketFailure.SessionExpired or SupermarketFailure.ConnectionChanged
            ? ErrorCodes.SupermarketConnectionRequired : ErrorCodes.SupermarketRequestFailed,
        ex.Failure switch
        {
            SupermarketFailure.SessionExpired => "Your supermarket session expired. Reconnect in Settings.",
            SupermarketFailure.ConnectionChanged => "The supermarket connection changed. Open a new review.",
            _ => "The supermarket request could not be completed. Try again later.",
        });
}
