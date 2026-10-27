import { expect, type Page } from '@playwright/test';
import { DateTime } from 'luxon';
import type { ApiMealPlan, ApiPlannedEntry } from '../src/app/api/models/api-meal-plan';
import type { ApiPlanningCycle } from '../src/app/api/models/api-planning-cycle';
import type { ApiRecipe } from '../src/app/api/models/api-recipe';
import type { ApiUser } from '../src/app/api/models/api-user';

export async function mutate<T = void>(
  page: Page,
  path: string,
  data: unknown,
  method = 'POST',
): Promise<T> {
  const session = await (await page.request.get('/api/authentication/session')).json();
  const response = await page.request.fetch(path, {
    method,
    headers: { 'X-XSRF-TOKEN': session.antiforgeryToken },
    data,
  });
  expect(response.ok(), `${method} ${path}: ${await response.text()}`).toBe(true);
  return (response.status() === 204 ? undefined : await response.json()) as T;
}

export function date(offset = 0) {
  return DateTime.local().startOf('day').plus({ days: offset }).toISODate()!;
}

export function createCycle(page: Page, offset = 0, days = 7) {
  return mutate<ApiPlanningCycle>(page, '/api/planning-cycles', {
    startDate: date(offset),
    endDate: date(offset + days - 1),
  });
}

export function createRecipe(page: Page, name = 'Tomato pasta') {
  return mutate<ApiRecipe>(page, '/api/recipes', {
    name,
    category: 'Meals',
    baseServings: 2,
    tags: ['Quick'],
    ingredients: [{ name: 'Pasta', quantity: 200, unit: 'g', order: 0 }],
    steps: [{ description: 'Boil and serve.', order: 0 }],
  });
}

export async function planMeal(
  page: Page,
  cycle: ApiPlanningCycle,
  recipe: ApiRecipe,
  mealDate = cycle.startDate,
  profileId = recipe.profiles[0].id,
) {
  const plan: ApiMealPlan = await (
    await page.request.get(`/api/meal-plans/cycle/${cycle.id}`)
  ).json();
  return mutate<ApiPlannedEntry>(page, '/api/planned-meals', {
    mealPlanId: plan.id,
    recipeId: recipe.id,
    recipeProfileId: profileId,
    date: mealDate,
  });
}

export const member = {
  displayName: 'Household Member',
  email: 'member@example.test',
  password: 'Member123!',
  isAdmin: false,
};

export function createMember(page: Page) {
  return mutate<ApiUser>(page, '/api/users', member);
}
