import { Routes } from '@angular/router';
import { unsavedRecipeGuard } from './pages/edit-recipe-page/edit-recipe-page';

export const RECIPE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/recipe-catalog-page/recipe-catalog-page').then(
        ({ RecipeCatalogPage }) => RecipeCatalogPage,
      ),
    pathMatch: 'full',
    title: $localize`:@@navigation.recipes:Recipes`,
    data: { pageOwnsHeading: true },
  },
  {
    path: 'new',
    loadComponent: () =>
      import('./pages/edit-recipe-page/edit-recipe-page').then(
        ({ EditRecipePage }) => EditRecipePage,
      ),
    canDeactivate: [unsavedRecipeGuard],
    title: $localize`:@@recipes.newRecipe:New recipe`,
  },
  {
    path: ':id/edit',
    loadComponent: () =>
      import('./pages/edit-recipe-page/edit-recipe-page').then(
        ({ EditRecipePage }) => EditRecipePage,
      ),
    canDeactivate: [unsavedRecipeGuard],
    title: $localize`:@@recipes.editRecipeTitle:Edit recipe`,
  },
  {
    path: ':id',
    loadComponent: () =>
      import('./pages/recipe-page/recipe-page').then(({ RecipePage }) => RecipePage),
    title: $localize`:@@recipes.pageTitle:Recipe`,
    data: { pageOwnsHeading: true },
  },
];
