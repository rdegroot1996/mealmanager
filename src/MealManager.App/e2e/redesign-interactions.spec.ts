import type { Page } from '@playwright/test';
import { expectAlignedDialogActions, navigateTo } from './helpers';
import { expect, test } from './test';

async function seedPlanner(page: Page) {
  const session = await (await page.request.get('/api/authentication/session')).json();
  const post = async (path: string, data: unknown) => {
    const response = await page.request.post(path, {
      data,
      headers: { 'X-XSRF-TOKEN': session.antiforgeryToken },
    });
    expect(response.ok(), await response.text()).toBe(true);
    return response.json();
  };
  const recipe = await post('/api/recipes', {
    name: 'Dialog pasta',
    category: 'Meals',
    baseServings: 2,
    tags: ['Quick'],
    ingredients: [],
    steps: [],
  });
  const cycle = await post('/api/planning-cycles', {
    startDate: '2099-08-20',
    endDate: '2099-08-23',
  });
  const planning = await (await page.request.get(`/api/planning/cycle/${cycle.id}`)).json();
  const meal = await post('/api/planning-meals', {
    planningId: planning.id,
    date: '2099-08-20',
    recipeId: recipe.id,
    recipeProfileId: recipe.profiles[0].id,
  });
  const leftover = await post(`/api/planning-meals/${meal.id}/leftovers`, { date: '2099-08-23' });
  await navigateTo(page, 'Planning');
  await expect(
    page.getByRole('button', { name: 'More actions for Dialog pasta', exact: true }).first(),
  ).toBeVisible();
  return { post, cycle, meal, leftover, planningId: planning.id };
}

test('mobile app bar follows scroll direction, focus, navigation and reduced motion', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await seedPlanner(page);
  const bar = page.locator('header[appMobileAppBar]');
  await page.evaluate(() => window.scrollTo(0, 160));
  await expect(bar).toHaveClass(/max-\[800px\]:-translate-y-full/);
  await page.evaluate(() => window.scrollTo(0, 120));
  await expect(bar).not.toHaveClass(/max-\[800px\]:-translate-y-full/);
  await page.evaluate(() => window.scrollTo(0, 160));
  await expect(bar).toHaveClass(/max-\[800px\]:-translate-y-full/);
  await bar.getByRole('button', { name: 'Open account menu' }).focus();
  await expect(bar).not.toHaveClass(/max-\[800px\]:-translate-y-full/);
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.evaluate(() => window.scrollTo(0, 180));
  await expect(bar).toHaveClass(/max-\[800px\]:-translate-y-full/);
  await navigateTo(page, 'Recipes');
  await expect(bar).not.toHaveClass(/max-\[800px\]:-translate-y-full/);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.goBack();
  await expect(page.locator('app-planning-timeline-page')).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(180);
  await expect(bar).not.toHaveClass(/max-\[800px\]:-translate-y-full/);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(bar).toHaveCSS('transition-duration', '0s');
  await page.setViewportSize({ width: 1024, height: 768 });
  await expect(bar).toHaveCSS('position', 'static');
  await page.locator('main').evaluate((main) => main.scrollTo(0, 200));
  await expect(bar).not.toHaveClass(/max-\[800px\]:-translate-y-full/);
});

test('removing leftovers from meal options preserves the original meal and its grocery review', async ({
  page,
}) => {
  const { post, meal, leftover } = await seedPlanner(page);
  await post(`/api/planning-meals/${meal.id}/groceries`, {
    groceries: [{ name: 'Pasta', quantity: 2 }],
  });
  await page.reload();
  const entry = page.locator(`[data-planning-entry="${leftover.id}"]`);
  await entry.getByRole('button', { name: 'More actions for Dialog pasta', exact: true }).click();
  const options = page.getByRole('dialog', { name: 'Meal options', exact: true });
  await expect(options.getByRole('button', { name: 'Change profile', exact: true })).toHaveCount(0);
  await options.getByRole('button', { name: 'Remove leftovers', exact: true }).click();
  await expect(entry).toHaveCount(0);
  await page.reload();
  await expect(entry).toHaveCount(0);
  await expect(page.locator(`[data-planning-entry="${meal.id}"]`)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Edit groceries for Dialog pasta', exact: true }),
  ).toBeVisible();
});

