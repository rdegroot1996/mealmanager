import { worker } from './browser';
import { HttpNetworkFrame } from 'msw/experimental';

export async function startMocks() {
  await worker.start({
    onUnhandledFrame({ frame, defaults }) {
      if (
        frame instanceof HttpNetworkFrame &&
        new URL(frame.data.request.url).pathname.startsWith('/api/')
      ) {
        defaults.error();
      }
    },
  });
}
