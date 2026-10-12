import { ApiRecipeProfileSummary, ApiRecipeSummary } from './api-recipe-summary';

export interface ApiPlanningEntry {
  id: string;
  kind: 'Meal' | 'Leftover';
  originalMealId: string | null;
  date: string;
  sortOrder: number;
  recipe: ApiRecipeSummary;
  recipeProfile: ApiRecipeProfileSummary;
  hasGroceriesAdded: boolean;
}

export interface ApiPlanningNote {
  id: string;
  date: string;
  text: string;
}

export interface ApiPlanning {
  id: string;
  planningCycleId: string;
  entries: ApiPlanningEntry[];
  notes: ApiPlanningNote[];
}
