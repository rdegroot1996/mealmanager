import { mockImageUploadError } from './image-upload';

describe('mock image upload boundary', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  it('rejects empty and oversized files before creating placeholder images', () => {
    expect(mockImageUploadError(0, png)).toContain('non-empty');
    expect(mockImageUploadError(10 * 1024 * 1024 + 1, png)).toContain('10 MB');
    expect(mockImageUploadError(10 * 1024 * 1024, png)).toBeNull();
  });

  it('rejects text and SVG regardless of a claimed image MIME type', () => {
    for (const content of ['not an image', '<svg xmlns="http://www.w3.org/2000/svg">']) {
      expect(mockImageUploadError(content.length, new TextEncoder().encode(content))).toContain(
        "We couldn't read this image.",
      );
    }
  });

  it('allows the supported signature families without simulating image conversion', () => {
    for (const header of [
      png,
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0]),
      new TextEncoder().encode('GIF87a'),
      new TextEncoder().encode('GIF89a'),
      new TextEncoder().encode('RIFFxxxxWEBP'),
      new TextEncoder().encode('xxxxftypheic'),
      new TextEncoder().encode('xxxxftypmif1'),
    ]) {
      expect(mockImageUploadError(100, header)).toBeNull();
    }
    expect(mockImageUploadError(100, new TextEncoder().encode('xxxxftypavif'))).not.toBeNull();
  });
});
