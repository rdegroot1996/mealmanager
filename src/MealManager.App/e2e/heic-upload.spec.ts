import { resolve } from 'node:path';
import { devices } from '@playwright/test';
import { expect, test } from './test';

test.use({ ...devices['Pixel 7'] });

test('uploads an HEIC recipe photo and serves the normalized JPEG', async ({ page }) => {
  await page.getByRole('link', { name: 'All recipes' }).click();
  await page.getByRole('button', { name: 'Add recipe' }).click();
  await page.getByLabel('Recipe name').fill('HEIC recipe');
  await page.getByRole('spinbutton', { name: 'Base servings', exact: true }).fill('2');
  await page.getByLabel('Category').selectOption('Meals');
  await page.getByRole('button', { name: 'Add ingredient' }).click();
  await page.getByLabel('Ingredient name').fill('Ingredient');
  await page.getByLabel('Quantity').fill('1');
  await page.getByRole('button', { name: 'Add step' }).click();
  await page.locator('#step-description-0').fill('Prepare the meal.');
  await expect(page.getByRole('button', { name: 'Add image' })).toBeDisabled();
  await expect(page.getByText('Save the recipe first, then add photos.')).toBeVisible();
  await page.locator('app-page-header').getByRole('button', { name: 'Save' }).click();

  await expect(page).toHaveURL(/\/recipes\/[0-9a-f-]+\/edit(?:\?new=1)?$/);
  await expect(page.getByRole('button', { name: 'Add image' })).toBeEnabled();

  const uploadResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      /\/api\/recipes\/[0-9a-f-]+\/images$/.test(response.url()),
  );
  await page
    .locator('input[type="file"]')
    .setInputFiles(
      resolve(process.cwd(), '../../tests/MealManager.Tests.Integration/Fixtures/image4.heic'),
    );
  expect((await uploadResponse).status()).toBe(201);

  const uploadedImage = page.getByAltText('HEIC recipe photo 1');
  await expect(uploadedImage).toBeVisible();
  await expect
    .poll(() => uploadedImage.evaluate((image) => (image as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  const imageUrl = await uploadedImage.getAttribute('src');
  expect(imageUrl).not.toBeNull();
  const imageResponse = await page.request.get(imageUrl!);
  expect(imageResponse.ok()).toBe(true);
  expect(imageResponse.headers()['content-type']).toContain('image/jpeg');
});
