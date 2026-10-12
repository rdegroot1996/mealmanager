using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace MealManager.Infrastructure.Supermarkets;

// Explicit opt-in HTTP fixture. The production adapter still constructs and parses every request.
public sealed class PicnicMockHandler : HttpMessageHandler
{
    public const string Email = "picnic@example.test";
    public const string Password = "Picnic123!";
    public const string Code = "123456";
    private readonly Dictionary<string, string> sessions = [];
    private readonly Dictionary<string, int> cart = [];
    private bool lostResponse;
    public int AdditionCount { get; private set; }
    public bool RotateTokens { get; set; }
    public Func<Task>? AfterAddition { get; set; }
    public List<string> Requests { get; } = [];
    public void Reset() { sessions.Clear(); cart.Clear(); Requests.Clear(); lostResponse = false; AdditionCount = 0; RotateTokens = false; AfterAddition = null; }

    private static readonly (string Id, string Name, string Pack, int Price, int Max)[] Products =
    [
        ("s1001", "Picnic Woknoedels", "250 g", 199, 20),
        ("s1002", "Conimex Woknoedels", "248 g", 259, 20),
        ("s1003", "Picnic Melk", "1 l", 119, 20),
        ("s1004", "Picnic Zout", "500 g", 89, 0),
        ("s-rejected", "Test geweigerd", "1 stuk", 100, 20),
        ("s-rejected-two", "Test geweigerd tweede", "1 stuk", 100, 20),
        ("s-uncertain", "Test onzeker", "1 stuk", 100, 20),
    ];

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var response = await Handle(request, ct);
        var token = request.Headers.TryGetValues("x-picnic-auth", out var auth) ? auth.First() : "";
        if (RotateTokens && response.IsSuccessStatusCode && token.StartsWith("verified-", StringComparison.Ordinal) && sessions.TryGetValue(token, out var email))
        {
            var rotated = "verified-" + Convert.ToBase64String(Encoding.UTF8.GetBytes(email)) + "." + Guid.NewGuid();
            sessions.Remove(token);
            sessions[rotated] = email;
            response.Headers.Remove("x-picnic-auth");
            response.Headers.Add("x-picnic-auth", rotated);
        }
        return response;
    }

    private async Task<HttpResponseMessage> Handle(HttpRequestMessage request, CancellationToken ct)
    {
        var path = request.RequestUri!.AbsolutePath.Split("/api/15/").Last();
        Requests.Add(path);
        using var body = JsonDocument.Parse(request.Content is null ? "{}" : await request.Content.ReadAsStringAsync(ct));
        if (path != "user/login" && (!request.Headers.Contains("x-picnic-agent") || !request.Headers.Contains("x-picnic-did"))) return Error("INVALID_CLIENT");
        if (path == "user/login")
        {
            var key = body.RootElement.GetProperty("key").GetString();
            var secret = body.RootElement.GetProperty("secret").GetString();
            if (key is not (Email or "other@example.test") || secret != Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(Password))).ToLowerInvariant() || body.RootElement.GetProperty("client_id").GetInt32() != 30100)
                return Error("AUTH_INVALID_CRED", HttpStatusCode.Unauthorized);
            var token = "pending-" + Guid.NewGuid();
            sessions[token] = key!;
            return Json(new { user_id = key, second_factor_authentication_required = true, show_second_factor_authentication_intro = true }, token);
        }
        var auth = request.Headers.TryGetValues("x-picnic-auth", out var values) ? values.First() : "";
        if (!sessions.TryGetValue(auth, out var email))
        {
            // Mock verified tokens are self-contained so protected application sessions
            // can be exercised across a production-container restart.
            if (!auth.StartsWith("verified-", StringComparison.Ordinal)) return Error("AUTH_ERROR", HttpStatusCode.Unauthorized);
            try { email = Encoding.UTF8.GetString(Convert.FromBase64String(auth[9..].Split('.')[0])); }
            catch (FormatException) { return Error("AUTH_ERROR", HttpStatusCode.Unauthorized); }
            if (email is not (Email or "other@example.test")) return Error("AUTH_ERROR", HttpStatusCode.Unauthorized);
            sessions[auth] = email;
        }
        if (path == "user/2fa/generate")
            return body.RootElement.GetProperty("channel").GetString() == "SMS" ? Empty() : Error("INVALID_CHANNEL");
        if (path == "user/2fa/verify")
        {
            if (body.RootElement.GetProperty("otp").GetString() != Code) return Error("INVALID_OTP");
            var token = "verified-" + Convert.ToBase64String(Encoding.UTF8.GetBytes(email)) + "." + Guid.NewGuid();
            sessions.Remove(auth);
            sessions[token] = email;
            return Empty(token);
        }
        if (!auth.StartsWith("verified-", StringComparison.Ordinal)) return Error("AUTH_ERROR", HttpStatusCode.Unauthorized);
        if (path == "user") return Json(new { user_id = email, contact_email = email });
        var query = Microsoft.AspNetCore.WebUtilities.QueryHelpers.ParseQuery(request.RequestUri.Query);
        if (path.StartsWith("pages/", StringComparison.Ordinal))
        {
            if (path.Contains("product-details", StringComparison.Ordinal))
            {
                var product = Products.FirstOrDefault(x => x.Id == query["id"].ToString());
                if (product.Id is null) return Error("NOT_FOUND", HttpStatusCode.NotFound);
                return Json(new
                {
                    id = "fixture-detail-page",
                    layout = new
                    {
                        body = new
                        {
                            type = "STACK",
                            children = new object[] {
                    new { id = "product-details-page-root-main-container", pml = new { component = new { type = "STACK", children = new object[] {
                        new { type = "RICH_TEXT", textType = "HEADER1", markdown = product.Name },
                        new { type = "STACK", children = new[] { new { type = "RICH_TEXT", markdown = product.Pack } } },
                        new { type = "PRICE", price = product.Price }
                    } } } },
                    new { type = "SELLING_UNIT", sellingUnit = new { id = product.Id, max_count = product.Max } }
                }
                        }
                    }
                });
            }
            var selected = path.Contains("search-page", StringComparison.Ordinal)
                ? Products.Where(x => x.Name.Contains(query["search_term"].ToString(), StringComparison.OrdinalIgnoreCase))
                : Products.Where(x => x.Id == query["id"].ToString());
            return Json(new { id = "fixture-page", layout = new { body = new { type = "STACK", children = selected.Select(x => new { type = "SELLING_UNIT_TILE", sellingUnit = new { id = x.Id, name = x.Name, unit_quantity = x.Pack, display_price = x.Price, max_count = x.Max, image_id = (string?)null, decorators = Array.Empty<object>(), price_ranges = (object?)null } }).ToArray() } } });
        }
        if (path == "cart/add_product")
        {
            var id = body.RootElement.GetProperty("product_id").GetString()!;
            var count = body.RootElement.GetProperty("count").GetInt32();
            var product = Products.FirstOrDefault(x => x.Id == id);
            if (product.Id is null || product.Max == 0) return Error("PRODUCT_UNAVAILABLE");
            if (count < 1 || count > product.Max) return Error("MAX_COUNT_EXCEEDED");
            if (id is "s-rejected" or "s-rejected-two") return Error("CART_REJECTED");
            cart[id] = cart.GetValueOrDefault(id) + count;
            AdditionCount++;
            if (AfterAddition is not null) await AfterAddition();
            if (id == "s-uncertain" && !lostResponse)
            {
                lostResponse = true;
                throw new HttpRequestException("Simulated response loss after Picnic accepted the addition.");
            }
            return Json(new { type = "ORDER", id = "fixture-cart", items = cart.Select(x => new { type = "ORDER_LINE", id = x.Key, display_price = 100, items = new[] { new { id = x.Key, name = x.Key, price = 100, type = "ORDER_ARTICLE" } } }).ToArray(), analytics_context_data = new { items_list = cart.Select(x => new { product_id = x.Key, quantity = x.Value, is_available = true }).ToArray() }, total_count = cart.Values.Sum(), total_price = 100, mts = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds() });
        }
        return Error("NOT_FOUND", HttpStatusCode.NotFound);
    }

    private static HttpResponseMessage Error(string code, HttpStatusCode status = HttpStatusCode.BadRequest) => new(status) { Content = new StringContent(JsonSerializer.Serialize(new { error = new { code, message = code } }), Encoding.UTF8, "application/json") };
    private static HttpResponseMessage Json(object data, string? token = null)
    {
        var response = new HttpResponseMessage(HttpStatusCode.OK) { Content = new StringContent(JsonSerializer.Serialize(data), Encoding.UTF8, "application/json") };
        if (token is not null) response.Headers.Add("x-picnic-auth", token);
        return response;
    }
    private static HttpResponseMessage Empty(string? token = null)
    {
        var response = new HttpResponseMessage(HttpStatusCode.NoContent);
        if (token is not null) response.Headers.Add("x-picnic-auth", token);
        return response;
    }
}
