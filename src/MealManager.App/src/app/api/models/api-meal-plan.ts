import { ApiRecipeProfileSummary, ApiRecipeSummary } from './api-recipe-summary';

export interface ApiPlannedEntry {
  id: string;
  kind: 'Meal' | 'Leftover';
  originalMealId: string | null;
  date: string;
  sortOrder: number;
  recipe: ApiRecipeSummary;
  recipeProfile: ApiRecipeProfileSummary;
  hasReviewedGroceries: boolean;
}

export interface ApiPlanningDayNote {
  id: string;
  date: string;
  text: string;
}

export interface ApiMealPlan {
  id: string;
  planningCycleId: string;
  entries: ApiPlannedEntry[];
  notes: ApiPlanningDayNote[];
}
