export interface ApiShoppingListItem {
  id: string;
  name: string;
  quantity: number;
  order: number;
  checked: boolean;
  recipeProfileGroceryItemId?: string | null;
  plannedMealId: string | null;
}

export interface ApiPlannedMealSummary {
  id: string;
  date: string;
  recipeId: string;
  recipeName: string;
  recipeImageUrl: string;
  profileName: string;
  profileServings: number;
}

export interface ApiMealShoppingGroup {
  meal: ApiPlannedMealSummary;
  items: ApiShoppingListItem[];
}

export interface ApiShoppingList {
  id: string;
  planningCycleId: string;
  mealGroups: ApiMealShoppingGroup[];
  items: ApiShoppingListItem[];
}
