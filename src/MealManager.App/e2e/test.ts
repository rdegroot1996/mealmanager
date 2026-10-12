import { test as base, expect } from '@playwright/test';
import { resetContainer } from './docker';
import { setUpAdministrator } from './helpers';

export const test = base.extend({
  page: [
    async ({ page }, use) => {
      await resetContainer();
      await setUpAdministrator(page);
      await use(page);
    },
    { scope: 'test', timeout: 120_000 },
  ],
});

export { expect };
