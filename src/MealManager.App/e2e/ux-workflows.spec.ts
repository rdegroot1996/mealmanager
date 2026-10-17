import { DateTime } from 'luxon';
import { expect, test } from './test';
import { navigateTo } from './helpers';

test('missing search creates a recipe, preserves its day, and requires explicit planning', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const session = await (await page.request.get('/api/authentication/session')).json();
  const start = DateTime.local();
  const date = start.plus({ days: 12 }).toISODate()!;
  const response = await page.request.post('/api/planning-cycles', {
    headers: { 'X-XSRF-TOKEN': session.antiforgeryToken },
    data: { startDate: start.toISODate(), endDate: start.plus({ days: 14 }).toISODate() },
  });
  expect(response.ok()).toBe(true);
  const cycle = await response.json();
  await navigateTo(page, 'Planner');
  const day = page
    .getByTestId('planning-day')
    .filter({ has: page.locator(`time[datetime="${date}"]`) });
  await day.getByRole('button', { name: 'Add meal', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Search recipes', exact: true }).fill('Freezer pizza');
  await expect(page.getByText('No matching recipes found.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Create “Freezer pizza”', exact: true }).click();
  await expect(page.getByLabel('Recipe name', { exact: true })).toHaveValue('Freezer pizza');
  await page.locator('app-page-header').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Photos', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add image', exact: true })).toBeEnabled();
  const before = await (await page.request.get(`/api/meal-plans/cycle/${cycle.id}`)).json();
  expect(before.entries).toHaveLength(0);
  await page.getByRole('button', { name: 'Continue planning', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Add meal', exact: true });
  await expect(dialog).toContainText('Freezer pizza');
  await expect(dialog.getByRole('combobox', { name: 'Day', exact: true })).toHaveValue(date);
  expect(
    (await (await page.request.get(`/api/meal-plans/cycle/${cycle.id}`)).json()).entries,
  ).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Add meal', exact: true }).click();
  await expect(
    day.getByRole('button', { name: 'Review groceries for Freezer pizza', exact: true }),
  ).toBeVisible();
  await day
    .getByRole('link', { name: 'View recipe Freezer pizza', exact: true })
    .scrollIntoViewIfNeeded();
  const top = await page.evaluate(() => window.scrollY);
  await day.getByRole('link', { name: 'View recipe Freezer pizza', exact: true }).click();
  await expect(
    page.getByText('You can plan this recipe without ingredients or steps.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('link', { name: 'Back to planner', exact: true }).click();
  await expect(day).toBeVisible();
  await expect
    .poll(() => page.evaluate((expected) => Math.abs(window.scrollY - expected), top))
    .toBeLessThanOrEqual(2);
});

test('dashboard opens the active cycle and history offers a direct return', async ({ page }) => {
  const session = await (await page.request.get('/api/authentication/session')).json();
  const start = DateTime.local();
  for (const offset of [-7, 0]) {
    const response = await page.request.post('/api/planning-cycles', {
      headers: { 'X-XSRF-TOKEN': session.antiforgeryToken },
      data: {
        startDate: start.plus({ days: offset }).toISODate(),
        endDate: start.plus({ days: offset + 6 }).toISODate(),
      },
    });
    expect(response.ok()).toBe(true);
  }
  await navigateTo(page, 'Planner');
  await page.getByRole('button', { name: 'Previous cycle', exact: true }).click();
  await expect(page.getByText('Historical meal plan is read-only.', { exact: true })).toBeVisible();
  await navigateTo(page, 'Dashboard');
  await page.getByRole('link', { name: 'Plan a meal', exact: true }).click();
  await expect(page.getByText('Active cycle', { exact: true })).toBeVisible();
  await expect(page.getByText('Historical meal plan is read-only.', { exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Previous cycle', exact: true }).click();
  await page.getByRole('button', { name: 'Return to active cycle', exact: true }).click();
  await expect(page.getByText('Active cycle', { exact: true })).toBeVisible();
});

test('cooking view automatically keeps the screen awake and releases its lock on return', async ({
  page,
}) => {
  const session = await (await page.request.get('/api/authentication/session')).json();
  const response = await page.request.post('/api/recipes', {
    headers: { 'X-XSRF-TOKEN': session.antiforgeryToken },
    data: {
      name: 'Cooking pasta',
      category: 'Meals',
      baseServings: 2,
      tags: [],
      ingredients: [{ name: 'Pasta', quantity: 200, unit: 'g', order: 0 }],
      steps: [{ description: 'Boil and serve.', order: 0 }],
    },
  });
  expect(response.ok()).toBe(true);
  const recipe = await response.json();
  await page.goto(`/recipes/${recipe.id}`);
  await page.evaluate(() => {
    const state = { requests: 0, releases: 0 };
    Object.assign(window, { cookingWakeTest: state });
    Object.defineProperty(navigator, 'wakeLock', {
      configurable: true,
      value: {
        request: async () => {
          state.requests++;
          const lock = Object.assign(new EventTarget(), {
            released: false,
            release: async () => {
              state.releases++;
              lock.released = true;
              lock.dispatchEvent(new Event('release'));
            },
          });
          return lock;
        },
      },
    });
  });
  await page.getByRole('button', { name: 'Cooking mode', exact: true }).click();
  await expect(page.getByTestId('cooking-view')).toContainText('200 g');
  await expect(page.getByTestId('cooking-view')).toContainText('Boil and serve.');
  await expect(page.getByRole('button', { name: 'Add to planner', exact: true })).toHaveCount(0);
  await expect(page.getByRole('status')).toContainText(
    'Your screen stays on while cooking mode is open.',
  );
  await page.getByRole('button', { name: 'Back to recipe', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cooking mode', exact: true })).toBeFocused();
  expect(
    await page.evaluate(
      () =>
        (window as unknown as { cookingWakeTest: { requests: number; releases: number } })
          .cookingWakeTest,
    ),
  ).toEqual({ requests: 1, releases: 1 });
});

for (const width of [390, 1024]) {
  test(`recipe return preserves Planner and Shopping positions at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const session = await (await page.request.get('/api/authentication/session')).json();
    const post = async (path: string, data: unknown) => {
      const response = await page.request.post(path, {
        headers: { 'X-XSRF-TOKEN': session.antiforgeryToken },
        data,
      });
      expect(response.ok(), await response.text()).toBe(true);
      return response.json();
    };
    const start = DateTime.local();
    const recipe = await post('/api/recipes', {
      name: 'Return meal',
      category: 'Meals',
      baseServings: 2,
      tags: [],
      ingredients: [],
      steps: [],
    });
    const cycle = await post('/api/planning-cycles', {
      startDate: start.toISODate(),
      endDate: start.plus({ days: 13 }).toISODate(),
    });
    const mealPlan = await (await page.request.get(`/api/meal-plans/cycle/${cycle.id}`)).json();
    for (let day = 0; day < 14; day++) {
      const meal = await post('/api/planned-meals', {
        mealPlanId: mealPlan.id,
        date: start.plus({ days: day }).toISODate(),
        recipeId: recipe.id,
        recipeProfileId: recipe.profiles[0].id,
      });
      await post(`/api/planned-meals/${meal.id}/groceries`, {
        groceries: [{ name: 'Shopping item', quantity: 1 }],
      });
    }
    for (const destination of ['Planner', 'Shopping list'] as const) {
      await navigateTo(page, destination);
      const recipeLink = page
        .getByRole('link', { name: 'View recipe Return meal', exact: true })
        .last();
      await recipeLink.scrollIntoViewIfNeeded();
      const top = await page.evaluate(() =>
        innerWidth >= 800 ? document.querySelector('main')!.scrollTop : scrollY,
      );
      expect(top).toBeGreaterThan(200);
      await recipeLink.click();
      await page
        .getByRole('link', {
          name: destination === 'Planner' ? 'Back to planner' : 'Back to shopping list',
          exact: true,
        })
        .click();
      await expect(recipeLink).toBeVisible();
      await expect
        .poll(() =>
          page.evaluate(
            (expected) =>
              Math.abs(
                (innerWidth >= 800 ? document.querySelector('main')!.scrollTop : scrollY) -
                  expected,
              ),
            top,
          ),
        )
        .toBeLessThanOrEqual(2);
    }
  });
}
