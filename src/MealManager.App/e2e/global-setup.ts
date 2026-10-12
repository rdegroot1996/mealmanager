import { buildImage } from './docker';

export default async function globalSetup() {
  if (process.env.E2E_REUSE_CONTAINER === '1') return;
  await buildImage();
}
