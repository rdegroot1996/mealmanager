export const recipeCategories = ['Meals', 'Baking', 'Desserts', 'Snacks', 'Other'] as const;
export type RecipeCategory = (typeof recipeCategories)[number];

export function recipeCategoryLabel(category: string): string {
  switch (category) {
    case 'Meals':
      return $localize`:@@recipes.category.meals:Meals`;
    case 'Baking':
      return $localize`:@@recipes.category.baking:Baking`;
    case 'Desserts':
      return $localize`:@@recipes.category.desserts:Desserts`;
    case 'Snacks':
      return $localize`:@@recipes.category.snacks:Snacks`;
    case 'Other':
      return $localize`:@@recipes.category.other:Other`;
    default:
      return category;
  }
}
