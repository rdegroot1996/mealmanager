import { test as base, expect } from '@playwright/test';
import { resetContainer } from './docker';
import { administrator } from './helpers';
import { mutate } from './api';

export const test = base.extend<{ container: void; initializeHousehold: boolean }>({
  initializeHousehold: [true, { option: true }],
  container: [
    async ({}, use) => {
      await resetContainer();
      await use();
    },
    { auto: true, timeout: 120_000 },
  ],
  page: [
    async ({ page, container, initializeHousehold }, use) => {
      // Keep page setup after the isolated container has started.
      void container;
      if (initializeHousehold) {
        await mutate(page, '/api/config/initialize', {
          adminEmail: administrator.email,
          adminPassword: administrator.password,
          adminDisplayName: administrator.displayName,
        });
        await mutate(page, '/api/authentication/login', administrator);
        await page.goto('/');
      }
      await use(page);
    },
    { scope: 'test', timeout: 120_000 },
  ],
});

export { expect };
