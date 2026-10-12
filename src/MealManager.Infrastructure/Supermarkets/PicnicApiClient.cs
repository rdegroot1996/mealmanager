using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using MealManager.Domain.Contracts;

namespace MealManager.Infrastructure.Supermarkets;

public sealed class PicnicApiClient(HttpClient http) : IPicnicApiClient
{
    public async Task<PicnicSession> Login(string email, string password, string countryCode, CancellationToken ct)
    {
        // Picnic's mobile protocol requires MD5; the digest is a credential, never stored.
        var secret = Convert.ToHexString(MD5.HashData(Encoding.UTF8.GetBytes(password))).ToLowerInvariant();
        var access = new PicnicAccess("", countryCode);
        using var data = await Request(HttpMethod.Post, "user/login", access, new { key = email, secret, client_id = PicnicProtocol.ClientId }, false, ct);
        if (string.IsNullOrEmpty(access.Token)) throw new SupermarketException(SupermarketFailure.Protocol);
        return new(access.Token, data.RootElement.TryGetProperty("second_factor_authentication_required", out var required) && required.ValueKind == JsonValueKind.True);
    }

    public async Task RequestCode(PicnicAccess access, CancellationToken ct)
    {
        using var _ = await Request(HttpMethod.Post, "user/2fa/generate", access, new { channel = "SMS" }, false, ct);
    }

    public async Task VerifyCode(PicnicAccess access, string code, CancellationToken ct)
    {
        using var _ = await Request(HttpMethod.Post, "user/2fa/verify", access, new { otp = code }, false, ct, requireToken: true);
    }

    public async Task<SupermarketAccount> GetAccount(PicnicAccess access, CancellationToken ct)
    {
        using var data = await Request(HttpMethod.Get, "user", access, null, false, ct);
        var id = Identity(data.RootElement, "user_id") ?? Identity(data.RootElement, "id");
        var label = Text(data.RootElement, "contact_email") ?? Text(data.RootElement, "email");
        if (id is null || label is null) throw new SupermarketException(SupermarketFailure.Protocol);
        return new(id, label);
    }

    public async Task<IReadOnlyList<SupermarketProduct>> Search(PicnicAccess access, string query, CancellationToken ct)
    {
        using var data = await Request(HttpMethod.Get, $"pages/search-page-results?search_term={Uri.EscapeDataString(query)}", access, null, false, ct);
        return ParseProducts(data.RootElement, access.CountryCode);
    }

    public async Task<SupermarketProduct> GetProduct(PicnicAccess access, string id, CancellationToken ct)
    {
        try
        {
            using var data = await Request(HttpMethod.Get, $"pages/product-details-page-root?id={Uri.EscapeDataString(id)}&show_category_action=true&show_remove_from_purchases_page_action=true", access, null, false, ct);
            return ParseProducts(data.RootElement, access.CountryCode, id).FirstOrDefault(x => x.Id == id)
                ?? new(id, id, "", null, "EUR", null, ProductAvailability.Missing, null);
        }
        catch (SupermarketException ex) when (ex.Failure == SupermarketFailure.Unavailable)
        {
            return new(id, id, "", null, "EUR", null, ProductAvailability.Missing, null);
        }
    }

    public async Task AddProduct(PicnicAccess access, string id, int quantity, CancellationToken ct)
    {
        using var data = await Request(HttpMethod.Post, "cart/add_product", access, new { product_id = id, count = quantity }, true, ct);
        // A successful POST with a valid cart containing the requested available product is
        // our acceptance acknowledgement. It does not prove an exact before/after quantity delta.
        var root = data.RootElement;
        var acknowledged = Text(root, "type") == "ORDER" && root.TryGetProperty("items", out var items) && items.ValueKind == JsonValueKind.Array &&
            Nodes(items).Any(x => Text(x, "type") == "ORDER_ARTICLE" && Text(x, "id") == id);
        if (!acknowledged)
            throw new SupermarketException(SupermarketFailure.Uncertain);
    }

