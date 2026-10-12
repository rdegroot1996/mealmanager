using System.Text.Json;
using System.Text.Json.Serialization;

namespace MealManager.Common;

public class JsonSerializer
{
    public static JsonSerializerOptions Options { get; } = new()
    {
        Converters =
        {
            new JsonStringEnumConverter(JsonNamingPolicy.CamelCase),
        },
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DictionaryKeyPolicy = JsonNamingPolicy.CamelCase,
    };

    public static T Deserialize<T>(string json) =>
        System.Text.Json.JsonSerializer.Deserialize<T>(json, Options) ?? throw new JsonException();

    public static string Serialize<T>(T obj) => System.Text.Json.JsonSerializer.Serialize(obj, Options);
}
