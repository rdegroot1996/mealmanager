export interface ApiRecipeIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  order: number;
}

export interface ApiRecipeStep {
  id: string;
  description: string;
  order: number;
}

export interface ApiRecipeImage {
  id: string;
  url: string;
  order: number;
}

export interface ApiRecipeProduct {
  id: string;
  name: string;
  quantity: number;
  atHome: boolean;
  order?: number;
}

export interface ApiRecipeProfile {
  id: string;
  name: string;
  servings: number;
  products: ApiRecipeProduct[];
}

export interface ApiRecipe {
  id: string;
  name: string;
  category: string;
  notes?: string | null;
  baseServings: number;
  isFavorite: boolean;
  tags: ApiRecipeTag[];
  images: ApiRecipeImage[];
  ingredients: ApiRecipeIngredient[];
  steps: ApiRecipeStep[];
  profiles: ApiRecipeProfileSummary[];
}

export interface ApiRecipeDetails extends ApiRecipe {
  planningStatistics: {
    timesPlanned: number;
    lastPlanned: string | null;
    upcomingTimesPlanned?: number;
  };
}
import { ApiRecipeProfileSummary, ApiRecipeTag } from './api-recipe-summary';
