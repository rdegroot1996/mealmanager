import { Page } from '@playwright/test';
import { expect, test } from './test';
import { restartContainer } from './docker';

async function connect(page: Page) {
  await page.goto('/settings');
  const integrations = page.getByRole('region', { name: 'Supermarket integrations' });
  await integrations.getByRole('button', { name: 'Connect', exact: true }).click();
  const connection = page.getByRole('dialog', { name: 'Picnic connection', exact: true });
  await connection.getByLabel('Email', { exact: true }).fill('picnic@example.test');
  await connection.getByLabel('Password', { exact: true }).fill('Picnic123!');
  await connection.getByRole('button', { name: 'Connect', exact: true }).click();
  await page.getByLabel('SMS verification code').fill('000000');
  await page.getByRole('button', { name: 'Verify connection' }).click();
  await expect(page.getByRole('alert')).toContainText('verification code is invalid');
  await page.getByLabel('SMS verification code').fill('123456');
  await page.getByRole('button', { name: 'Verify connection' }).click();
  await expect(connection).toBeHidden();
  await expect(
    integrations.getByText('Connected · NL', { exact: true }).filter({ visible: true }),
  ).toBeVisible();
  await expect(page.getByText('Test connection', { exact: true })).toHaveCount(0);
}
async function seed(page: Page, names: string[], profile = false) {
  return page.evaluate(
    async ({ names, profile }) => {
      const session = await (await fetch('/api/authentication/session')).json();
      const headers = {
        'Content-Type': 'application/json',
        'X-XSRF-TOKEN': session.antiforgeryToken,
      };
      const post = async (url: string, body: unknown, method = 'POST') => {
        const response = await fetch(url, { method, headers, body: JSON.stringify(body) });
        if (!response.ok) throw new Error(await response.text());
        return response.json();
      };
      const cycle = await post('/api/planning-cycles', {
        startDate: '2026-09-30',
        endDate: '2026-10-06',
      });
      for (const name of names)
        await post(`/api/shopping-lists/cycle/${cycle.id}/items`, { name, quantity: 1 });
      if (profile) {
        const recipe = await post('/api/recipes', {
          name: 'Noodles',
          category: 'Meals',
          baseServings: 2,
          tags: [],
          ingredients: [],
          steps: [],
        });
        const recipeProfile = await post(
          `/api/recipe-profiles/${recipe.profiles[0].id}`,
          {
            name: 'Default',
            servings: 2,
            groceries: [
              {
                id: '00000000-0000-0000-0000-000000000000',
                name: 'Woknoedels',
                quantity: 1,
                atHome: false,
              },
            ],
          },
          'PUT',
        );
        const mealPlan = await (await fetch(`/api/meal-plans/cycle/${cycle.id}`)).json();
        const meal = await post('/api/planned-meals', {
          mealPlanId: mealPlan.id,
          recipeId: recipe.id,
          recipeProfileId: recipeProfile.id,
          date: cycle.startDate,
        });
        await post(`/api/planned-meals/${meal.id}/groceries`, {
          groceries: [
            {
              recipeProfileGroceryItemId: recipeProfile.groceries[0].id,
              name: 'Woknoedels',
              quantity: 1,
            },
          ],
        });
      }
      return cycle.id as string;
    },
    { names, profile },
  );
}
async function choose(page: Page, item: string, product: string, query?: string) {
  const dialog = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
  const escapedItem = item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  await dialog
    .getByRole('button', {
      name: new RegExp(`^(Choose|Change) supermarket product for ${escapedItem}$`),
    })
    .click();
  const picker = page.getByRole('dialog', { name: `Product for ${item}`, exact: true });
  if (query !== undefined) {
    await picker.getByRole('searchbox', { name: 'Search products', exact: true }).fill(query);
    await picker.getByRole('searchbox', { name: 'Search products', exact: true }).press('Enter');
  }
  await picker
    .getByRole('button')
    .filter({ has: page.getByText(product, { exact: true }) })
    .click();
  await expect(picker).toBeHidden();
}
async function send(page: Page) {
  const dialog = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
  await dialog.getByRole('button', { name: /^Add to Picnic(?:\s|$)/ }).click();
}

