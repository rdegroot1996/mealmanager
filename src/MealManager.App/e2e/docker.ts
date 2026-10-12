import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const composeFile = resolve(process.cwd(), '../../tests/e2e/docker-compose.yml');
const composeArgs = ['compose', '--project-name', 'mealmanager-e2e', '--file', composeFile];
const applicationUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8081';

export async function buildImage() {
  await execFileAsync('docker', [...composeArgs, 'build'], {
    timeout: 300_000,
  });
}

export async function resetContainer() {
  await recreateContainer(false);
}

export async function stopContainer() {
  await execFileAsync('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans'], {
    timeout: 60_000,
  }).catch(() => undefined);
}

export async function restartContainer() {
  await execFileAsync('docker', [...composeArgs, 'restart'], {
    timeout: 60_000,
  });
  await waitForApplication();
}

async function recreateContainer(build: boolean) {
  await stopContainer();
  await execFileAsync('docker', [...composeArgs, 'up', ...(build ? ['--build'] : []), '--detach'], {
    timeout: build ? 300_000 : 60_000,
  });
  await waitForApplication();
}

async function waitForApplication() {
  const deadline = Date.now() + 120_000;
  let lastError = 'The application did not respond.';

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${applicationUrl}/api/config`);
      if (response.ok) return;
      lastError = `The application returned ${response.status}.`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
  }

  throw new Error(`MealManager Docker container did not become ready: ${lastError}`);
}
