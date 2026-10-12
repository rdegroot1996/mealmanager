import { DateTime } from 'luxon';
import { plannings } from './plannings';
import { ACTIVE_CYCLE_ID, createPlanningCycles } from './planning-cycles';
import { recipes } from './recipes';

describe('mock data relationships', () => {
  it('uses globally unique recipe-profile identifiers', () => {
    const profileIds = recipes.flatMap((recipe) => recipe.profiles.map((profile) => profile.id));

    expect(new Set(profileIds).size).toBe(profileIds.length);
  });

  it('links every planned meal to a profile owned by its recipe', () => {
    for (const planning of Object.values(plannings)) {
      for (const meal of planning.meals) {
        const recipe = recipes.find((item) => item.id === meal.recipe.id);

        expect(recipe?.profiles.some((profile) => profile.id === meal.recipeProfile.id)).toBe(true);
      }

      for (const leftover of planning.leftovers) {
        expect(planning.meals.some((meal) => meal.id === leftover.originalMealId)).toBe(true);
      }
    }
  });

  it('starts the active planning cycle yesterday and keeps it seven days long', () => {
    const cycles = createPlanningCycles(DateTime.fromISO('2026-09-06T12:00:00'));
    const activeCycle = cycles.find((cycle) => cycle.id === ACTIVE_CYCLE_ID)!;

    expect(activeCycle.startDate).toBe('2026-09-05');
    expect(activeCycle.endDate).toBe('2026-09-11');
  });

  it('uses globally unique identifiers for recipe rows and profile products', () => {
    const groups = [
      recipes.flatMap((recipe) => recipe.ingredients),
      recipes.flatMap((recipe) => recipe.steps),
      recipes.flatMap((recipe) => recipe.profiles.flatMap((profile) => profile.products)),
    ];
    for (const rows of groups) expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length);
  });
});