async function expectDialogFocus(page: Page) {
  await expect(page.locator('dialog[open]')).toHaveCount(1);
  await expect
    .poll(() =>
      page.evaluate(
        () => !!document.querySelector('dialog[open]')?.contains(document.activeElement),
      ),
    )
    .toBe(true);
}

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1440, height: 900 },
]) {
  test(`meal dialog handoffs and moves preserve focus and persisted order at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    const { meal, post, planningId } = await seedPlanner(page);
    const companionRecipe = await post('/api/recipes', {
      name: 'Companion pasta',
      category: 'Meals',
      baseServings: 2,
      tags: [],
      ingredients: [],
      steps: [],
    });
    const companion = await post('/api/planning-meals', {
      planningId,
      date: '2099-08-21',
      recipeId: companionRecipe.id,
      recipeProfileId: companionRecipe.profiles[0].id,
    });
    await page.reload();
    const options = page
      .getByRole('button', {
        name: 'More actions for Dialog pasta',
        exact: true,
      })
      .first();
    await options.click();
    await expectDialogFocus(page);
    await page.getByRole('button', { name: 'Change profile', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Change Profile', exact: true })).toBeVisible();
    await expectDialogFocus(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    await expect(options).toBeFocused();

    await options.click();
    await page.getByRole('button', { name: 'Move to another day', exact: true }).click();
    const move = page.getByRole('dialog', { name: 'Move meal', exact: true });
    await expectDialogFocus(page);
    await expect(
      move.getByLabel('Day', { exact: true }).locator('option[value="2099-08-23"]'),
    ).toHaveCount(0);
    await move.getByLabel('Day', { exact: true }).selectOption('2099-08-21');
    await expect(move.getByRole('spinbutton')).toHaveCount(0);
    await move.getByRole('button', { name: 'Move meal', exact: true }).click();
    await expect(page.locator('dialog[open]')).toHaveCount(0);
    const friday = page.getByRole('region', { name: /Friday 21 Aug/ });
    await expect(friday.locator(`[data-planning-entry="${meal.id}"]`)).toBeVisible();
    await expect(friday.locator('[data-planning-entry]')).toHaveCount(2);
    await expect(friday.locator('[data-planning-entry]').first()).toHaveAttribute(
      'data-planning-entry',
      companion.id,
    );
    await expect(friday.locator('[data-planning-entry]').last()).toHaveAttribute(
      'data-planning-entry',
      meal.id,
    );
    await page.reload();
    await expect(friday.locator(`[data-planning-entry="${meal.id}"]`)).toBeVisible();
    await expect(friday.locator('[data-planning-entry]').last()).toHaveAttribute(
      'data-planning-entry',
      meal.id,
    );
    await options.click();
    await page.getByRole('button', { name: 'Move to another day', exact: true }).click();
    await expectDialogFocus(page);
    await expect(
      move.getByLabel('Day', { exact: true }).locator('option[value="2099-08-23"]'),
    ).toHaveCount(0);
    await move.getByLabel('Day', { exact: true }).selectOption('2099-08-22');
    await move.getByRole('button', { name: 'Move meal', exact: true }).click();
    const saturday = page.getByRole('region', { name: /Saturday 22 Aug/ });
    await expect(saturday.locator(`[data-planning-entry="${meal.id}"]`)).toBeVisible();
    await expect(options).toBeFocused();
    await expect(page.locator('app-planning-timeline-page > [aria-live="polite"]')).toContainText(
      'moved to Saturday',
    );
    await page.reload();
    await expect(saturday.locator(`[data-planning-entry="${meal.id}"]`)).toBeVisible();
  });
}

test('cycle choices, note editing, and cycle-delete handoff preserve historical restrictions', async ({
  page,
}) => {
  const { post } = await seedPlanner(page);
  await page.getByRole('button', { name: 'Add note', exact: true }).first().click();
  await expect(page.getByRole('textbox', { name: /^Note/ })).toBeFocused();
  await page.getByRole('textbox', { name: /^Note/ }).fill('Family dinner');
  await page.getByRole('button', { name: 'Add Note', exact: true }).click();
  await expect(page.getByText('Family dinner', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await expect(page.getByRole('textbox', { name: /^Note/ })).not.toBeFocused();
  await expect(
    page.getByRole('dialog', { name: 'Edit Note', exact: true }).locator('[tabindex="-1"]'),
  ).toBeFocused();
  await expectAlignedDialogActions(
    page.getByRole('dialog', { name: 'Edit Note', exact: true }),
    'Remove note',
  );
  await page.getByRole('textbox', { name: /^Note/ }).fill('Dinner together');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Dinner together', { exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Edit note', exact: true }).click();
  await page.getByRole('button', { name: 'Remove note', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByText('Dinner together', { exact: true })).toHaveCount(0);

  await post('/api/planning-cycles', { startDate: '2099-08-24', endDate: '2099-08-25' });
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'More actions for Dialog pasta', exact: true }).first(),
  ).toHaveCount(0);
  const cycleNavigation = page.getByRole('group', { name: 'Planning cycles', exact: true });
  await expect(cycleNavigation).toContainText('Historical cycle');
  await expect(page.getByRole('button', { name: 'Previous cycle', exact: true })).toBeDisabled();
  await navigateTo(page, 'Groceries');
  await expect(cycleNavigation).toContainText('Historical cycle');
  await navigateTo(page, 'Planning');
  await page.getByRole('button', { name: 'Next cycle', exact: true }).click();
  await expect(cycleNavigation).toContainText('Active cycle');
  await page.getByRole('button', { name: 'Edit range', exact: true }).click();
  await expectAlignedDialogActions(
    page.getByRole('dialog', { name: 'Edit cycle', exact: true }),
    'Delete cycle',
  );
  await page
    .getByRole('dialog', { name: 'Edit cycle', exact: true })
    .getByRole('button', { name: 'Delete cycle', exact: true })
    .click();
  await expectDialogFocus(page);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Edit range', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Edit range', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Edit cycle', exact: true })
    .getByRole('button', { name: 'Delete cycle', exact: true })
    .click();
  await expectDialogFocus(page);
  await page
    .getByRole('dialog', { name: 'Delete planning cycle?', exact: true })
    .getByRole('button', { name: 'Delete cycle', exact: true })
    .click();
  await expect(
    page.getByRole('button', { name: 'More actions for Dialog pasta', exact: true }).first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole('button', { name: 'More actions for Dialog pasta', exact: true }).first(),
  ).toBeVisible();
});

test('recipe filters apply, discard drafts, and reset through their native dialog', async ({
  page,
}) => {
  await seedPlanner(page);
  await navigateTo(page, 'Recipes');
  const filters = page.getByRole('button', { name: /^Filters/ });
  await filters.click();
  await expectDialogFocus(page);
  await page.getByRole('dialog').getByLabel('Category', { exact: true }).selectOption('Baking');
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('app-recipe-card')).toHaveCount(0);
  await filters.click();
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(filters).toBeFocused();
  await filters.click();
  await expect(page.getByRole('dialog').getByLabel('Category', { exact: true })).toHaveValue(
    'Baking',
  );
  await page.getByRole('button', { name: 'Reset', exact: true }).click();
  await page.getByRole('button', { name: 'Apply', exact: true }).click();
  await expect(page.locator('app-recipe-card')).toHaveCount(1);
});
