import { expect, test } from './test';
import { createCycle } from './api';

test('language choice persists across reloads without changing routes', async ({ page }) => {
  await createCycle(page, 0, 1);
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('combobox', { name: 'Language' }).selectOption('nl-NL');

  await expect(page.locator('html')).toHaveAttribute('lang', 'nl-NL');
  await expect(page.getByRole('heading', { name: 'Favorieten' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Planning', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Boodschappen', exact: true })).toBeVisible();
  await expect(page).toHaveURL('/');

  await page.goto('/recipes');
  await expect(page).toHaveURL('/recipes');
  await expect(page.getByRole('heading', { name: 'Recepten', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'nl-NL');
  await expect(page.getByRole('heading', { name: 'Recepten', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Filters', exact: true }).click();
  await expect(page.getByRole('searchbox', { name: 'Tags', exact: true })).toBeVisible();
  await page.goto('/planner');
  await expect(page.getByRole('heading', { name: 'Planning', exact: true })).toBeVisible();
  await expect(page.getByText('Vandaag', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Periode bewerken', exact: true }).click();
  const cycleEditor = page.getByRole('dialog', { name: 'Periode bewerken', exact: true });
  await expect(
    cycleEditor.getByRole('spinbutton', { name: 'Planningsdagen', exact: true }),
  ).toBeVisible();
  await cycleEditor.getByRole('button', { name: 'Sluiten', exact: true }).click();
  await page.goto('/shopping-list');
  await expect(page.getByRole('heading', { name: 'Boodschappen', exact: true })).toBeVisible();
});
