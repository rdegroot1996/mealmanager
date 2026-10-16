import { Routes } from '@angular/router';
import { AUTHENTICATION_ROUTES } from './features/authentication/authentication.routes';
import { authGuard } from './core/auth/auth.guard';
import { adminGuard } from './core/auth/admin.guard';

export const routes: Routes = [
  ...AUTHENTICATION_ROUTES,
  {
    path: '',
    loadChildren: () =>
      import('./features/dashboard/dashboard.routes').then(
        ({ DASHBOARD_ROUTES }) => DASHBOARD_ROUTES,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'planner',
    loadChildren: () =>
      import('./features/planner/planner.routes').then(({ PLANNER_ROUTES }) => PLANNER_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'recipes',
    loadChildren: () =>
      import('./features/recipes/recipes.routes').then(({ RECIPE_ROUTES }) => RECIPE_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'shopping-list',
    loadChildren: () =>
      import('./features/shopping-list/shopping-list.routes').then(
        ({ SHOPPING_LIST_ROUTES }) => SHOPPING_LIST_ROUTES,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./features/settings/settings.routes').then(({ SETTINGS_ROUTES }) => SETTINGS_ROUTES),
    canActivate: [authGuard, adminGuard],
  },
  {
    path: '**',
    redirectTo: '',
  },
];
