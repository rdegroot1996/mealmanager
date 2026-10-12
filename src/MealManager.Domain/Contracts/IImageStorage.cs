namespace MealManager.Domain.Contracts;

public interface IImageStorage
{
    const long MaximumUploadBytes = 10 * 1024 * 1024;

    Task<StoredImage> StoreImage(Stream source, CancellationToken cancellationToken = default);

    Task<Stream?> OpenRead(string relativePath, CancellationToken cancellationToken = default);

    Task DeleteImage(string relativePath, CancellationToken cancellationToken = default);
}
