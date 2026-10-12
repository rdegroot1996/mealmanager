using MealManager.Common.Enums;
namespace MealManager.Domain.Contracts;

// Shopping capabilities only. Authentication and credentials belong to each adapter.
public interface ISupermarketProvider
{
    SupermarketProvider Id { get; }
    string Name { get; }
    Task<SupermarketConnectionInfo> GetConnection(CancellationToken ct);
    Task<IReadOnlyList<SupermarketProduct>> Search(string query, SupermarketConnectionInfo connection, CancellationToken ct);
    Task<SupermarketProduct> GetProduct(string id, SupermarketConnectionInfo connection, CancellationToken ct);
    Task AddProduct(string id, int quantity, SupermarketConnectionInfo connection, CancellationToken ct);
}
