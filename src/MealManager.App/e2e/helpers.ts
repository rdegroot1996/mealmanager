import { expect, type Locator, type Page } from '@playwright/test';

export const administrator = {
  displayName: 'E2E Administrator',
  email: 'e2e-admin@example.test',
  password: 'Playwright123!',
};

export async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(administrator.email);
  await page.getByLabel('Password', { exact: true }).fill(administrator.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');
}

export async function setUpAdministrator(page: Page) {
  await page.goto('/');
  await expect(page).toHaveURL('/setup');
  await expect(page.getByRole('heading', { name: 'MealManager' })).toBeVisible();
  await page.getByLabel('Display name').fill(administrator.displayName);
  await page.getByLabel('Email').fill(administrator.email);
  await page.getByLabel('Password', { exact: true }).fill(administrator.password);
  await page.getByLabel('Confirm password').fill(administrator.password);
  await page.getByRole('button', { name: 'Create administrator' }).click();
  await expect(page).toHaveURL('/');
}

export async function navigateTo(
  page: Page,
  destination: 'Dashboard' | 'Recipes' | 'Planner' | 'Shopping list',
) {
  const desktopNavigation = page.locator('aside nav[aria-label="Main navigation"]');
  const navigation = (await desktopNavigation.isVisible())
    ? desktopNavigation
    : page.locator('nav.app-bottom-nav[aria-label="Main navigation"]');
  const routes = {
    Dashboard: '/',
    Recipes: '/recipes',
    Planner: '/planner',
    'Shopping list': '/shopping-list',
  } as const;
  await Promise.all([
    page.waitForURL(routes[destination]),
    navigation.getByRole('link', { name: new RegExp(`${destination}$`) }).click(),
  ]);
}

export async function expectDialogToClose(page: Page) {
  await expect(page.locator('dialog[open]')).toHaveCount(0);
}

export async function expectAlignedDialogActions(
  dialog: Locator,
  removeLabel: string,
  saveLabel = 'Save',
) {
  const remove = dialog.getByRole('button', { name: removeLabel, exact: true });
  const save = dialog.getByRole('button', { name: saveLabel, exact: true });
  await expect(remove).toBeVisible();
  await expect(save).toBeVisible();
  await expect
    .poll(
      async () => {
        const [removeBounds, saveBounds] = await Promise.all([
          remove.boundingBox(),
          save.boundingBox(),
        ]);
        if (!removeBounds || !saveBounds) return Infinity;
        return Math.max(
          Math.abs(removeBounds.x - saveBounds.x),
          Math.abs(removeBounds.width - saveBounds.width),
          Math.abs(removeBounds.height - saveBounds.height),
        );
      },
      { message: 'Remove and Save should share full-width alignment and height' },
    )
    .toBeLessThan(1);
}

export async function dragHandleTo(page: Page, handle: Locator, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  await handle.scrollIntoViewIfNeeded();
  const source = await handle.boundingBox();
  const destination = await target.boundingBox();
  expect(source).not.toBeNull();
  expect(destination).not.toBeNull();
  const x = source!.x + source!.width / 2;
  const y = source!.y + source!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  try {
    await page.mouse.move(x, y + 10, { steps: 5 });
    await expect(page.locator('.cdk-drag-preview')).toBeVisible();
    await page.mouse.move(
      destination!.x + destination!.width / 2,
      destination!.y + destination!.height / 2,
      { steps: 20 },
    );
  } finally {
    await page.mouse.up();
  }
  await expect(page.locator('.cdk-drag-preview')).toBeHidden();
}