    private async Task<JsonDocument> Request(HttpMethod method, string path, PicnicAccess access, object? body, bool mutation, CancellationToken ct, bool requireToken = false)
    {
        ct.ThrowIfCancellationRequested();
        using var request = new HttpRequestMessage(method, $"{PicnicProtocol.Origin(access.CountryCode)}/api/{PicnicProtocol.ApiVersion}/{path}");
        request.Headers.TryAddWithoutValidation("User-Agent", "okhttp/4.9.0");
        request.Headers.TryAddWithoutValidation("Accept-Language", PicnicProtocol.Language(access.CountryCode));
        if (path != "user/login")
        {
            request.Headers.TryAddWithoutValidation("x-picnic-agent", PicnicProtocol.Agent);
            request.Headers.TryAddWithoutValidation("x-picnic-did", PicnicProtocol.DeviceId);
        }
        if (access.Token.Length > 0) request.Headers.TryAddWithoutValidation("x-picnic-auth", access.Token);
        if (body is not null) request.Content = JsonContent.Create(body);
        try
        {
            using var response = await http.SendAsync(request, ct);
            var hasToken = response.Headers.TryGetValues("x-picnic-auth", out var tokens) && !string.IsNullOrWhiteSpace(tokens.FirstOrDefault());
            if (hasToken) access.Token = tokens!.First();
            var content = await response.Content.ReadAsStringAsync(ct);
            JsonDocument data;
            try { data = JsonDocument.Parse(string.IsNullOrWhiteSpace(content) ? "{}" : content); }
            catch (JsonException) when (!response.IsSuccessStatusCode) { data = JsonDocument.Parse("{}"); }
            if (data.RootElement.ValueKind != JsonValueKind.Object)
            {
                data.Dispose();
                if (response.IsSuccessStatusCode) throw new SupermarketException(mutation ? SupermarketFailure.Uncertain : SupermarketFailure.Protocol);
                data = JsonDocument.Parse("{}");
            }
            if (!response.IsSuccessStatusCode || data.RootElement.TryGetProperty("error", out _))
            {
                var code = data.RootElement.TryGetProperty("error", out var error) ? Text(error, "code") : null;
                data.Dispose();
                if (code == "AUTH_INVALID_CRED") throw new PicnicAuthenticationException(PicnicAuthenticationFailure.Credentials);
                if (code == "INVALID_OTP") throw new PicnicAuthenticationException(PicnicAuthenticationFailure.Verification);
                var failure = code switch
                {
                    "AUTH_ERROR" => SupermarketFailure.SessionExpired,
                    "PRODUCT_UNAVAILABLE" or "NOT_FOUND" => SupermarketFailure.Unavailable,
                    "MAX_COUNT_EXCEEDED" => SupermarketFailure.Quantity,
                    _ when response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => SupermarketFailure.SessionExpired,
                    _ when response.StatusCode == HttpStatusCode.NotFound => SupermarketFailure.Unavailable,
                    _ when mutation && (int)response.StatusCode >= 500 => SupermarketFailure.Uncertain,
                    _ => mutation ? SupermarketFailure.Rejected : SupermarketFailure.Protocol,
                };
                throw new SupermarketException(failure);
            }
            if (requireToken && !hasToken) { data.Dispose(); throw new SupermarketException(SupermarketFailure.Protocol); }
            return data;
        }
        catch (Exception ex) when (ex is HttpRequestException or OperationCanceledException or JsonException)
        {
            throw new SupermarketException(mutation ? SupermarketFailure.Uncertain : SupermarketFailure.Protocol);
        }
    }

