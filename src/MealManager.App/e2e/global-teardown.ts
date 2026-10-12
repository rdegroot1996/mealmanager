import { stopContainer } from './docker';

export default async function globalTeardown() {
  if (process.env.E2E_REUSE_CONTAINER === '1') return;
  await stopContainer();
}
