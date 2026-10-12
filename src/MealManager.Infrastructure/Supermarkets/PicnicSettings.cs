namespace MealManager.Infrastructure.Supermarkets;

// Runtime connection state only; operational limits and protocol values belong in code.
public sealed record PicnicSettings
{
    public int SchemaVersion { get; init; } = 1;
    public Guid ConnectionGeneration { get; init; } = Guid.NewGuid();
    public string CountryCode { get; init; } = "NL";
    public string Status { get; init; } = "Disconnected";
    public string? ProtectedToken { get; init; }
    public string? AccountId { get; init; }
    public string? AccountLabel { get; init; }
    public Guid? VerificationUserId { get; init; }
    public DateTime? VerificationExpiresAt { get; init; }
    public DateTime? CodeRequestedAt { get; init; }
}
