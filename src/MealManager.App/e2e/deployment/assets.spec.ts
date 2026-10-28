import { expect, test } from '../test';

test('serve install metadata and icons from the production image', async ({ request }) => {
  const html = await request.get('/');
  expect(html.ok()).toBe(true);
  const document = await html.text();
  expect(document).toContain('rel="manifest"');
  expect(document).toContain('icons/apple-touch-icon.png');
  const response = await request.get('/manifest.webmanifest');
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.display).toBe('standalone');
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: '192x192', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'any' }),
      expect.objectContaining({ sizes: '512x512', purpose: 'maskable' }),
    ]),
  );
  for (const path of [
    ...manifest.icons.map((icon: { src: string }) => icon.src),
    '/icons/apple-touch-icon.png',
  ]) {
    const icon = await request.get(path);
    expect(icon.ok(), path).toBe(true);
    expect(icon.headers()['content-type']).toContain('image/png');
  }
});
