using MealManager.Common.Enums;
using MealManager.Domain.Contracts;
namespace MealManager.Api.Controllers;

[ApiController]
[Route("api/supermarkets")]
[ResponseCache(NoStore = true, Location = ResponseCacheLocation.None)]
public class SupermarketController : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<SupermarketConnectionDto>> Providers([FromServices] SupermarketQueries queries) => queries.Providers();

    [HttpGet("{provider}/products")]
    public Task<IReadOnlyList<SupermarketProduct>> Search(SupermarketProvider provider, string query, [FromServices] SupermarketQueries queries, CancellationToken ct) => queries.Search(provider, query, ct);

    [HttpGet("cycles/{cycleId:guid}/review")]
    public Task<SupermarketReviewDto> Review(Guid cycleId, SupermarketProvider provider, [FromServices] SupermarketQueries queries, CancellationToken ct) => queries.Review(cycleId, provider, ct);

    [HttpPost("cycles/{cycleId:guid}/send")]
    public Task<SupermarketSendDto> Send(Guid cycleId, SendSupermarketDto command, [FromServices] SupermarketSendCommands commands, CancellationToken ct) => commands.Send(cycleId, command, ct);
}
