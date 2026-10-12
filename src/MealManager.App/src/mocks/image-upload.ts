// Match the upload boundary's basic rejection states without pretending to decode images.
// The mock still returns a placeholder; actual decoding/conversion belongs to production E2E.
export function mockImageUploadError(size: number, header: Uint8Array): string | null {
  if (size === 0 || size > 10 * 1024 * 1024) {
    return 'Upload a non-empty image smaller than 10 MB.';
  }
  const startsWith = (bytes: number[]) => bytes.every((value, index) => header[index] === value);
  const text = (start: number, end: number) => String.fromCharCode(...header.slice(start, end));
  const supported =
    startsWith([0xff, 0xd8, 0xff]) ||
    startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) ||
    ['GIF87a', 'GIF89a'].includes(text(0, 6)) ||
    (text(0, 4) === 'RIFF' && text(8, 12) === 'WEBP') ||
    (text(4, 8) === 'ftyp' &&
      ['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1'].includes(text(8, 12)));
  return supported
    ? null
    : "We couldn't read this image. Choose a JPEG, PNG, WebP, GIF, HEIC, or HEIF image, or export it as JPEG.";
}
