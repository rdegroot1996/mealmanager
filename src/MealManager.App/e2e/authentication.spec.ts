import { restartContainer } from './docker';
import { signIn } from './helpers';
import { expect, test } from './test';

test('first-run setup survives a production-container restart', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Welcome home', exact: true })).toBeVisible();

  await restartContainer();
  await page.reload();

  await expect(page.getByRole('heading', { name: 'Welcome home', exact: true })).toBeVisible();
});

test('an administrator can sign out and sign back in', async ({ page }) => {
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();

  await expect(page).toHaveURL('/login');
  await signIn(page);
  await expect(page.getByRole('heading', { name: 'Welcome home', exact: true })).toBeVisible();
});

test('primary navigation works on a phone viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });

  await expect(page.getByRole('navigation', { name: 'Main navigation' }).last()).toBeVisible();
  await page.getByRole('link', { name: 'Recipes', exact: true }).last().click();
  await expect(page).toHaveURL('/recipes');
  await expect(page.getByRole('button', { name: 'Add recipe' })).toBeVisible();

  await page.getByRole('link', { name: 'Planning', exact: true }).last().click();
  await expect(page).toHaveURL('/planning');
  await expect(page.getByText('No planning cycle yet')).toBeVisible();

  await page.getByRole('link', { name: 'Groceries', exact: true }).last().click();
  await expect(page).toHaveURL('/groceries');
  await expect(page.getByText('No planning cycle yet')).toBeVisible();
});
