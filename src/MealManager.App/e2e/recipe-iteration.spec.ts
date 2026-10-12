import { DateTime } from 'luxon';
import { expect, test } from './test';
import { navigateTo } from './helpers';
import { restartContainer } from './docker';

test('notes and categories persist, and frequency includes future meals without extra card metadata', async ({
  page,
}) => {
  const session = await (await page.request.get('/api/authentication/session')).json();
  const post = async (path: string, data: unknown) => {
    const response = await page.request.post(path, {
      data,
      headers: { 'X-XSRF-TOKEN': session.antiforgeryToken },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const today = DateTime.local().toISODate()!;
  const tomorrow = DateTime.local().plus({ days: 1 }).toISODate()!;
  const future = await post('/api/recipes', {
    name: 'Future bread',
    category: 'Baking',
    baseServings: 2,
    notes: 'Book, page 42\nFamily favorite',
    tags: ['Baking'],
    ingredients: [],
    steps: [],
  });
  const past = await post('/api/recipes', {
    name: 'Past pasta',
    category: 'Meals',
    baseServings: 2,
    tags: ['Quick'],
    ingredients: [],
    steps: [],
  });
  const cycle = await post('/api/planning-cycles', { startDate: today, endDate: tomorrow });
  const planning = await (await page.request.get(`/api/planning/cycle/${cycle.id}`)).json();
  for (const [recipe, date] of [
    [past, today],
    [future, tomorrow],
    [future, tomorrow],
  ] as const) {
    await post('/api/planning-meals', {
      planningId: planning.id,
      date,
      recipeId: recipe.id,
      recipeProfileId: recipe.profiles[0].id,
    });
  }
  await navigateTo(page, 'Recipes');
  const sort = page.getByLabel('Recipe sort order');
  await expect(sort.locator('option[value="NextPlanned"]')).toHaveCount(0);
  await sort.selectOption('MostPlanned');
  await expect(page.getByLabel('Include upcoming plans')).toHaveCount(0);
  await expect(page.locator('app-recipe-card').first()).toContainText('Future bread');
  await expect(page.getByTestId('recipe-grid')).not.toContainText('Next planned');
  await page.locator(`a[href="/recipes/${future.id}"]`).click();
  await expect(page.getByRole('heading', { name: 'Notes', exact: true })).toBeVisible();
  await expect(page.getByText('Book, page 42\nFamily favorite', { exact: true })).toBeVisible();
  await restartContainer();
  await page.reload();
  await expect(page.getByText('Book, page 42\nFamily favorite', { exact: true })).toBeVisible();
});

test('shopping autocomplete keeps its panel while querying and respects dismissal', async ({
  page,
}) => {
  const session = await (await page.request.get('/api/authentication/session')).json();
  const today = DateTime.local().toISODate()!;
  const response = await page.request.post('/api/planning-cycles', {
    headers: { 'X-XSRF-TOKEN': session.antiforgeryToken },
    data: { startDate: today, endDate: today },
  });
  expect(response.ok()).toBe(true);
  await navigateTo(page, 'Groceries');
  await page.getByRole('button', { name: 'Add item', exact: true }).click();
  await page.route('**/api/grocery-lists/suggestions?*', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 600));
    await route.continue();
  });
  const input = page.getByLabel('Item name');
  const panel = page.locator('[aria-label="Item suggestions"]');
  await input.fill('zz');
  await expect(panel.getByRole('status')).toContainText('Searching');
  await panel.evaluate((element) => element.setAttribute('data-panel-identity', 'original'));
  await expect(panel.getByRole('status')).toContainText('No results');
  await expect(panel).toHaveAttribute('data-panel-identity', 'original');
  await input.fill('Milk');
  await expect(panel.getByRole('status')).toContainText('Searching');
  const completed = page.waitForResponse(
    (response) => response.url().includes('/api/grocery-lists/suggestions') && response.ok(),
  );
  await input.press('Escape');
  await completed;
  await expect(panel).toHaveCount(0);
  await expect(input).toBeVisible();
});