    private IReadOnlyList<SupermarketProduct> ParseProducts(JsonElement root, string countryCode, string? detailsId = null)
    {
        if (!root.TryGetProperty("layout", out _)) throw new SupermarketException(SupermarketFailure.Protocol);
        var products = new Dictionary<string, SupermarketProduct>();
        // Detail pages render names/packs in PML; their sellingUnit can contain only
        // the ID and purchase limit. Search tiles normally contain all fields.
        var nodes = Nodes(root).ToArray();
        var container = nodes.FirstOrDefault(x => Text(x, "id") == "product-details-page-root-main-container");
        var component = container;
        if (container.ValueKind == JsonValueKind.Object && container.TryGetProperty("pml", out var pml) &&
            pml.ValueKind == JsonValueKind.Object && pml.TryGetProperty("component", out var pmlComponent))
            component = pmlComponent;
        // Picnic wraps the header in a CONTAINER.child; the pack row is a direct child.
        var detailName = Markdown(Nodes(component).FirstOrDefault(x => Text(x, "textType") == "HEADER1"));
        var stack = Children(component).FirstOrDefault(x => Text(x, "type") == "STACK");
        var detailPack = Markdown(Children(stack).FirstOrDefault(x => Text(x, "type") == "RICH_TEXT"));
        int? detailPrice = Nodes(component).Select(x => Number(x, "price")).FirstOrDefault(x => x.HasValue);
        var gallery = nodes.FirstOrDefault(x => Text(x, "id") == "product-page-image-gallery-main-image-container");
        var detailImage = Nodes(gallery)
            .Where(x => x.TryGetProperty("source", out _))
            .Select(x => Text(x.GetProperty("source"), "id"))
            .FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
        Walk(root);
        return products.Values.ToArray();

        void Walk(JsonElement node)
        {
            if (node.ValueKind == JsonValueKind.Object)
            {
                if (node.TryGetProperty("sellingUnit", out var unit))
                {
                    if (unit.ValueKind != JsonValueKind.Object) throw new SupermarketException(SupermarketFailure.Protocol);
                    var id = Text(unit, "id");
                    if (detailsId is not null && id != detailsId) return;
                    var name = Text(unit, "name") ?? (id == detailsId ? detailName : null);
                    var pack = Text(unit, "unit_quantity") ?? (id == detailsId ? detailPack : null);
                    if (id is null || name is null || pack is null) throw new SupermarketException(SupermarketFailure.Protocol);
                    int? max = Number(unit, "max_count");
                    int? price = Number(unit, "display_price") ?? (id == detailsId ? detailPrice : null);
                    var image = Text(unit, "image_id") ?? (id == detailsId ? detailImage : null);
                    if (products.TryGetValue(id, out var previous) && max is null && previous.MaxQuantity.HasValue) return;
                    products[id] = new(id, name, pack, price, "EUR", image is null ? null : $"{PicnicProtocol.Origin(countryCode)}/static/images/{Uri.EscapeDataString(image)}/small.png",
                        max is null ? ProductAvailability.Unknown : max > 0 ? ProductAvailability.Available : ProductAvailability.Unavailable, max);
                }
                foreach (var property in node.EnumerateObject()) Walk(property.Value);
            }
            else if (node.ValueKind == JsonValueKind.Array) foreach (var child in node.EnumerateArray()) Walk(child);
        }
    }

    private static IEnumerable<JsonElement> Children(JsonElement node) =>
        node.ValueKind == JsonValueKind.Object && node.TryGetProperty("children", out var children) && children.ValueKind == JsonValueKind.Array
            ? children.EnumerateArray()
            : [];

    private static IEnumerable<JsonElement> Nodes(JsonElement node)
    {
        if (node.ValueKind == JsonValueKind.Object)
        {
            yield return node;
            foreach (var property in node.EnumerateObject()) foreach (var child in Nodes(property.Value)) yield return child;
        }
        else if (node.ValueKind == JsonValueKind.Array) foreach (var value in node.EnumerateArray()) foreach (var child in Nodes(value)) yield return child;
    }
    private static int? Number(JsonElement node, string key) => node.ValueKind == JsonValueKind.Object && node.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number && value.TryGetInt32(out var number) ? number : null;
    private static string? Markdown(JsonElement node) => Text(node, "markdown") is { } text ? Regex.Replace(text, @"#\([A-Za-z0-9#_]+\)", "").Replace("**", "").Replace("__", "").Trim() : null;

    private static string? Text(JsonElement node, string key) => node.ValueKind == JsonValueKind.Object && node.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.String ? value.GetString() : null;
    private static string? Identity(JsonElement node, string key) => Text(node, key) ?? (node.TryGetProperty(key, out var value) && value.ValueKind == JsonValueKind.Number ? value.GetRawText() : null);
}
