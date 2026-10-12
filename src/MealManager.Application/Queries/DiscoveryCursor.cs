using System.Security.Cryptography;
using System.Text.Json;

namespace MealManager.Application.Queries;

internal static class DiscoveryCursor
{
    public static string Scope(object filters) =>
        Convert.ToHexString(SHA256.HashData(JsonSerializer.SerializeToUtf8Bytes(filters)));

    public static string Encode(string key, string scope) =>
        Convert.ToBase64String(JsonSerializer.SerializeToUtf8Bytes(new DiscoveryCursorValue(1, key, scope)));

    public static string? Decode(string? value, string scope)
    {
        if (value is null) return null;
        try
        {
            if (value.Length > 2048) throw new FormatException();
            var cursor = JsonSerializer.Deserialize<DiscoveryCursorValue>(Convert.FromBase64String(value));
            if (cursor is null || cursor.Version != 1 || cursor.Scope != scope || cursor.Key is null)
                throw new FormatException();
            return cursor.Key;
        }
        catch (Exception exception) when (exception is FormatException or JsonException)
        {
            throw new ValidationException("Cursor is invalid or belongs to different filters.");
        }
    }

    public static void ValidatePageSize(int pageSize)
    {
        if (pageSize is < 1 or > 50)
            throw new ValidationException("Page size must be between 1 and 50.");
    }
}
