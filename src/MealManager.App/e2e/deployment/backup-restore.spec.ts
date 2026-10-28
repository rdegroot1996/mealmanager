import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { promisify } from 'node:util';
import { expect, test } from '../test';

const execute = promisify(execFile);
const compose = [
  'compose',
  '--project-name',
  'mealmanager-e2e',
  '--file',
  resolve(process.cwd(), '../../tests/e2e/docker-compose.yml'),
];
const volume = 'mealmanager-e2e_mealmanager-data';
const image = 'mealmanager-e2e-mealmanager';
const docker = (...args: string[]) => execute('docker', args, { timeout: 60_000 });

test('a stopped complete-data backup restores recipes, photos, accounts, and session keys', async ({
  page,
}, testInfo) => {
  const session = await (await page.request.get('/api/authentication/session')).json();
  const headers = { 'X-XSRF-TOKEN': session.antiforgeryToken };
  const created = await page.request.post('/api/recipes', {
    headers,
    data: {
      name: 'Restored recipe',
      category: 'Meals',
      baseServings: 2,
      tags: [],
      ingredients: [],
      steps: [],
    },
  });
  expect(created.ok()).toBe(true);
  const recipe = await created.json();
  const upload = await page.request.post(`/api/recipes/${recipe.id}/images`, {
    headers,
    multipart: {
      image: {
        name: 'pixel.gif',
        mimeType: 'image/gif',
        buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
      },
    },
  });
  expect(upload.ok()).toBe(true);
  const photo = await upload.json();
  const originalPhoto = await (await page.request.get(photo.url)).body();
  const backupDirectory = testInfo.outputPath('backup');
  await mkdir(backupDirectory, { recursive: true });
  await docker(...compose, 'stop', 'mealmanager');
  await docker(
    'run',
    '--rm',
    '--entrypoint',
    'tar',
    '--volume',
    `${volume}:/data:ro`,
    '--volume',
    `${backupDirectory}:/backup`,
    image,
    '-C',
    '/data',
    '-czf',
    '/backup/data.tar.gz',
    '.',
  );
  // Only the disposable test stack is removed; restore into a newly created volume.
  await docker(...compose, 'down', '--volumes');
  await docker('volume', 'create', volume);
  await docker(
    'run',
    '--rm',
    '--entrypoint',
    'tar',
    '--volume',
    `${volume}:/data`,
    '--volume',
    `${backupDirectory}:/backup:ro`,
    image,
    '-C',
    '/data',
    '-xzf',
    '/backup/data.tar.gz',
  );
  await docker(...compose, 'up', '--detach');
  await expect
    .poll(
      async () => {
        try {
          return (await page.request.get('/api/config')).ok();
        } catch {
          return false;
        }
      },
      { timeout: 60_000 },
    )
    .toBe(true);
  // Existing cookies must decrypt after restore, proving the session keys were retained.
  const restored = await page.request.get(`/api/recipes/${recipe.id}`);
  expect(restored.ok()).toBe(true);
  expect((await restored.json()).name).toBe('Restored recipe');
  const restoredPhoto = await page.request.get(photo.url);
  expect(restoredPhoto.ok()).toBe(true);
  expect(await restoredPhoto.body()).toEqual(originalPhoto);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Favorites' })).toBeVisible();
});
