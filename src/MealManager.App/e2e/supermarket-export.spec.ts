import type { Page } from '@playwright/test';
import type { ApiRecipeProfile } from '../src/app/api/models/api-recipe';
import { createCycle, createRecipe, mutate, planMeal } from './api';
import { navigateTo } from './helpers';
import { expect, test } from './test';

async function chooseProduct(page: Page, item: string, product: string, query?: string) {
  const review = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
  const escapedItem = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await review
    .getByRole('button', {
      name: new RegExp(`^(Choose|Change) supermarket product for ${escapedItem}$`),
    })
    .click();
  const picker = page.getByRole('dialog', { name: `Product for ${item}`, exact: true });
  if (query) {
    await picker.getByRole('searchbox', { name: 'Search products', exact: true }).fill(query);
    await picker.getByRole('searchbox', { name: 'Search products', exact: true }).press('Enter');
  }
  await picker
    .getByRole('button')
    .filter({ has: page.getByText(product, { exact: true }) })
    .click();
}

async function exportProducts(page: Page, result: string) {
  const review = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
  await review.getByRole('button', { name: /^Add to Picnic(?:\s|$)/ }).click();
  await expect(review.getByText(result, { exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(review).toBeHidden();
}

test('connect a supermarket, export groceries, and reuse a saved product choice', async ({
  page,
}) => {
  const cycle = await createCycle(page);
  const recipe = await createRecipe(page, 'Noodles');
  const profile = await mutate<ApiRecipeProfile>(
    page,
    `/api/recipe-profiles/${recipe.profiles[0].id}`,
    {
      name: 'Default',
      servings: 2,
      groceries: [{ name: 'Woknoedels', quantity: 1, atHome: false }],
    },
    'PUT',
  );
  const meal = await planMeal(page, cycle, recipe);
  await mutate(page, `/api/planned-meals/${meal.id}/groceries`, {
    groceries: [
      { recipeProfileGroceryItemId: profile.groceries[0].id, name: 'Woknoedels', quantity: 1 },
    ],
  });
  await test.step('connect the shared Picnic account', async () => {
    await page.goto('/settings');
    await page
      .getByRole('region', { name: 'Supermarket integrations' })
      .getByRole('button', { name: 'Connect', exact: true })
      .click();
    const connection = page.getByRole('dialog', { name: 'Picnic connection', exact: true });
    await connection.getByLabel('Email', { exact: true }).fill('picnic@example.test');
    await connection.getByLabel('Password', { exact: true }).fill('Picnic123!');
    await connection.getByRole('button', { name: 'Connect', exact: true }).click();
    await connection.getByLabel('SMS verification code').fill('123456');
    await connection.getByRole('button', { name: 'Verify connection', exact: true }).click();
    await expect(connection).toBeHidden();
    await expect(
      page.getByText('Connected · NL', { exact: true }).filter({ visible: true }),
    ).toBeVisible();
  });
  await test.step('choose a product and export it', async () => {
    await navigateTo(page, 'Shopping list');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await chooseProduct(page, 'Woknoedels', 'Picnic Woknoedels');
    await exportProducts(page, '1 product added.');
    await expect(page.getByRole('checkbox', { name: 'Woknoedels', exact: true })).toBeChecked();
  });
  await test.step('replace a remembered choice for future exports', async () => {
    await page.reload();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const review = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
    await review.locator('summary').filter({ hasText: 'Already checked' }).click();
    await expect(review.getByText('Picnic Woknoedels', { exact: true })).toBeVisible();
    await review.getByRole('checkbox', { name: /^Woknoedels/ }).check();
    await chooseProduct(page, 'Woknoedels', 'Conimex Woknoedels');
    await page
      .getByRole('dialog', { name: 'Use this product next time too?', exact: true })
      .getByRole('button', { name: 'Use next time too', exact: true })
      .click();
    await exportProducts(page, '1 product added.');
    await page.reload();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await review.locator('summary').filter({ hasText: 'Already checked' }).click();
    await expect(review.getByText('Conimex Woknoedels', { exact: true })).toBeVisible();
  });
});

test('recover a partial export by replacing the failed product and exporting again', async ({
  page,
}) => {
  await mutate(page, '/api/integrations/picnic/connect', {
    email: 'picnic@example.test',
    password: 'Picnic123!',
    countryCode: 'NL',
    resetProductMappings: false,
  });
  await mutate(page, '/api/integrations/picnic/verification-code', {});
  await mutate(page, '/api/integrations/picnic/verify', { code: '123456' });
  const cycle = await createCycle(page);
  for (const name of ['Woknoedels', 'Test geweigerd']) {
    await mutate(page, `/api/shopping-lists/cycle/${cycle.id}/items`, { name, quantity: 1 });
  }
  let sends = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      request.url().endsWith(`/api/supermarkets/cycles/${cycle.id}/send`)
    )
      sends++;
  });
  await test.step('export and see which item failed', async () => {
    await navigateTo(page, 'Shopping list');
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await chooseProduct(page, 'Woknoedels', 'Picnic Woknoedels');
    await chooseProduct(page, 'Test geweigerd', 'Test geweigerd');
    await exportProducts(page, '1 added; 1 failed.');
    await expect(page.getByRole('checkbox', { name: 'Woknoedels', exact: true })).toBeChecked();
    await expect(
      page.getByRole('checkbox', { name: 'Test geweigerd', exact: true }),
    ).not.toBeChecked();
    expect(sends).toBe(1);
  });
  await test.step('replace the failure and explicitly export the remaining item', async () => {
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    await chooseProduct(page, 'Test geweigerd', 'Picnic Melk', 'Melk');
    await exportProducts(page, '1 product added.');
    await page.reload();
    await expect(page.getByRole('checkbox', { name: 'Woknoedels', exact: true })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Test geweigerd', exact: true })).toBeChecked();
    expect(sends).toBe(2);
  });
});
