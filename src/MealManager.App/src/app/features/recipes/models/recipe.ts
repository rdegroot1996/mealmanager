import { RecipeCategory } from './recipe-category';
import {
  ApiRecipeImage,
  ApiRecipeProfile,
  ApiRecipeStep,
  ApiRecipeIngredient,
} from '../../../api/models/api-recipe';
import { ApiRecipeTag } from '../../../api/models/api-recipe-summary';

export interface Recipe {
  id: string;
  name: string;
  category: RecipeCategory;
  notes?: string | null;
  baseServings: number;
  isFavorite: boolean;
  tags: ApiRecipeTag[];
  images: ApiRecipeImage[];
  ingredients: ApiRecipeIngredient[];
  steps: ApiRecipeStep[];
  profiles: ApiRecipeProfile[];
  planningStatistics?: {
    timesPlanned: number;
    lastPlanned: string | null;
    upcomingTimesPlanned?: number;
  };
}
