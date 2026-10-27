import { expect, type Page } from '@playwright/test';

export const administrator = {
  displayName: 'E2E Administrator',
  email: 'e2e-admin@example.test',
  password: 'Playwright123!',
};

export async function signIn(
  page: Page,
  account: { email: string; password: string } = administrator,
  destination = '/',
) {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(destination);
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page).toHaveURL('/login');
}

export async function setUpAdministrator(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL('/setup');
  await page.getByLabel('Display name').fill(administrator.displayName);
  await page.getByLabel('Email').fill(administrator.email);
  await page.getByLabel('Password', { exact: true }).fill(administrator.password);
  await page.getByLabel('Confirm password').fill(administrator.password);
  await page.getByRole('button', { name: 'Create administrator' }).click();
  await expect(page).toHaveURL('/');
}

export async function navigateTo(
  page: Page,
  destination: 'Dashboard' | 'Recipes' | 'Planner' | 'Shopping list',
) {
  await page
    .getByRole('navigation', { name: 'Main navigation', exact: true })
    .getByRole('link', { name: destination, exact: true })
    .filter({ visible: true })
    .click();
  const routes = {
    Dashboard: '/',
    Recipes: '/recipes',
    Planner: '/planner',
    'Shopping list': '/shopping-list',
  };
  await expect(page).toHaveURL(routes[destination]);
}
