import { ApiRecipeIngredient } from './api-recipe';
import { ApiRecipeProfileSummary, ApiRecipeSummary } from './api-recipe-summary';

export type RecipeSearchSort =
  | 'Name'
  | 'LeastPlanned'
  | 'MostPlanned'
  | 'LeastRecentlyPlanned'
  | 'MostRecentlyPlanned'
  | 'RecentPlanningPopularity';

export interface ApiRecipeSearchResult extends ApiRecipeSummary {
  baseServings: number;
  ingredients: ApiRecipeIngredient[];
  profiles: ApiRecipeProfileSummary[];
  pastTimesPlanned: number;
  lastPastPlanned: string | null;
  upcomingTimesPlanned: number;
}
