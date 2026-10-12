import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const execFileAsync = promisify(execFile);
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const composeFile = resolve(scriptDirectory, '../../../tests/e2e/docker-compose.yml');
const composeArgs = ['compose', '--project-name', 'mealmanager-e2e', '--file', composeFile];
const applicationUrl = process.env.E2E_BASE_URL ?? 'http://localhost:8081';
const isDown = process.argv.includes('--down');

if (isDown) {
  await execFileAsync('docker', [...composeArgs, 'down', '--volumes', '--remove-orphans'], {
    timeout: 60_000,
  });
  process.exit(0);
}

await execFileAsync('docker', [...composeArgs, 'up', '--build', '--detach'], {
  timeout: 300_000,
});

const deadline = Date.now() + 120_000;
let lastError = 'The application did not respond.';

while (Date.now() < deadline) {
  try {
    const response = await fetch(`${applicationUrl}/api/config`);
    if (response.ok) {
      console.log(`MealManager is ready at ${applicationUrl}`);
      process.exit(0);
    }
    lastError = `The application returned ${response.status}.`;
  } catch (error) {
    lastError = error instanceof Error ? error.message : String(error);
  }

  await new Promise((resolveDelay) => setTimeout(resolveDelay, 1_000));
}

throw new Error(`MealManager Docker container did not become ready: ${lastError}`);
