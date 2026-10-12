using System.Text.Json;
using System.Text.Json.Serialization;
namespace MealManager.Common.Enums;

public sealed class SupermarketProviderJsonConverter : JsonConverter<SupermarketProvider>
{
    public override SupermarketProvider Read(ref Utf8JsonReader reader, Type type, JsonSerializerOptions options) =>
        reader.TokenType == JsonTokenType.String && Enum.TryParse<SupermarketProvider>(reader.GetString(), true, out var provider) && Enum.IsDefined(provider)
            ? provider : throw new JsonException("Unknown supermarket provider.");
    public override void Write(Utf8JsonWriter writer, SupermarketProvider value, JsonSerializerOptions options) => writer.WriteStringValue(value.ToString().ToLowerInvariant());
}
