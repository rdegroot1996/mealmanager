import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const playwrightCli = resolve(scriptDirectory, '../node_modules/playwright/cli.js');
const child = spawn(
  process.execPath,
  [playwrightCli, 'test', '--project=journeys', ...process.argv.slice(2)],
  {
    env: { ...process.env, E2E_REUSE_CONTAINER: '1' },
    stdio: 'inherit',
  },
);

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
