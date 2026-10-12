import { restartContainer } from './docker';
import {
  dragHandleTo,
  expectAlignedDialogActions,
  expectDialogToClose,
  navigateTo,
} from './helpers';
import { expect, test } from './test';

test.describe.serial('major meal-planning journey', () => {
  test.setTimeout(120_000);

  test('keeps focused ingredient fields above the save bar on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await navigateTo(page, 'Recipes');
    await page.getByRole('button', { name: 'Add recipe', exact: true }).click();
    await page.getByLabel('Recipe name', { exact: true }).fill('Phone draft');
    for (let index = 0; index < 3; index++) {
      await page.getByRole('button', { name: 'Add Ingredient', exact: true }).click();
    }
    await page.locator('#ingredient-quantity-2').focus();
    const field = await page.locator('#ingredient-quantity-2').boundingBox();
    const saveBar = await page.locator('app-edit-recipe-page .sticky').boundingBox();
    expect(field).not.toBeNull();
    expect(saveBar).not.toBeNull();
    expect(field!.y).toBeGreaterThanOrEqual(0);
    expect(field!.y + field!.height).toBeLessThanOrEqual(saveBar!.y);
    await expect(page.getByLabel('Recipe name', { exact: true })).toHaveValue('Phone draft');
    await expect(page).toHaveURL('/recipes/new');
  });

  test('manages recipes, planning, groceries, and historical cycles through the production UI', async ({
    page,
  }) => {
    page.setDefaultTimeout(10_000);
    let dialog = page.locator('dialog[open]');
    let recipePath = '';

    await test.step('create and enrich a recipe', async () => {
      await expect(page.getByRole('heading', { name: 'Active Planning' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Household favorites' })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible();
      await expect(page.getByTestId('upcoming-day-preview')).toHaveCount(7);
      await page.getByRole('link', { name: 'All recipes' }).click();
      await expect(page).toHaveURL('/recipes');

      await page.getByRole('button', { name: 'Add recipe' }).click();
      await expect(page).toHaveURL('/recipes/new');
      await page.getByLabel('Recipe name').fill('E2E Pasta');
      await expect(page).toHaveURL('/recipes/new');
      await expect(page.getByLabel('Recipe name')).toHaveValue('E2E Pasta');
      await page.getByRole('spinbutton', { name: 'Base servings', exact: true }).fill('2');
      await page.getByText('Base servings', { exact: true }).click();
      await expect(
        page.getByRole('spinbutton', { name: 'Base servings', exact: true }),
      ).toBeFocused();
      await expect(
        page.getByRole('spinbutton', { name: 'Base servings', exact: true }),
      ).toHaveValue('2');
      await page.getByLabel('Category').selectOption('Meals');
      await page.getByLabel('Search or add a tag').fill('Quick');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByLabel('Search or add a tag').fill('Italian');
      await page.getByRole('button', { name: 'Add', exact: true }).click();
      await page.getByRole('button', { name: 'Add Ingredient' }).click();
      await page.getByLabel('Ingredient name').fill('Pasta');
      await page.getByRole('textbox', { name: 'Quantity', exact: true }).fill('2');
      await page.getByRole('button', { name: 'Add Ingredient' }).click();
      await page.getByLabel('Ingredient name').nth(1).fill('Salt');
      await dragHandleTo(
        page,
        page.getByRole('button', { name: /Reorder Salt/ }),
        page.getByLabel('Ingredient name').first(),
      );
      await expect(page.getByLabel('Ingredient name').first()).toHaveValue('Salt');
      await page.getByRole('button', { name: 'Add Step' }).click();
      await page.locator('#step-description-0').fill('Boil the pasta.');
      await page.getByRole('button', { name: 'Add Step' }).click();
      await page.locator('#step-description-1').fill('Serve the pasta.');
      const stepHandle = page.getByRole('button', {
        name: 'Reorder step 2. Use arrow keys or drag.',
        exact: true,
      });
      await stepHandle.focus();
      await page.keyboard.press('ArrowUp');
      await expect(page.locator('#step-description-0')).toHaveValue('Serve the pasta.');
      await expect(
        page.getByRole('button', { name: 'Reorder step 1. Use arrow keys or drag.', exact: true }),
      ).toBeFocused();
      await page.keyboard.press('ArrowDown');
      await expect(page.locator('#step-description-0')).toHaveValue('Boil the pasta.');
      await page.getByRole('button', { name: 'Remove step 1', exact: true }).click();
      await expect(page.locator('#step-description-0')).toHaveValue('Serve the pasta.');
      await page.getByRole('button', { name: 'Add Step', exact: true }).click();
      await page.locator('#step-description-1').fill('Boil the pasta.');
      await page.locator('app-page-header').getByRole('button', { name: 'Save' }).click();

      await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]+\/edit$/);
      recipePath = new URL(page.url()).pathname.replace(/\/edit$/, '');
      await expect(page.getByLabel('Recipe name')).toHaveValue('E2E Pasta');
      await expect(page.getByText('Quick')).toBeVisible();
      await expect(page.getByText('Italian')).toBeVisible();

      await expect(page.getByRole('button', { name: 'Add image' })).toBeVisible();
      await page.locator('input[type="file"]').setInputFiles({
        name: 'pasta.gif',
        mimeType: 'image/gif',
        buffer: Buffer.from('R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==', 'base64'),
      });
      await expect(page.getByAltText('E2E Pasta photo 1')).toBeVisible();
      await page.locator('app-page-header').getByRole('button', { name: 'Save' }).click();
      await expect(page).toHaveURL(recipePath);

      await restartContainer();
      await page.reload();
      const recipeImage = page.getByAltText('E2E Pasta');
      await expect(recipeImage).toBeVisible();
      await expect
        .poll(() => recipeImage.evaluate((image) => (image as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      await expect(page).toHaveURL(recipePath);
      const ingredients = page.getByRole('heading', { name: 'Ingredients' }).locator('..');
      await expect(ingredients.getByRole('row').first()).toContainText('Salt');
      await expect(ingredients.getByRole('row').nth(1)).toContainText('Pasta');
      await expect(
        page.getByRole('region', { name: 'Steps', exact: true }).locator('p'),
      ).toHaveText(['Serve the pasta.', 'Boil the pasta.']);
    });

    await test.step('configure reusable recipe profiles', async () => {
      await page.getByRole('button', { name: 'Add Profile' }).click();
      dialog = page.locator('dialog[open]');
      await dialog.getByLabel('Profile Name').fill('Family');
      await dialog.getByRole('spinbutton', { name: 'Servings', exact: true }).fill('4');
      await dialog.getByRole('button', { name: 'Add', exact: true }).click();
      await expectDialogToClose(page);

      await page.getByRole('button', { name: 'More profile actions', exact: true }).click();
      await page.getByRole('button', { name: 'Edit Profile' }).click();
      dialog = page.locator('dialog[open]');
      await dialog.getByLabel('Profile Name').fill('Family meal');
      await dialog.getByRole('spinbutton', { name: 'Servings', exact: true }).fill('5');
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expectDialogToClose(page);

      await page.getByRole('button', { name: 'Add Profile', exact: true }).click();
      await page.locator('dialog[open]').getByLabel('Profile Name').fill('Temporary');
      await page.locator('dialog[open]').getByRole('button', { name: 'Add', exact: true }).click();
      await expectDialogToClose(page);
      await page.getByRole('button', { name: 'More profile actions', exact: true }).click();
      await page.getByRole('button', { name: 'Edit Profile', exact: true }).click();
      await expect(
        page.locator('dialog[open]').getByRole('button', { name: 'Remove profile', exact: true }),
      ).toHaveCount(0);
      await page
        .locator('dialog[open]')
        .getByRole('button', { name: 'Close', exact: true })
        .click();
      await page.getByRole('button', { name: 'More profile actions', exact: true }).click();
      const profileActions = page.getByRole('dialog', {
        name: 'More profile actions',
        exact: true,
      });
      await expect(
        profileActions.getByRole('button', { name: 'Remove profile', exact: true }),
      ).toBeVisible();
      await profileActions.getByRole('button', { name: 'Remove profile', exact: true }).click();
      const removeProfile = page.getByRole('dialog', { name: 'Remove profile?', exact: true });
      await expect(profileActions).toBeHidden();
      await removeProfile.getByRole('button', { name: 'Remove profile', exact: true }).click();
      await expectDialogToClose(page);
      await expect(
        page.getByRole('combobox', { name: 'Profile', exact: true }).locator('option'),
      ).toHaveCount(2);
      await page
        .getByRole('combobox', { name: 'Profile', exact: true })
        .selectOption({ label: 'Family meal (5 servings)' });

      await page.getByRole('button', { name: 'Edit' }).click();
      dialog = page.locator('dialog[open]');
      await expect(dialog.getByText('This profile has no grocery products yet.')).toBeVisible();
      await dialog.getByRole('button', { name: 'Add item to Needed' }).click();
      const addItem = page.getByRole('dialog', { name: 'Add grocery item', exact: true });
      await addItem.getByRole('textbox', { name: 'Item name', exact: true }).fill('Pasta sauce');
      await addItem.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('2');
      await addItem.getByRole('button', { name: 'Add', exact: true }).click();
      await dialog.getByRole('button', { name: 'Save', exact: true }).click();
      await expectDialogToClose(page);
      await expect(
        page
          .getByRole('region', { name: 'Groceries', exact: true })
          .getByText('Pasta sauce', { exact: true }),
      ).toBeVisible();

      await page.getByRole('button', { name: 'Add to favorites' }).click();
      await expect(page.getByRole('button', { name: 'Remove from favorites' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );

      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Household favorites' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open recipe E2E Pasta' })).toBeVisible();
      await page.reload();
      await expect(page.getByRole('link', { name: 'Open recipe E2E Pasta' })).toBeVisible();
    });

    await test.step('plan meals and commit their groceries', async () => {
      await navigateTo(page, 'Planning');
      await expect(page.getByText('No planning cycle yet')).toBeVisible();
      await page.getByRole('button', { name: 'Start first cycle' }).click();
      dialog = page.locator('dialog[open]');
      await dialog.getByLabel('Start date').fill('2099-08-20');
      await dialog.getByRole('spinbutton', { name: 'Planning days', exact: true }).fill('0');
      await dialog.getByRole('button', { name: 'Start cycle' }).click();
      await expect(dialog.getByRole('alert')).toContainText(
        'Planning days must be a positive whole number.',
      );
      await dialog.getByRole('spinbutton', { name: 'Planning days', exact: true }).fill('3');
      await dialog.getByRole('button', { name: 'Start cycle' }).click();
      await expectDialogToClose(page);
      const addMealButtons = page.getByRole('button', { name: 'Add meal', exact: true });
      await expect(addMealButtons).toHaveCount(3);

      await page.getByRole('button', { name: 'Edit range' }).click();
      dialog = page.locator('dialog[open]');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('button', { name: 'Save' }).click();
      await expectDialogToClose(page);

      await page.goto(recipePath);
      await page.getByRole('button', { name: 'Add to Planner' }).click();
      dialog = page.locator('dialog[open]');
      await dialog.getByLabel('Day').selectOption('2099-08-20');
      await dialog.getByRole('button', { name: 'Add to Planner' }).click();
      await expectDialogToClose(page);

      await navigateTo(page, 'Planning');
      await expect(
        page.getByRole('link', { name: 'View recipe E2E Pasta', exact: true }),
      ).toBeVisible();
      await addMealButtons.first().click();
      dialog = page.locator('dialog[open]');
      await dialog.getByRole('button', { name: 'E2E Pasta' }).click();
      await dialog.getByRole('button', { name: 'Add Meal', exact: true }).click();
      await expectDialogToClose(page);

      await page.getByRole('button', { name: 'Add note', exact: true }).first().click();
      dialog = page.locator('dialog[open]');
      await dialog.getByPlaceholder('Enter your note...').fill('Family dinner');
      await dialog.getByRole('button', { name: 'Add Note' }).click();
      await expectDialogToClose(page);
      await expect(page.getByText('Family dinner')).toBeVisible();

      await page.getByRole('button', { name: 'Add groceries for E2E Pasta' }).last().click();
      dialog = page.locator('dialog[open]');
      await expect(dialog.getByText('This profile has no grocery products.')).toBeVisible();
      await expect(dialog.getByRole('link', { name: 'Edit this recipe profile' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Add meal groceries to cart' }).click();
      await expectDialogToClose(page);

      await page
        .locator('app-planning-meal-row')
        .filter({ has: page.getByTestId('meal-status') })
        .getByRole('button', { name: 'More actions for E2E Pasta' })
        .last()
        .click();
      await page.getByRole('button', { name: 'Change profile' }).click();
      dialog = page.getByRole('dialog', { name: 'Change Profile', exact: true });
      await dialog.getByLabel('Profile').selectOption({ label: 'Family meal (5 servings)' });
      await dialog.getByRole('button', { name: 'Change Profile', exact: true }).click();
      await expectDialogToClose(page);

      await navigateTo(page, 'Groceries');
      await expect(
        page.getByRole('status').filter({ hasText: 'planned meals have not been added' }),
      ).toBeVisible({
        timeout: 15_000,
      });
      await navigateTo(page, 'Planning');
      await page.getByRole('button', { name: 'Add groceries for E2E Pasta' }).last().click();
      dialog = page.locator('dialog[open]');
      await dialog.getByLabel('Select Pasta sauce').uncheck();
      await dialog.getByRole('button', { name: 'Add meal groceries to cart' }).click();
      await expectDialogToClose(page);
      await page.reload();
      await page.getByRole('button', { name: 'Edit groceries for E2E Pasta' }).last().click();
      dialog = page.locator('dialog[open]');
      await expect(dialog.getByLabel('Select Pasta sauce')).not.toBeChecked();
      await dialog.getByLabel('Select Pasta sauce').check();
      await dialog.getByRole('button', { name: 'Edit Pasta sauce' }).click();
      const editItem = page.getByRole('dialog', { name: 'Edit grocery item', exact: true });
      await expect(
        editItem.getByRole('textbox', { name: 'Item name', exact: true }),
      ).not.toBeFocused();
      await expect(editItem.locator('[tabindex="-1"]')).toBeFocused();
      await expectAlignedDialogActions(editItem, 'Remove item');
      await editItem.getByRole('textbox', { name: 'Item name', exact: true }).fill('Tomato sauce');
      await editItem.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('3');
      await editItem.getByRole('button', { name: 'Save', exact: true }).click();
      await dialog.getByRole('button', { name: 'Add item to Needed', exact: true }).click();
      const addItem = page.getByRole('dialog', { name: 'Add grocery item', exact: true });
      await expect(addItem.getByRole('textbox', { name: 'Item name', exact: true })).toBeFocused();
      await addItem.getByRole('textbox', { name: 'Item name', exact: true }).fill('Basil');
      await addItem.getByRole('button', { name: 'Add', exact: true }).click();
      await dragHandleTo(
        page,
        dialog.getByRole('button', { name: 'Reorder Basil', exact: true }),
        dialog.getByRole('button', { name: 'Reorder Tomato sauce', exact: true }),
      );
      await expect(dialog.getByRole('checkbox', { name: /^Select / }).first()).toHaveAccessibleName(
        'Select Basil',
      );
      await dialog.getByRole('button', { name: 'Add meal groceries to cart' }).click();
      await expectDialogToClose(page);

      await page
        .locator('app-planning-meal-row')
        .filter({ has: page.getByTestId('meal-status') })
        .getByRole('button', { name: 'More actions for E2E Pasta' })
        .last()
        .click();
      await page.getByRole('button', { name: 'Plan leftovers' }).click();
      dialog = page.getByRole('dialog', { name: 'Plan Leftovers', exact: true });
      await dialog.getByLabel('Day').selectOption('2099-08-21');
      await dialog.getByRole('button', { name: 'Plan Leftovers', exact: true }).click();
      await expectDialogToClose(page);
      const leftoverDay = page.getByRole('region', { name: /Friday 21 Aug/ });
      await expect(leftoverDay.getByText('Leftovers from Thursday', { exact: true })).toBeVisible();
      await expect(leftoverDay.getByRole('button', { name: /groceries for/ })).toHaveCount(0);

      await page.reload();
      await page.getByRole('button', { name: 'Edit groceries for E2E Pasta' }).last().click();
      dialog = page.locator('dialog[open]');
      await expect(dialog.getByLabel('Select Tomato sauce')).toBeChecked();
      await expect(dialog.getByRole('checkbox', { name: /^Select / }).first()).toHaveAccessibleName(
        'Select Basil',
      );
      await expect(dialog.getByRole('button', { name: 'Edit Tomato sauce' })).toBeVisible();
      await dialog.getByRole('button', { name: 'Close' }).click();
      await expectDialogToClose(page);

      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Coming up' })).toBeVisible();
      await expect(page.getByTestId('upcoming-calendar')).toBeVisible();
      await expect(page.getByRole('link', { name: 'Open recipe E2E Pasta' }).first()).toBeVisible();
    });

    await test.step('shop and finish a historical cycle', async () => {
      await navigateTo(page, 'Groceries');
      await expect(page.getByRole('checkbox', { name: 'Tomato sauce', exact: true })).toBeVisible();
      const mealGrocery = page.getByRole('checkbox', { name: 'Tomato sauce', exact: true });
      await expect(
        page
          .locator('app-grocery-item-row')
          .filter({ has: mealGrocery })
          .getByText('3×', { exact: true }),
      ).toBeVisible();
      await mealGrocery.check();
      await expect(mealGrocery).toBeChecked();
      await page.getByRole('button', { name: 'Add item', exact: true }).click();
      const newItem = page.getByRole('dialog', { name: 'Add grocery item', exact: true });
      await newItem.getByLabel('Item name').fill('Coffee');
      await newItem.getByRole('spinbutton', { name: 'Quantity', exact: true }).fill('2');
      await newItem.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(page.getByRole('checkbox', { name: 'Coffee', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Edit Coffee', exact: true }).click();
      await page.getByRole('button', { name: 'Remove item' }).click();
      await expect(page.getByRole('checkbox', { name: 'Coffee', exact: true })).toHaveCount(0);

      await navigateTo(page, 'Planning');
      await page.getByRole('button', { name: 'Start new cycle' }).click();
      dialog = page.locator('dialog[open]');
      await dialog.getByLabel('Start date').fill('2099-08-22');
      await dialog.getByRole('spinbutton', { name: 'Planning days', exact: true }).fill('1');
      await dialog.getByRole('button', { name: 'Start cycle' }).click();
      await expectDialogToClose(page);
      await page.getByRole('button', { name: 'Previous cycle', exact: true }).click();
      await expect(page.getByText('Historical planning is read-only.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Add meal', exact: true })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /groceries for/ })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Edit range', exact: true })).toHaveCount(0);
      await expect(page.getByTestId('meal-status').filter({ hasText: /Reviewed/ })).toHaveCount(1);
      await expect(page.getByTestId('meal-status').filter({ hasText: /Not reviewed/ })).toHaveCount(
        1,
      );

      await navigateTo(page, 'Groceries');
      await expect(page.getByRole('checkbox', { name: 'Tomato sauce', exact: true })).toBeVisible();
      await page.getByRole('button', { name: 'Add item', exact: true }).click();
      await newItem.getByLabel('Item name').fill('Historical coffee');
      await newItem.getByRole('button', { name: 'Add', exact: true }).click();
      await expect(
        page.getByRole('checkbox', { name: 'Historical coffee', exact: true }),
      ).toBeVisible();

      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Active Planning' })).toBeVisible();
      await navigateTo(page, 'Planning');
      await expect(page.getByText('Historical planning is read-only.')).toBeVisible();

      await page.goto(recipePath);
      await page.getByRole('button', { name: 'Add to Planner' }).click();
      dialog = page.locator('dialog[open]');
      await dialog.getByLabel('Day').selectOption('2099-08-22');
      await expect(dialog.getByLabel('Day').locator('option[value="2099-08-20"]')).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Add to Planner' }).click();
      await expectDialogToClose(page);
      await navigateTo(page, 'Planning');
      await expect(page.getByText('Historical planning is read-only.')).toBeVisible();
      await page.getByRole('button', { name: 'Next cycle', exact: true }).click();
      await expect(page.getByText('Historical planning is read-only.')).toBeHidden();
      await expect(
        page.getByRole('link', { name: 'View recipe E2E Pasta', exact: true }),
      ).toBeVisible();
    });
  });
});