test('an unavailable supermarket is explained only after clicking the optional action', async ({
  page,
}) => {
  await seed(page, ['Milk']);
  await page.goto('/shopping-list');
  const setup = page.getByRole('dialog', { name: 'Export groceries', exact: true });
  await expect(setup).toBeHidden();
  await expect(page.getByRole('link', { name: 'Connect a supermarket in Settings' })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(setup).toBeVisible();
  await expect(setup).toContainText('No supermarket is connected.');
  await expect(setup.getByRole('link')).toHaveCount(0);
});

test('send results clear after refresh while connection, checks and product mappings survive restart', async ({
  page,
}) => {
  test.setTimeout(120000);
  await connect(page);
  const cycle = await seed(page, [], true);
  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await choose(page, 'Woknoedels', 'Picnic Woknoedels');
  await send(page);
  await expect(page.getByRole('heading', { name: 'Supermarket results' })).toBeVisible();
  await expect(page.getByText('1 product added.', { exact: true })).toBeVisible();
  await page
    .getByRole('dialog', { name: 'Export to Picnic', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .click();
  await expect(page.getByText('1 product added.', { exact: true })).toHaveCount(0);
  await restartContainer();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Supermarket results' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Export to Picnic', exact: true })
    .locator('summary')
    .filter({ hasText: 'Already checked' })
    .click();
  await expect(page.getByText('Picnic Woknoedels', { exact: true })).toBeVisible();
  await expect(
    page
      .getByRole('dialog', { name: 'Export to Picnic', exact: true })
      .getByRole('checkbox')
      .first(),
  ).not.toBeChecked();
  const list = await (await page.request.get(`/api/shopping-lists/cycle/${cycle}`)).json();
  expect(list.mealGroups[0].items[0].checked).toBe(true);
  await page.goto('/settings');
  await expect(
    page
      .locator('app-picnic-settings')
      .getByText('Connected · NL', { exact: true })
      .filter({ visible: true }),
  ).toBeVisible();
});

test('replacement confirmation keeps one-off choices and saves future choices only after export', async ({
  page,
}) => {
  await connect(page);
  const cycle = await seed(page, [], true);
  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await choose(page, 'Woknoedels', 'Picnic Woknoedels');
  await send(page);
  await expect(page.getByText('1 product added.', { exact: true })).toBeVisible();
  const savedProductId = async () => {
    const review = await (
      await page.request.get(`/api/supermarkets/cycles/${cycle}/review?provider=picnic`)
    ).json();
    return review.items[0].product.id;
  };
  expect(await savedProductId()).toBe('s1001');
  for (const remember of [false, true]) {
    await page.reload();
    await page.getByRole('button', { name: 'Export', exact: true }).click();
    const review = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
    await review.locator('summary').filter({ hasText: 'Already checked' }).click();
    await review.getByRole('checkbox', { name: /^Woknoedels/ }).check();
    await review
      .getByRole('button', { name: 'Change supermarket product for Woknoedels', exact: true })
      .click();
    const picker = page.getByRole('dialog', { name: 'Product for Woknoedels', exact: true });
    const product = picker
      .getByRole('button')
      .filter({ has: page.getByText('Conimex Woknoedels', { exact: true }) });
    await product.click();
    const confirmation = page.getByRole('dialog', {
      name: 'Use this product next time too?',
      exact: true,
    });
    await expect(confirmation).toContainText('Picnic Woknoedels');
    await expect(confirmation).toContainText('Conimex Woknoedels');
    await confirmation.getByRole('button', { name: 'Back', exact: true }).click();
    await expect(product).toBeFocused();
    await product.click();
    await confirmation
      .getByRole('button', {
        name: remember ? 'Use next time too' : 'This export only',
        exact: true,
      })
      .click();
    await expect(picker).toBeHidden();
    expect(await savedProductId()).toBe('s1001');
    await send(page);
    await expect(page.getByText('1 product added.', { exact: true })).toBeVisible();
    expect(await savedProductId()).toBe(remember ? 's1002' : 's1001');
  }
});

test('partial failures remain unchecked and can be exported in a fresh round', async ({ page }) => {
  await connect(page);
  const cycle = await seed(page, ['Woknoedels', 'Test geweigerd', 'Melk']);
  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await choose(page, 'Woknoedels', 'Picnic Woknoedels');
  await choose(page, 'Test geweigerd', 'Test geweigerd');
  await choose(page, 'Melk', 'Picnic Melk');
  await send(page);
  await expect(page.getByText('2 added; 1 failed.')).toBeVisible();
  await expect(
    page.getByText(
      'The supermarket rejected this product. Choose a replacement or try again later.',
    ),
  ).toBeVisible();
  const afterFailure = (await (await page.request.get(`/api/shopping-lists/cycle/${cycle}`)).json())
    .items;
  expect(afterFailure.map((x: { name: string; checked: boolean }) => [x.name, x.checked])).toEqual([
    ['Woknoedels', true],
    ['Test geweigerd', false],
    ['Melk', true],
  ]);
  await page
    .getByRole('dialog', { name: 'Export to Picnic', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(
    page
      .getByRole('dialog', { name: 'Export to Picnic', exact: true })
      .getByRole('checkbox', { name: /Woknoedels/, includeHidden: true }),
  ).toBeDisabled();
  await expect(
    page
      .getByRole('dialog', { name: 'Export to Picnic', exact: true })
      .getByRole('checkbox', { name: /Melk/, includeHidden: true }),
  ).toBeDisabled();
  await choose(page, 'Test geweigerd', 'Picnic Melk', 'Melk');
  await send(page);
  await expect(page.getByText('1 product added.', { exact: true })).toBeVisible();
  expect(
    (await (await page.request.get(`/api/shopping-lists/cycle/${cycle}`)).json()).items.every(
      (x: { checked: boolean }) => x.checked,
    ),
  ).toBe(true);
});

test('unconfirmed and skipped additions show as failed and can be exported in a fresh round', async ({
  page,
}) => {
  await connect(page);
  const cycle = await seed(page, ['Test onzeker', 'Melk']);
  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await choose(page, 'Test onzeker', 'Test onzeker');
  await choose(page, 'Melk', 'Picnic Melk');
  await send(page);
  await expect(page.getByText('0 added; 2 failed.')).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
  await expect(dialog.getByText('Could not add', { exact: true })).toHaveCount(2);
  await expect(dialog.getByRole('button', { name: 'It was added', exact: true })).toHaveCount(0);
  const groceries = (await (await page.request.get(`/api/shopping-lists/cycle/${cycle}`)).json())
    .items;
  expect(groceries.every((x: { checked: boolean }) => !x.checked)).toBe(true);
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(dialog.getByRole('checkbox', { name: /Test onzeker/ })).toBeChecked();
  await expect(dialog.getByRole('checkbox', { name: /Melk/ })).toBeChecked();
  await choose(page, 'Test onzeker', 'Picnic Woknoedels', 'Woknoedels');
  await choose(page, 'Melk', 'Picnic Melk');
  await send(page);
  await expect(page.getByText('2 products added.', { exact: true })).toBeVisible();
});

test('failed request leaves groceries unchecked and never automatically resends', async ({
  page,
}) => {
  await connect(page);
  const cycle = await seed(page, ['Woknoedels']);
  let sends = 0;
  await page.route('**/api/supermarkets/cycles/*/send', async (route) => {
    sends++;
    await route.abort('failed');
  });
  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await choose(page, 'Woknoedels', 'Picnic Woknoedels');
  await send(page);
  await expect(
    page.getByText('Export failed. Close this window to review your list and export again.'),
  ).toBeVisible();
  expect(sends).toBe(1);
  expect(
    (await (await page.request.get(`/api/shopping-lists/cycle/${cycle}`)).json()).items[0].checked,
  ).toBe(false);
  await page.unroute('**/api/supermarkets/cycles/*/send');
  await page
    .getByRole('dialog', { name: 'Export to Picnic', exact: true })
    .getByRole('button', { name: 'Close', exact: true })
    .last()
    .click();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await choose(page, 'Woknoedels', 'Picnic Woknoedels');
  await send(page);
  await expect(page.getByText('1 product added.', { exact: true })).toBeVisible();
});

test('refreshes confirmed grocery checkmarks when an otherwise successful response is lost', async ({
  page,
}) => {
  test.setTimeout(60000);
  await connect(page);
  await seed(page, ['Woknoedels']);
  let sends = 0;
  await page.route('**/api/supermarkets/cycles/*/send', async (route) => {
    sends++;
    const response = await route.fetch();
    expect(response.ok()).toBe(true);
    await route.abort('failed');
  });
  await page.goto('/shopping-list');
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await choose(page, 'Woknoedels', 'Picnic Woknoedels');
  await send(page);
  await expect(
    page.getByText('Export failed. Close this window to review your list and export again.'),
  ).toBeVisible();
  const dialog = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
  await dialog.getByRole('button', { name: 'Close', exact: true }).last().click();
  await expect(page.locator('app-shopping-list-item-row').getByRole('checkbox')).toBeChecked();
  await page.getByRole('button', { name: 'Export', exact: true }).click();
  await expect(
    dialog.getByRole('checkbox', { name: /Woknoedels/, includeHidden: true }),
  ).not.toBeChecked();
  expect(sends).toBe(1);
});

for (const viewport of [
  { width: 1024, height: 768 },
  { width: 390, height: 844 },
]) {
  test(`export follows grocery order and product selection preserves focus and scroll at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await connect(page);
    const cycle = await seed(
      page,
      ['Woknoedels', 'Melk', ...Array.from({ length: 12 }, (_, i) => `List item ${i + 1}`)],
      true,
    );
    const expectedIds = await page.evaluate(async (cycle) => {
      const session = await (await fetch('/api/authentication/session')).json();
      const list = await (await fetch(`/api/shopping-lists/cycle/${cycle}`)).json();
      const itemIds = list.items.map((item: { id: string }) => item.id).reverse();
      const response = await fetch(`/api/shopping-lists/${list.id}/items/order`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-XSRF-TOKEN': session.antiforgeryToken },
        body: JSON.stringify({ plannedMealId: null, itemIds }),
      });
      if (!response.ok) throw new Error(await response.text());
      return [
        ...list.mealGroups.flatMap((group: { items: { id: string }[] }) =>
          group.items.map((item) => item.id),
        ),
        ...itemIds,
      ];
    }, cycle);
    await page.goto('/shopping-list');
    const exportButton = page.getByRole('button', { name: 'Export', exact: true });
    await expect(
      page.locator('app-page-header').getByRole('button', { name: 'Export', exact: true }),
    ).toHaveCount(0);
    await exportButton.scrollIntoViewIfNeeded();
    const summary = page.locator('.app-shopping-aside');
    await expect(summary.getByRole('button', { name: 'Export', exact: true })).toBeVisible();
    await exportButton.click();
    const dialog = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
    await expect(dialog.locator('[data-review-row]')).toHaveCount(expectedIds.length);
    expect(
      await dialog
        .locator('[data-review-row]')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-review-row'))),
    ).toEqual(expectedIds);
    const choice = dialog
      .getByRole('button', { name: 'Choose supermarket product for Woknoedels', exact: true })
      .last();
    await choice.scrollIntoViewIfNeeded();
    const body = dialog.locator('.overflow-y-auto');
    const scrollTop = await body.evaluate((element) => element.scrollTop);
    expect(scrollTop).toBeGreaterThan(0);
    await choice.click();
    const picker = page.getByRole('dialog', { name: 'Product for Woknoedels', exact: true });
    await expect(
      picker.getByRole('searchbox', { name: 'Search products', exact: true }),
    ).toBeFocused();
    await expect(picker.getByText('Other items')).toHaveCount(0);
    await expect(picker.getByText(/on list/)).toHaveCount(0);
    await picker
      .getByRole('button')
      .filter({ has: page.getByText('Picnic Woknoedels', { exact: true }) })
      .click();
    await expect(picker).toBeHidden();
    await expect(
      dialog
        .getByRole('button', { name: 'Change supermarket product for Woknoedels', exact: true })
        .last(),
    ).toBeFocused();
    await expect
      .poll(async () => Math.abs((await body.evaluate((element) => element.scrollTop)) - scrollTop))
      .toBeLessThan(1);
    expect(
      await dialog
        .locator('[data-review-row]')
        .evaluateAll((rows) => rows.map((row) => row.getAttribute('data-review-row'))),
    ).toEqual(expectedIds);
  });
}

test('duplicate groceries retain separate pack amounts and export their sum; closing discards unsent choices', async ({
  page,
}) => {
  await connect(page);
  const cycle = await seed(page, ['Woknoedels', 'Conimex Woknoedels']);
  await page.goto('/shopping-list');
  const exportButton = page.getByRole('button', { name: 'Export', exact: true });
  const dialog = page.getByRole('dialog', { name: 'Export to Picnic', exact: true });
  const configure = async () => {
    await exportButton.click();
    await choose(page, 'Woknoedels', 'Picnic Woknoedels');
    await choose(page, 'Conimex Woknoedels', 'Picnic Woknoedels', 'Woknoedels');
  };
  await configure();
  const quantity = dialog.getByRole('spinbutton', {
    name: 'Woknoedels: Packs to buy',
    exact: true,
  });
  const otherQuantity = dialog.getByRole('spinbutton', {
    name: 'Conimex Woknoedels: Packs to buy',
    exact: true,
  });
  const add = dialog.getByRole('button', { name: /^Add to Picnic(?:\s|$)/ });
  await expect(dialog.getByRole('spinbutton')).toHaveCount(2);
  await expect(quantity).toHaveValue('1');
  await expect(otherQuantity).toHaveValue('1');
  await expect(dialog).not.toContainText('Shared with');
  await dialog
    .getByRole('button', { name: 'Increase Woknoedels: Packs to buy', exact: true })
    .click();
  await expect(quantity).toHaveValue('2');
  await expect(otherQuantity).toHaveValue('1');
  await dialog
    .getByRole('button', { name: 'Decrease Woknoedels: Packs to buy', exact: true })
    .click();
  await expect(quantity).toHaveValue('1');
  for (const invalid of ['', '1.5', '21']) {
    await quantity.fill(invalid);
    await expect(add).toBeDisabled();
    await expect(quantity).toHaveAttribute('aria-invalid', 'true');
  }
  await quantity.fill('4');
  await expect(add).toBeEnabled();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Discard unsaved changes?', exact: true });
  await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: 'Discard changes', exact: true }).click();
  await expect(dialog).toBeHidden();
  await exportButton.click();
  await expect(dialog.getByText('No product selected', { exact: true })).toHaveCount(2);
  await expect(dialog.getByRole('spinbutton')).toHaveCount(0);
  await expect(add).toBeDisabled();
  await dialog.getByRole('button', { name: 'Close', exact: true }).click();
  await configure();
  await dialog
    .getByRole('button', { name: 'Increase Woknoedels: Packs to buy', exact: true })
    .click();
  const response = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/api/supermarkets/cycles/${cycle}/send`),
  );
  await send(page);
  const result = await (await response).json();
  expect(result.lines).toHaveLength(1);
  expect(result.lines[0]).toMatchObject({ productId: 's1001', quantity: 3, outcome: 'Added' });
  expect(result.lines[0].shoppingListItemIds).toHaveLength(2);
  await expect(dialog.getByText('1 product added.', { exact: true })).toBeVisible();
  const list = await (await page.request.get(`/api/shopping-lists/cycle/${cycle}`)).json();
  expect(list.items.every((item: { checked: boolean }) => item.checked)).toBe(true);
});
