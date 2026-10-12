using System.Net;
using System.Text;
using System.Text.Json;
using MealManager.Domain.Contracts;
using MealManager.Infrastructure.Supermarkets;
using MealManager.Tests.Integration.Configuration;
using Xunit;

namespace MealManager.Tests.Integration.Tests;

public class PicnicApiClientTests
{
    private static HttpResponseMessage Response(string body, HttpStatusCode status = HttpStatusCode.OK, string? token = null)
    {
        var response = new HttpResponseMessage(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
        if (token is not null) response.Headers.Add("x-picnic-auth", token);
        return response;
    }
    private static PicnicApiClient Client(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> handle) => new(new HttpClient(new DelegateHttpHandler(handle)));

    [Fact]
    public async Task Login_UsesFixedProtocolAndEphemeralMd5()
    {
        var client = Client(async (request, ct) =>
        {
            Assert.Equal("https://storefront-prod.de.picnicinternational.com/api/15/user/login", request.RequestUri!.AbsoluteUri);
            Assert.Equal("de", request.Headers.GetValues("Accept-Language").Single());
            Assert.False(request.Headers.Contains("x-picnic-agent"));
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            Assert.Equal(30100, body.RootElement.GetProperty("client_id").GetInt32());
            Assert.Equal("5f4dcc3b5aa765d61d8327deb882cf99", body.RootElement.GetProperty("secret").GetString());
            Assert.DoesNotContain("password", await request.Content.ReadAsStringAsync(ct));
            return Response("{\"second_factor_authentication_required\":true}", token: "pending");
        });
        var session = await client.Login("a@example.test", "password", "DE", default);
        Assert.True(session.VerificationRequired); Assert.Equal("pending", session.Token);
    }

    [Theory]
    [InlineData("NL", "nl")]
    [InlineData("DE", "de")]
    [InlineData("FR", "fr")]
    public async Task Search_UsesMarketHostLanguageHeadersAndImages(string country, string language)
    {
        var client = Client((request, _) =>
        {
            Assert.Equal($"storefront-prod.{language}.picnicinternational.com", request.RequestUri!.Host);
            Assert.Contains("search_term=milk%20%26%20bread", request.RequestUri.Query);
            Assert.Equal(language, request.Headers.GetValues("Accept-Language").Single());
            Assert.Equal(PicnicProtocol.Agent, request.Headers.GetValues("x-picnic-agent").Single());
            Assert.Equal(PicnicProtocol.DeviceId, request.Headers.GetValues("x-picnic-did").Single());
            Assert.Equal("auth", request.Headers.GetValues("x-picnic-auth").Single());
            return Task.FromResult(Response("{\"layout\":{\"sellingUnit\":{\"id\":\"s1\",\"name\":\"Milk\",\"unit_quantity\":\"1 l\",\"image_id\":\"image\"}}}"));
        });
        var product = Assert.Single(await client.Search(new("auth", country), "milk & bread", default));
        Assert.Equal(ProductAvailability.Unknown, product.Availability);
        Assert.Equal($"https://storefront-prod.{language}.picnicinternational.com/static/images/image/small.png", product.ImageUrl);
    }

    [Fact]
    public async Task Details_SparseUnitsUsePmlFields_AndIgnoreRelatedProducts()
    {
        var client = Client((request, _) =>
        {
            Assert.Contains("show_category_action=true", request.RequestUri!.Query);
            Assert.Contains("show_remove_from_purchases_page_action=true", request.RequestUri.Query);
            return Task.FromResult(Response("""
                {"layout":{"children":[
                  {"id":"product-details-page-root-main-container","children":[
                    {"textType":"HEADER1","markdown":"**Milk**"},
                    {"type":"STACK","children":[{"type":"RICH_TEXT","markdown":"1 l"}]},
                    {"price":199}]},
                  {"sellingUnit":{"id":"s1","max_count":5}},
                  {"sellingUnit":{"id":"related","image_id":"related-image"}},
                  {"id":"product-page-image-gallery-main-image-container","pml":{"component":{"children":[
                    {"type":"IMAGE","source":{"id":"milk-image"}},
                    {"type":"IMAGE","source":{"id":"second-image"}}
                  ]}}},
                  {"sellingUnit":{"id":"s1"}}
                ]}}
                """));
        });
        var product = await client.GetProduct(new("auth", "NL"), "s1", default);
        Assert.Equal("Milk", product.Name); Assert.Equal("1 l", product.Pack);
        Assert.Equal(199, product.PriceCents); Assert.Equal(5, product.MaxQuantity);
        Assert.Equal(ProductAvailability.Available, product.Availability);
        Assert.Equal("https://storefront-prod.nl.picnicinternational.com/static/images/milk-image/small.png", product.ImageUrl);
    }

    [Theory]
    [InlineData("unit-image", "unit-image")]
    [InlineData(null, null)]
    public async Task Details_WithoutGalleryUseOnlyTheRequestedProductImage(string? imageId, string? expectedImage)
    {
        var body = JsonSerializer.Serialize(new
        {
            layout = new
            {
                children = new object[] {
            new { sellingUnit = new { id = "s1", name = "Milk", unit_quantity = "1 l", max_count = 5, image_id = imageId } },
            new { type = "IMAGE", source = new { id = "unrelated-image" } },
            new { sellingUnit = new { id = "related", image_id = "related-image" } }
        }
            }
        });
        var client = Client((_, _) => Task.FromResult(Response(body)));
        var product = await client.GetProduct(new("auth", "NL"), "s1", default);
        Assert.Equal(expectedImage is null ? null : $"https://storefront-prod.nl.picnicinternational.com/static/images/{expectedImage}/small.png", product.ImageUrl);
    }

    [Theory]
    [InlineData("248 g")]
    [InlineData("1 stuk")]
    public async Task Details_OuterPmlStackDoesNotUseProductNameAsPack(string pack)
    {
        var body = JsonSerializer.Serialize(new
        {
            layout = new
            {
                children = new object[]
                {
                    new
                    {
                        id = "product-details-page-root-main-container",
                        pml = new
                        {
                            component = new
                            {
                                type = "STACK",
                                children = new object[]
                                {
                                    new { type = "RICH_TEXT", textType = "HEADER1", markdown = "**Woknoedels**" },
                                    new { type = "RICH_TEXT", markdown = "Picnic" },
                                    new { type = "STACK", children = new[] {
                                        new { type = "RICH_TEXT", markdown = pack },
                                        new { type = "RICH_TEXT", markdown = "€ 8,02/kg" }
                                    } },
                                    new { type = "PRICE", price = 199 }
                                }
                            }
                        }
                    },
                    new { sellingUnit = new { id = "s1", max_count = 5 } }
                }
            }
        });
        var client = Client((_, _) => Task.FromResult(Response(body)));
        var product = await client.GetProduct(new("auth", "NL"), "s1", default);
        Assert.Equal("Woknoedels", product.Name);
        Assert.Equal(pack, product.Pack);
        Assert.Equal(199, product.PriceCents);
        Assert.Equal(ProductAvailability.Available, product.Availability);
    }

    [Fact]
    public async Task Details_WrappedPmlHeaderResolvesNamePackAndGallery()
    {
        var client = Client((_, _) => Task.FromResult(Response("""
            {"layout":{"children":[
              {"id":"product-details-page-root-main-container","pml":{"component":{
                "type":"STACK","children":[
                  {"type":"CONTAINER","child":{"type":"RICH_TEXT","textType":"HEADER1","markdown":"#(#333333)Toiletpapier 4 laags#(#333333)"}},
                  {"type":"RICH_TEXT","markdown":"Picnic"},
                  {"type":"STACK","children":[
                    {"type":"RICH_TEXT","markdown":"#(#333333)9 rollen#(#333333)"}]},
                  {"type":"PRICE","price":199}]}}},
              {"sellingUnit":{"id":"s1"}},
              {"id":"product-page-image-gallery-main-image-container","pml":{"component":{
                "type":"IMAGE","source":{"id":"product-image"}}}},
              {"sellingUnit":{"id":"s1","max_count":99,"name":"toiletpapier 4 laags"}}
            ]}}
            """)));

        var product = await client.GetProduct(new("auth", "NL"), "s1", default);
        Assert.Equal("toiletpapier 4 laags", product.Name);
        Assert.Equal("9 rollen", product.Pack);
        Assert.Equal(199, product.PriceCents);
        Assert.Equal(ProductAvailability.Available, product.Availability);
        Assert.Equal(99, product.MaxQuantity);
        Assert.Equal("https://storefront-prod.nl.picnicinternational.com/static/images/product-image/small.png", product.ImageUrl);
    }

    [Fact]
    public async Task Verification_RequiresHeaderOnEmpty204_AndUpdatesToken()
    {
        var access = new PicnicAccess("pending", "NL");
        await Client((_, _) => Task.FromResult(Response("", HttpStatusCode.NoContent, "verified"))).VerifyCode(access, "123456", default);
        Assert.Equal("verified", access.Token);
        var error = await Assert.ThrowsAsync<SupermarketException>(() => Client((_, _) => Task.FromResult(Response("", HttpStatusCode.NoContent))).VerifyCode(access, "123456", default));
        Assert.Equal(SupermarketFailure.Protocol, error.Failure);
    }

    [Theory]
    [InlineData("not json")]
    [InlineData("[]")]
    [InlineData("")]
    public async Task NonJsonOrNonObject401_IsAnExpiredSession(string body)
    {
        var client = Client((_, _) => Task.FromResult(Response(body, HttpStatusCode.Unauthorized)));
        Assert.Equal(SupermarketFailure.SessionExpired, (await Assert.ThrowsAsync<SupermarketException>(() => client.Search(new("auth", "NL"), "milk", default))).Failure);
        Assert.Equal(SupermarketFailure.SessionExpired, (await Assert.ThrowsAsync<SupermarketException>(() => client.AddProduct(new("auth", "NL"), "s1", 1, default))).Failure);
    }

    [Theory]
    [InlineData("{\"items\":[]}")]
    [InlineData("{\"type\":\"ORDER\",\"items\":[]}")]
    [InlineData("{\"type\":\"ORDER\",\"items\":[{\"items\":[{\"type\":\"ORDER_ARTICLE\",\"id\":\"other\"}]}]}")]
    [InlineData("garbage")]
    public async Task UnestablishedCartAcknowledgement_IsUnknown_AndNotRetried(string body)
    {
        var calls = 0;
        var client = Client((_, _) => { calls++; return Task.FromResult(Response(body)); });
        Assert.Equal(SupermarketFailure.Uncertain, (await Assert.ThrowsAsync<SupermarketException>(() => client.AddProduct(new("auth", "NL"), "s1", 2, default))).Failure);
        Assert.Equal(1, calls);
    }

    [Theory]
    [InlineData(HttpStatusCode.InternalServerError, SupermarketFailure.Uncertain)]
    [InlineData(HttpStatusCode.BadRequest, SupermarketFailure.Rejected)]
    public async Task MalformedMutationError_RetainsStatusClassification(HttpStatusCode status, SupermarketFailure expected)
    {
        var client = Client((_, _) => Task.FromResult(Response("<html>error</html>", status)));
        Assert.Equal(expected, (await Assert.ThrowsAsync<SupermarketException>(() => client.AddProduct(new("auth", "NL"), "s1", 2, default))).Failure);
    }

    [Fact]
    public async Task Cancellation_BeforeDispatchIsSafe_AfterDispatchIsUnknown()
    {
        var calls = 0;
        var client = Client((_, ct) => { calls++; throw new OperationCanceledException(ct); });
        using var cancelled = new CancellationTokenSource(); cancelled.Cancel();
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => client.AddProduct(new("auth", "NL"), "s1", 1, cancelled.Token));
        Assert.Equal(0, calls);
        Assert.Equal(SupermarketFailure.Uncertain, (await Assert.ThrowsAsync<SupermarketException>(() => client.AddProduct(new("auth", "NL"), "s1", 1, default))).Failure);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task AccountIdentity_CanBeNumeric_AndRscFailsSafely()
    {
        var account = await Client((_, _) => Task.FromResult(Response("{\"user_id\":12345,\"contact_email\":\"a@example.test\"}"))).GetAccount(new("auth", "NL"), default);
        Assert.Equal("12345", account.Id);
        var client = Client((_, _) =>
        {
            var response = Response("0:[\"$\",\"div\",null,{}]");
            response.Content.Headers.ContentType = new("text/x-component");
            return Task.FromResult(response);
        });
        Assert.Equal(SupermarketFailure.Protocol, (await Assert.ThrowsAsync<SupermarketException>(() => client.Search(new("auth", "NL"), "milk", default))).Failure);
    }

}
