export interface ApiGroceryItem {
  id: string;
  name: string;
  quantity: number;
  order: number;
  checked: boolean;
  recipeProfileProductId?: string | null;
  planningMealId: string | null;
}

export interface ApiPlanningMealSummary {
  id: string;
  date: string;
  recipeId: string;
  recipeName: string;
  recipeImageUrl: string;
  profileName: string;
  profileServings: number;
}

export interface ApiPlanningMealGroceries {
  planningMeal: ApiPlanningMealSummary;
  groceries: ApiGroceryItem[];
}

export interface ApiGroceryList {
  id: string;
  planningCycleId: string;
  planningMealGroceries: ApiPlanningMealGroceries[];
  groceries: ApiGroceryItem[];
}
