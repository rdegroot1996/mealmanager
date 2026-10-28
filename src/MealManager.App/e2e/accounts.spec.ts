import { createMember, member } from './api';
import { administrator, setUpAdministrator, signIn, signOut } from './helpers';
import { expect, test } from './test';

test.describe('first household access', () => {
  test.use({ initializeHousehold: false });

  test('set up a household, sign back in, and change your password', async ({ page }) => {
    await test.step('create the first administrator', async () => {
      await setUpAdministrator(page);
      await expect(page.getByRole('heading', { name: 'Welcome home', exact: true })).toBeVisible();
      await expect(page.locator('app-dashboard-page header')).toContainText(
        administrator.displayName,
      );
    });
    await test.step('sign out and sign back in', async () => {
      await signOut(page);
      await signIn(page);
    });
    await test.step('change the password and use it for the next sign-in', async () => {
      await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
      await page.getByRole('link', { name: 'Change password', exact: true }).click();
      await page.getByLabel('Current password').fill(administrator.password);
      await page.getByLabel('New password').fill('Personal123!');
      await page.getByLabel('Confirm password').fill('Personal123!');
      await page.getByRole('button', { name: 'Change password', exact: true }).click();
      await expect(page).toHaveURL('/');
      await signOut(page);
      await signIn(page, { ...administrator, password: 'Personal123!' });
      await expect(page.getByRole('heading', { name: 'Welcome home', exact: true })).toBeVisible();
    });
  });
});

test('manage a household member while keeping administration restricted', async ({ page }) => {
  await test.step('create and edit a member', async () => {
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
    await page.getByRole('link', { name: 'Settings', exact: true }).click();
    await page.getByRole('button', { name: 'Add user', exact: true }).click();
    await page.getByLabel('Display name').fill(member.displayName);
    await page.getByLabel('Email').fill(member.email);
    await page.getByLabel('Initial password').fill(member.password);
    await page.getByRole('button', { name: 'Create user', exact: true }).click();
    await page.getByRole('button', { name: 'Edit Household Member', exact: true }).click();
    await page.getByLabel('Display name').fill('Updated Member');
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Edit user', exact: true })).toBeHidden();
    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Edit Updated Member', exact: true }),
    ).toBeVisible();
  });
  await test.step('use the member account without administration access', async () => {
    await signOut(page);
    await signIn(page, member);
    await page.goto('/settings');
    await expect(page).toHaveURL('/');
    await page.getByRole('button', { name: 'Open account menu', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
  });
  await test.step('remove the member as administrator', async () => {
    await signOut(page);
    await signIn(page);
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Edit Updated Member', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Edit user', exact: true })
      .getByRole('button', { name: 'Remove user', exact: true })
      .click();
    await page
      .getByRole('dialog', { name: 'Remove user?', exact: true })
      .getByRole('button', { name: 'Remove user', exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Edit Updated Member', exact: true }),
    ).toHaveCount(0);
  });
});

test('recover a member account and replace its temporary password before continuing', async ({
  page,
}) => {
  await createMember(page);
  await test.step('reset the member password', async () => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Edit Household Member', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Edit user', exact: true })
      .getByRole('button', { name: 'Reset password', exact: true })
      .click();
    const reset = page.getByRole('dialog', { name: 'Reset password', exact: true });
    await reset.getByLabel('Temporary password').fill('Temporary123!');
    await reset.getByRole('button', { name: 'Reset password', exact: true }).click();
    await expect(reset).toBeHidden();
    await page
      .getByRole('dialog', { name: 'Edit user', exact: true })
      .getByRole('button', { name: 'Close', exact: true })
      .click();
  });
  await test.step('sign in with restricted temporary access', async () => {
    await signOut(page);
    await signIn(page, { ...member, password: 'Temporary123!' }, '/change-password');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
    await page.goto('/recipes');
    await expect(page).toHaveURL('/change-password');
  });
  await test.step('choose a personal password and regain access', async () => {
    await page.getByLabel('Current password').fill('Temporary123!');
    await page.getByLabel('New password').fill('Personal123!');
    await page.getByLabel('Confirm password').fill('Personal123!');
    await page.getByRole('button', { name: 'Change password', exact: true }).click();
    await expect(page).toHaveURL('/');
    await signOut(page);
    await signIn(page, { ...member, password: 'Personal123!' });
    await expect(page.getByRole('heading', { name: 'Welcome home', exact: true })).toBeVisible();
  });
});
