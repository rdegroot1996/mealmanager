import { createCycle, createRecipe, mutate, planMeal } from './api';
import { navigateTo } from './helpers';
import { expect, test } from './test';

test('shop from a meal list, add a suggested item, and keep collected items after reload', async ({
  page,
}) => {
  const old = await createCycle(page, -7);
  await mutate(page, `/api/shopping-lists/cycle/${old.id}/items`, {
    name: 'Coffee beans',
    quantity: 4,
  });
  const cycle = await createCycle(page);
  const recipe = await createRecipe(page);
  const meal = await planMeal(page, cycle, recipe);
  await mutate(page, `/api/planned-meals/${meal.id}/groceries`, {
    groceries: [{ name: 'Pasta', quantity: 1 }],
  });
  await test.step('use a historical suggestion for an independent item', async () => {
    await navigateTo(page, 'Shopping list');
    await page.getByRole('button', { name: 'Add item', exact: true }).click();
    const editor = page.getByRole('dialog', { name: 'Add grocery item', exact: true });
    await editor.getByLabel('Quantity', { exact: true }).fill('2');
    await editor.getByRole('textbox', { name: 'Item name', exact: true }).fill('Coffee');
    await expect(editor.getByRole('button', { name: 'Coffee beans', exact: true })).toBeVisible();
    await editor.getByRole('textbox', { name: 'Item name', exact: true }).press('ArrowDown');
    await editor.getByRole('button', { name: 'Coffee beans', exact: true }).press('Enter');
    await expect(editor.getByLabel('Quantity', { exact: true })).toHaveValue('2');
    await editor.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(editor).toBeHidden();
  });
  await test.step('check the meal recipe and return to shopping', async () => {
    await page.getByRole('link', { name: 'View recipe Tomato pasta', exact: true }).click();
    await page.getByRole('link', { name: 'Back to shopping list', exact: true }).click();
    await expect(page.getByRole('checkbox', { name: 'Coffee beans', exact: true })).toBeVisible();
  });
  await test.step('collect groceries and keep the saved list', async () => {
    for (const name of ['Pasta', 'Coffee beans']) {
      await Promise.all([
        page.waitForResponse(
          (response) =>
            response.request().method() === 'PUT' &&
            response.url().includes('/api/shopping-lists/') &&
            response.ok(),
        ),
        page.getByRole('checkbox', { name, exact: true }).check(),
      ]);
    }
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Pasta', exact: true })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Coffee beans', exact: true })).toBeChecked();
  });
});
