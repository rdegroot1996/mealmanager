import { DateTime } from 'luxon';
import type { Page } from '@playwright/test';
import { expect, test } from './test';

async function api(page: Page) {
  const session = await (await page.request.get('/api/authentication/session')).json();
  return async (path: string, data: unknown) => {
    const response = await page.request.post(path, {
      data,
      headers: { 'X-XSRF-TOKEN': session.antiforgeryToken },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
}

test('upcoming meals retain nearer meals and leftovers when the active cycle is future', async ({
  page,
}) => {
  const post = await api(page);
  const today = DateTime.local().startOf('day');
  const date = (offset: number) => today.plus({ days: offset }).toISODate()!;
  const recipe = await post('/api/recipes', {
    name: 'Nearer pasta',
    category: 'Meals',
    baseServings: 4,
    tags: [],
    ingredients: [],
    steps: [],
  });
  const old = await post('/api/planning-cycles', { startDate: date(-2), endDate: date(1) });
  const planning = await (await page.request.get(`/api/planning/cycle/${old.id}`)).json();
  const meal = await post('/api/planning-meals', {
    planningId: planning.id,
    date: date(-1),
    recipeId: recipe.id,
    recipeProfileId: recipe.profiles[0].id,
  });
  await post(`/api/planning-meals/${meal.id}/leftovers`, { date: date(0) });
  await post('/api/planning-meals', {
    planningId: planning.id,
    date: date(1),
    recipeId: recipe.id,
    recipeProfileId: recipe.profiles[0].id,
  });
  await post('/api/planning-cycles', { startDate: date(3), endDate: date(9) });
  await page.reload();
  const upcoming = page.locator('app-upcoming-meals');
  await expect(upcoming.getByTestId('upcoming-day-preview')).toHaveCount(7);
  await expect(upcoming.getByTestId('upcoming-day-preview').first()).toContainText(
    String(today.day),
  );
  await expect(upcoming.getByRole('link', { name: 'View recipe Nearer pasta' })).toHaveCount(2);
  await expect(upcoming.getByText('Leftovers', { exact: true })).toBeVisible();
  await expect(upcoming.locator('[data-testid="upcoming-day-status"].bg-primary')).toHaveCount(2);
  await expect(upcoming.locator('[data-testid="upcoming-day-preview"].bg-secondary')).toHaveCount(
    1,
  );
  await expect(upcoming.getByTestId('upcoming-day-preview').first()).toHaveClass(/bg-secondary/);
});

test('shopping suggestions reuse historical names without saving or changing quantity', async ({
  page,
}) => {
  const post = await api(page);
  const old = await post('/api/planning-cycles', {
    startDate: '2026-01-01',
    endDate: '2026-01-04',
  });
  await post(`/api/grocery-lists/cycle/${old.id}/items`, { name: 'wc papier', quantity: 4 });
  const current = await post('/api/planning-cycles', {
    startDate: '2026-01-05',
    endDate: '2026-01-08',
  });
  await page.goto('/groceries');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('2');
  const editor = page.getByRole('dialog', { name: 'Add grocery item', exact: true });
  const queries: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname === '/api/grocery-lists/suggestions')
      queries.push(url.searchParams.get('search')!);
  });
  await page.getByLabel('Item name').pressSequentially('wc', { delay: 20 });
  const suggestion = page.getByRole('button', { name: 'wc papier', exact: true });
  await expect(suggestion).toBeVisible();
  expect(queries).toEqual(['wc']);
  const dropdown = page.getByRole('group', { name: 'Item suggestions' });
  const body = await editor.locator('.app-dialog-body').boundingBox();
  const footer = await editor.locator('.app-dialog-footer').boundingBox();
  expect(body!.y + body!.height).toBeLessThanOrEqual(footer!.y);
  expect(footer!.y + footer!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  await page.getByLabel('Item name').press('ArrowDown');
  await expect(suggestion).toBeFocused();
  await suggestion.press('Enter');
  await expect(dropdown).toBeHidden();
  await expect(page.getByLabel('Item name')).toHaveValue('wc papier');
  await expect(page.getByRole('spinbutton', { name: 'Quantity', exact: true })).toHaveValue('2');
  const before = await (await page.request.get(`/api/grocery-lists/cycle/${current.id}`)).json();
  expect(before.groceries).toHaveLength(0);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Edit wc papier', exact: true })).toBeVisible();
  const saved = await (await page.request.get(`/api/grocery-lists/cycle/${current.id}`)).json();
  expect(
    saved.groceries.map((item: { name: string; quantity: number }) => ({
      name: item.name,
      quantity: item.quantity,
    })),
  ).toEqual([{ name: 'wc papier', quantity: 2 }]);
});
