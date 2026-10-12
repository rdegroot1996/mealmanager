import { expect, test } from './test';

test('language choice persists across reloads without changing routes', async ({ page }) => {
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('nl-NL');

  await expect(page.locator('html')).toHaveAttribute('lang', 'nl-NL');
  await expect(page.getByRole('heading', { name: 'Favorieten van het huishouden' })).toBeVisible();
  await expect(page).toHaveURL('/');

  await page.goto('/recipes');
  await expect(page).toHaveURL('/recipes');
  await expect(page.getByRole('heading', { name: 'Recepten', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl-NL');
  await expect(page.getByRole('heading', { name: 'Recepten', exact: true })).toBeVisible();
});
