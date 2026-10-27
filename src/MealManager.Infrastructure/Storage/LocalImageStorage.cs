using ImageMagick;
using MealManager.Common.Errors;
using MealManager.Domain.Contracts;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.FileProviders;

namespace MealManager.Infrastructure.Storage;

public class LocalImageStorage : IImageStorage, IDisposable
{
    private const uint MaximumImageWidth = 1600;
    private const uint MaximumImageHeight = 1200;
    private const long MaximumPixelCount = 40_000_000;

    private readonly string _rootPath;
    private readonly PhysicalFileProvider _fileProvider;

    public LocalImageStorage(IConfiguration configuration)
    {
        _rootPath = Path.GetFullPath(
            Path.Combine(
                configuration["Storage:DataRoot"] ?? Path.Combine(AppContext.BaseDirectory, "data"),
                "recipe-images"));
        Directory.CreateDirectory(_rootPath);
        _fileProvider = new PhysicalFileProvider(_rootPath);
    }

    public async Task<StoredImage> StoreImage(Stream source, CancellationToken cancellationToken = default)
    {
        if (!source.CanRead)
        {
            throw new InvalidOperationError(message: "Upload a non-empty image smaller than 10 MB.");
        }

        var upload = await ReadUpload(source, cancellationToken);

        try
        {
            var relativePath = $"{Guid.CreateVersion7():N}.jpg";
            var physicalPath = Path.Combine(_rootPath, relativePath);

            await StoreAsJpeg(upload, physicalPath, cancellationToken);

            return new StoredImage(relativePath, "image/jpeg");
        }
        catch (MagickException)
        {
            throw new InvalidOperationError(
                message:
                "We couldn't read this image. Choose a JPEG, PNG, WebP, GIF, HEIC, or HEIF image, or export it as JPEG.");
        }
    }

    private static async Task<byte[]> ReadUpload(Stream source, CancellationToken cancellationToken)
    {
        await using var upload = new MemoryStream();
        var buffer = new byte[81920];
        int bytesRead;

        while ((bytesRead = await source.ReadAsync(buffer, cancellationToken)) > 0)
        {
            if (upload.Length + bytesRead > IImageStorage.MaximumUploadBytes)
            {
                throw new InvalidOperationError(message: "Upload a non-empty image smaller than 10 MB.");
            }

            await upload.WriteAsync(buffer.AsMemory(0, bytesRead), cancellationToken);
        }

        if (upload.Length == 0)
        {
            throw new InvalidOperationError(message: "Upload a non-empty image smaller than 10 MB.");
        }

        return upload.ToArray();
    }

    private static async Task StoreAsJpeg(
        byte[] upload,
        string physicalPath,
        CancellationToken cancellationToken)
    {
        var imageInfo = new MagickImageInfo(upload);
        ValidatePixelCount(imageInfo.Width, imageInfo.Height);
        if (imageInfo.Format is not (MagickFormat.Jpeg or MagickFormat.Png or MagickFormat.WebP or MagickFormat.Gif or MagickFormat.Heic))
        {
            throw new InvalidOperationError(message: "We couldn't read this image. Choose a JPEG, PNG, WebP, GIF, HEIC, or HEIF image, or export it as JPEG.");
        }

        using var image = new MagickImage(upload);
        image.AutoOrient();
        image.Resize(new MagickGeometry(MaximumImageWidth, MaximumImageHeight)
        {
            Greater = true,
        });
        if (image.HasAlpha)
        {
            image.BackgroundColor = MagickColors.White;
            image.Alpha(AlphaAction.Remove);
        }

        image.Strip();
        image.Quality = 85;

        await using var destination = File.Create(physicalPath);
        await image.WriteAsync(destination, MagickFormat.Jpeg, cancellationToken);
    }

    private static void ValidatePixelCount(long width, long height)
    {
        if (width == 0 || height == 0 || width * height > MaximumPixelCount)
        {
            throw new InvalidOperationError(message: "Upload an image with no more than 40 megapixels.");
        }
    }

    public Task<Stream?> OpenRead(string relativePath, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var file = _fileProvider.GetFileInfo(ValidateRelativePath(relativePath));
        return Task.FromResult(file.Exists ? file.CreateReadStream() : null);
    }

    public Task DeleteImage(string relativePath, CancellationToken cancellationToken = default)
    {
        cancellationToken.ThrowIfCancellationRequested();
        var file = _fileProvider.GetFileInfo(ValidateRelativePath(relativePath));
        if (file.Exists && file.PhysicalPath is not null)
        {
            File.Delete(file.PhysicalPath);
        }

        return Task.CompletedTask;
    }

    public void Dispose() => _fileProvider.Dispose();

    private static string ValidateRelativePath(string relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath) ||
            Path.IsPathRooted(relativePath) ||
            relativePath.Contains('/') ||
            relativePath.Contains('\\'))
        {
            throw new InvalidOperationException("The image path is invalid.");
        }

        return relativePath;
    }
}
