using MealManager.Domain.Contracts;
namespace MealManager.Infrastructure.Supermarkets;

public interface IPicnicApiClient
{
    Task<PicnicSession> Login(string email, string password, string countryCode, CancellationToken ct);
    Task RequestCode(PicnicAccess access, CancellationToken ct);
    Task VerifyCode(PicnicAccess access, string code, CancellationToken ct);
    Task<SupermarketAccount> GetAccount(PicnicAccess access, CancellationToken ct);
    Task<IReadOnlyList<SupermarketProduct>> Search(PicnicAccess access, string query, CancellationToken ct);
    Task<SupermarketProduct> GetProduct(PicnicAccess access, string id, CancellationToken ct);
    Task AddProduct(PicnicAccess access, string id, int quantity, CancellationToken ct);
}
