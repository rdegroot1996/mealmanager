export function viewRecipeLabel(name: string): string {
  return $localize`:@@recipes.viewRecipe:View recipe ${name}:recipeName:`;
}

export function openRecipeLabel(name: string): string {
  return $localize`:@@recipes.openRecipe:Open recipe ${name}:recipeName:`;
}

export function reorderItemLabel(name: string): string {
  return $localize`:@@common.reorderItem:Reorder ${name}:itemName:`;
}

export function editItemLabel(name: string): string {
  return $localize`:@@common.editItem:Edit ${name}:itemName:`;
}

export function clearSearchLabel(name: string): string {
  return $localize`:@@common.clearSearch:Clear ${name}:searchName:`;
}

export function selectItemLabel(name: string): string {
  return $localize`:@@common.selectItem:Select ${name}:itemName:`;
}

export function moreActionsForItemLabel(name: string): string {
  return $localize`:@@common.moreActionsForItem:More actions for ${name}:itemName:`;
}

export function addGroceriesForMealLabel(name: string): string {
  return $localize`:@@planner.reviewGroceriesForMeal:Review groceries for ${name}:recipeName:`;
}

export function editGroceriesForMealLabel(name: string): string {
  return $localize`:@@planner.editGrocerySelectionForMeal:Edit grocery selection for ${name}:recipeName:`;
}
