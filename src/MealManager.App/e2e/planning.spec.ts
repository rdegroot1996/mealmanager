import type { ApiRecipeProfile } from '../src/app/api/models/api-recipe';
import { createCycle, createRecipe, date, mutate, planMeal } from './api';
import { navigateTo } from './helpers';
import { expect, test } from './test';

test('plan meals and leftovers, then decide which groceries to buy', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const recipe = await createRecipe(page);
  await createCycle(page, 0, 3);
  await mutate(
    page,
    `/api/recipe-profiles/${recipe.profiles[0].id}`,
    {
      name: 'Default',
      servings: 2,
      groceries: [{ name: 'Pasta sauce', quantity: 1, atHome: false }],
    },
    'PUT',
  );
  const family = await mutate<ApiRecipeProfile>(page, '/api/recipe-profiles', {
    recipeId: recipe.id,
    name: 'Family',
    servings: 4,
  });
  await test.step('plan a meal and a day note without adding groceries', async () => {
    await navigateTo(page, 'Planner');
    await page.getByRole('button', { name: 'Add meal', exact: true }).first().click();
    await page.getByRole('button', { name: 'Tomato pasta' }).click();
    await page
      .getByRole('dialog', { name: 'Add meal', exact: true })
      .getByRole('button', { name: 'Add meal', exact: true })
      .click();
    await page.getByRole('button', { name: 'Add note', exact: true }).first().click();
    await page.getByRole('textbox', { name: 'Note', exact: true }).fill('Family dinner');
    await page
      .getByRole('dialog', { name: 'Add note', exact: true })
      .getByRole('button', { name: 'Add note', exact: true })
      .click();
    await expect(page.getByText('Family dinner', { exact: true })).toBeVisible();
    await navigateTo(page, 'Shopping list');
    await expect(
      page.getByText('No meal groceries have been added yet.', { exact: true }),
    ).toBeVisible();
  });
  await test.step('plan leftovers and move them to another day', async () => {
    await navigateTo(page, 'Planner');
    await page.getByRole('button', { name: 'More actions for Tomato pasta', exact: true }).click();
    await page.getByRole('button', { name: 'Plan leftovers', exact: true }).click();
    const leftovers = page.getByRole('dialog', { name: 'Plan leftovers', exact: true });
    await leftovers.getByLabel('Day').selectOption(date(1));
    await leftovers.getByRole('button', { name: 'Plan leftovers', exact: true }).click();
    const day = page
      .getByTestId('planning-day')
      .filter({ has: page.locator(`time[datetime="${date(1)}"]`) });
    await day.getByRole('button', { name: 'More actions for Tomato pasta', exact: true }).click();
    await page.getByRole('button', { name: 'Move to another day', exact: true }).click();
    const move = page.getByRole('dialog', { name: 'Move meal', exact: true });
    await move.getByLabel('Day').selectOption(date(2));
    await move.getByRole('button', { name: 'Move meal', exact: true }).click();
    await expect(move).toBeHidden();
    await page.reload();
    await expect(
      page.getByTestId('planning-day').filter({ has: page.locator(`time[datetime="${date(2)}"]`) }),
    ).toContainText('Leftovers');
  });
  await test.step('review groceries and see them on the shopping list', async () => {
    await page
      .getByRole('button', { name: 'Review groceries for Tomato pasta', exact: true })
      .click();
    await page.getByRole('button', { name: 'Add 1 item to shopping list', exact: true }).click();
    await navigateTo(page, 'Shopping list');
    await expect(page.getByRole('checkbox', { name: 'Pasta sauce', exact: true })).toBeVisible();
  });
  await test.step('change the profile and explicitly confirm nothing to buy', async () => {
    await navigateTo(page, 'Planner');
    await page
      .getByRole('button', { name: 'More actions for Tomato pasta', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'Change profile', exact: true }).click();
    const change = page.getByRole('dialog', { name: 'Change profile', exact: true });
    await change.getByLabel('Profile', { exact: true }).selectOption(family.id);
    await change.getByRole('button', { name: 'Change profile', exact: true }).click();
    await page
      .getByRole('button', { name: 'Review groceries for Tomato pasta', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm nothing to buy', exact: true }).click();
    await navigateTo(page, 'Shopping list');
    await expect(page.getByRole('checkbox', { name: 'Pasta sauce', exact: true })).toHaveCount(0);
    await expect(
      page.getByText('No groceries needed for this meal.', { exact: true }),
    ).toBeVisible();
  });
});

test('continue editing history while new meals and Dashboard use the active cycle', async ({
  page,
}) => {
  const recipe = await createRecipe(page);
  const historical = await createCycle(page, -2, 5);
  const original = await planMeal(page, historical, recipe, date(-1));
  await mutate(page, `/api/planned-meals/${original.id}/leftovers`, { date: date() });
  const active = await createCycle(page, 7);
  await test.step('edit an older plan and its shopping list', async () => {
    await navigateTo(page, 'Planner');
    await page.getByRole('button', { name: 'Previous cycle', exact: true }).click();
    await page
      .getByRole('button', { name: 'Review groceries for Tomato pasta', exact: true })
      .click();
    await page.getByRole('button', { name: 'Confirm nothing to buy', exact: true }).click();
    await navigateTo(page, 'Shopping list');
    await expect(page.getByText('Historical cycle', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    await page.getByRole('textbox', { name: 'Item name', exact: true }).fill('Historical coffee');
    await page
      .getByRole('dialog', { name: 'Add grocery item', exact: true })
      .getByRole('button', { name: 'Add', exact: true })
      .click();
    await expect(
      page.getByRole('checkbox', { name: 'Historical coffee', exact: true }),
    ).toBeVisible();
  });
  await test.step('see meals from today and open the active cycle from Dashboard', async () => {
    await navigateTo(page, 'Dashboard');
    await expect(page.locator('app-upcoming-meals')).toContainText('Leftovers');
    await page.getByRole('link', { name: 'Plan a meal', exact: true }).click();
    await expect(page.getByText('Active cycle', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Previous cycle', exact: true }).click();
  });
  await test.step('add from a historical recipe link into the active cycle', async () => {
    await page.getByRole('link', { name: 'View recipe Tomato pasta', exact: true }).first().click();
    await page.getByRole('button', { name: 'Add to planner', exact: true }).click();
    const planning = page.getByRole('dialog', { name: 'Add to planner', exact: true });
    await planning.getByLabel('Day').selectOption(active.startDate);
    await planning.getByRole('button', { name: 'Add to planner', exact: true }).click();
    await expect(planning).toBeHidden();
    await navigateTo(page, 'Planner');
    await expect(page.getByText('Historical cycle', { exact: true })).toBeVisible();
  });
  await test.step('remove an original and its linked leftovers, then return to the active cycle', async () => {
    await page
      .getByRole('button', { name: 'More actions for Tomato pasta', exact: true })
      .first()
      .click();
    await page.getByRole('button', { name: 'Remove meal', exact: true }).click();
    const confirmation = page.getByRole('dialog', { name: 'Remove planned meal?', exact: true });
    await expect(confirmation).toContainText(
      'Any leftovers linked to this meal will also be removed.',
    );
    await confirmation.getByRole('button', { name: 'Remove meal', exact: true }).click();
    await expect(confirmation).toBeHidden();
    await page.reload();
    await expect(
      page.getByRole('link', { name: 'View recipe Tomato pasta', exact: true }),
    ).toHaveCount(0);
    await navigateTo(page, 'Shopping list');
    await expect(
      page.getByRole('checkbox', { name: 'Historical coffee', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'View recipe Tomato pasta', exact: true }),
    ).toHaveCount(0);
    await navigateTo(page, 'Planner');
    await page.getByRole('button', { name: 'Return to active cycle', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'View recipe Tomato pasta', exact: true }),
    ).toBeVisible();
  });
});
