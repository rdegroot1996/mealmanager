import { expect, test } from './test';
import type { Page } from '@playwright/test';
import { expectAlignedDialogActions } from './helpers';

async function openUsers(page: Page) {
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('link', { name: 'Settings', exact: true }).click();
  await expect(page).toHaveURL('/settings');
  await expect(page.getByRole('heading', { name: 'Users', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Supermarket integrations' })).toBeVisible();
}

test('an administrator can create, edit, and remove a household user', async ({ page }) => {
  await openUsers(page);

  await page.getByRole('button', { name: 'Add user' }).click();
  await page.getByLabel('Display name').fill('Household Member');
  await page.getByLabel('Email').fill('member@example.test');
  await page.getByLabel('Initial password').fill('Member123!');
  await page.getByRole('button', { name: 'Create user' }).click();
  await expect(page.getByRole('dialog')).toBeHidden();

  let row = page
    .locator('app-users-page')
    .getByRole('listitem')
    .filter({ hasText: 'Household Member' });
  await expect(row).toContainText('Member');
  await row.getByRole('button', { name: 'Edit Household Member' }).click();
  await expectAlignedDialogActions(
    page.getByRole('dialog', { name: 'Edit user', exact: true }),
    'Remove user',
    'Save',
  );
  await page.getByLabel('Display name').fill('Household Administrator');
  await page.getByRole('checkbox', { name: /Administrator/ }).check();
  await page.getByRole('button', { name: 'Save' }).click();

  row = page
    .locator('app-users-page')
    .getByRole('listitem')
    .filter({ hasText: 'Household Administrator' });
  await expect(row).toContainText('Admin');
  await row.getByRole('button', { name: 'Edit Household Administrator', exact: true }).click();
  await page
    .getByRole('dialog', { name: 'Edit user', exact: true })
    .getByRole('button', { name: 'Remove user', exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Remove user?' })
    .getByRole('button', { name: 'Remove user' })
    .click();
  await expect(row).toBeHidden();
});

test('a household member cannot open user management', async ({ page }) => {
  await openUsers(page);
  await page.getByRole('button', { name: 'Add user' }).click();
  await page.getByLabel('Display name').fill('Household Member');
  await page.getByLabel('Email').fill('member@example.test');
  await page.getByLabel('Initial password').fill('Member123!');
  await page.getByRole('button', { name: 'Create user' }).click();

  await page.getByRole('button', { name: 'Open account menu' }).click();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await page.getByLabel('Email').fill('member@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Member123!');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL('/');

  await page.goto('/users');
  await expect(page).toHaveURL('/');
  await page.getByRole('button', { name: 'Open account menu' }).click();
  await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);
});
