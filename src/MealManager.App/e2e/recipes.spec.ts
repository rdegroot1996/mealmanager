import { resolve } from 'node:path';
import type { ApiRecipeProfile } from '../src/app/api/models/api-recipe';
import { createRecipe, mutate } from './api';
import { navigateTo } from './helpers';
import { expect, test } from './test';

test('create and edit a recipe with a photo and a reusable profile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await test.step('write a recipe and upload a phone photo', async () => {
    await navigateTo(page, 'Recipes');
    await page.getByRole('button', { name: 'Add recipe', exact: true }).click();
    await page.getByLabel('Recipe name', { exact: true }).fill('Family pasta');
    await page.getByLabel('Base servings', { exact: true }).fill('2');
    await page.getByLabel('Category', { exact: true }).selectOption('Meals');
    await page.getByLabel('Notes', { exact: true }).fill('Family recipe');
    await page.getByRole('button', { name: 'Add ingredient', exact: true }).click();
    await page.getByLabel('Ingredient name', { exact: true }).fill('Pasta');
    await page.getByRole('textbox', { name: 'Quantity', exact: true }).fill('200');
    await page.getByRole('button', { name: 'Add step', exact: true }).click();
    await page.locator('#step-description-0').fill('Boil and serve.');
    await page
      .locator('app-page-header')
      .getByRole('button', { name: 'Save', exact: true })
      .click();
    await expect(page.getByRole('button', { name: 'Add image', exact: true })).toBeEnabled();
    await page
      .locator('input[type="file"]')
      .setInputFiles(
        resolve(process.cwd(), '../../tests/MealManager.Tests.Integration/Fixtures/image4.heic'),
      );
    const photo = page.getByAltText('Family pasta photo 1');
    await expect(photo).toBeVisible();
    await expect
      .poll(() => photo.evaluate((image) => (image as HTMLImageElement).naturalWidth))
      .toBeGreaterThan(0);
    await page
      .locator('app-page-header')
      .getByRole('button', { name: 'Save', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Family pasta', exact: true })).toBeVisible();
  });
  await test.step('save a reusable family profile', async () => {
    await page.getByRole('button', { name: 'More profile actions', exact: true }).click();
    await page.getByRole('button', { name: 'Add profile', exact: true }).click();
    const profile = page.getByRole('dialog', { name: 'Add profile', exact: true });
    await profile.getByLabel('Profile name').fill('Family');
    await profile.getByLabel('Servings', { exact: true }).fill('4');
    await profile
      .getByRole('button', { name: 'Start with recipe ingredients', exact: true })
      .click();
    await profile.getByRole('button', { name: 'Add', exact: true }).click();
    await expect(profile).toBeHidden();
    await expect(page.getByRole('region', { name: 'Groceries', exact: true })).toContainText(
      'Pasta',
    );
  });
  await test.step('edit, reload, and find the recipe in household favorites', async () => {
    await page.getByRole('button', { name: 'More recipe actions', exact: true }).click();
    await page.getByRole('link', { name: 'Edit recipe', exact: true }).click();
    await page.getByLabel('Notes', { exact: true }).fill('Serve with basil.');
    await page
      .locator('app-page-header')
      .getByRole('button', { name: 'Save', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Family pasta', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByText('Serve with basil.', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('combobox', { name: 'Profile', exact: true }).locator('option'),
    ).toContainText(['Default', 'Family']);
    await expect
      .poll(() =>
        page
          .getByAltText('Family pasta', { exact: true })
          .evaluate((image) => (image as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    await page.getByRole('button', { name: 'Add Family pasta to favorites', exact: true }).click();
    await navigateTo(page, 'Dashboard');
    await expect(
      page.getByRole('link', { name: 'Open recipe Family pasta', exact: true }),
    ).toBeVisible();
  });
});

test('find a recipe, start planning, and cook with its selected profile', async ({ page }) => {
  const recipe = await createRecipe(page);
  await createRecipe(page, 'Vegetable soup');
  const family = await mutate<ApiRecipeProfile>(page, '/api/recipe-profiles', {
    recipeId: recipe.id,
    name: 'Family',
    servings: 4,
  });
  await test.step('find the recipe and select a profile', async () => {
    await navigateTo(page, 'Recipes');
    await page.getByRole('button', { name: /^Filters/ }).click();
    await page.getByRole('dialog').getByLabel('Category', { exact: true }).selectOption('Meals');
    await page.getByRole('button', { name: 'Apply', exact: true }).click();
    await page.getByRole('searchbox', { name: 'Search recipes', exact: true }).fill('tOMATO');
    await page.getByRole('link', { name: /^Tomato pasta\b/ }).click();
    await page.getByRole('combobox', { name: 'Profile', exact: true }).selectOption(family.id);
  });
  await test.step('start the first cycle and explicitly confirm the meal', async () => {
    await page.getByRole('button', { name: 'Add to planner', exact: true }).click();
    const planning = page.getByRole('dialog', { name: 'Add to planner', exact: true });
    await planning.getByRole('button', { name: 'Start first cycle', exact: true }).click();
    await page
      .getByRole('dialog', { name: 'Start new cycle', exact: true })
      .getByRole('button', { name: 'Start cycle', exact: true })
      .click();
    await expect(planning.getByLabel('Day')).toBeVisible();
    const cycle = await (await page.request.get('/api/planning-cycles/current')).json();
    expect(
      (await (await page.request.get(`/api/meal-plans/cycle/${cycle.id}`)).json()).entries,
    ).toHaveLength(0);
    await planning.getByRole('button', { name: 'Add to planner', exact: true }).click();
    await expect(planning).toBeHidden();
  });
  await test.step('open the planned recipe, cook, and return to the plan', async () => {
    await navigateTo(page, 'Planner');
    await page.getByRole('link', { name: 'View recipe Tomato pasta', exact: true }).click();
    await expect(page.getByRole('combobox', { name: 'Profile', exact: true })).toHaveValue(
      family.id,
    );
    await page.getByRole('button', { name: 'Cooking mode', exact: true }).click();
    await expect(page.getByTestId('cooking-view')).toContainText('400');
    await expect(page.getByTestId('cooking-view')).toContainText('Boil and serve.');
    await page.getByRole('button', { name: 'Back to recipe', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Cooking mode', exact: true })).toBeFocused();
    await page.getByRole('link', { name: 'Back to planner', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'View recipe Tomato pasta', exact: true }),
    ).toBeVisible();
  });
});
