namespace MealManager.Infrastructure.Supermarkets;

// Serialize only Picnic HTTP/session replacement: rotating tokens can invalidate older tokens.
public sealed class PicnicGate
{
    public SemaphoreSlim Mutex { get; } = new(1, 1);
}
