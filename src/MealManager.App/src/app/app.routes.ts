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
    path: 'planning',
    loadChildren: () =>
      import('./features/planning/planning.routes').then(({ PLANNING_ROUTES }) => PLANNING_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'recipes',
    loadChildren: () =>
      import('./features/recipes/recipes.routes').then(({ RECIPE_ROUTES }) => RECIPE_ROUTES),
    canActivate: [authGuard],
  },
  {
    path: 'groceries',
    loadChildren: () =>
      import('./features/groceries/groceries.routes').then(
        ({ GROCERIES_ROUTES }) => GROCERIES_ROUTES,
      ),
    canActivate: [authGuard],
  },
  {
    path: 'settings',
    loadChildren: () =>
      import('./features/settings/settings.routes').then(({ SETTINGS_ROUTES }) => SETTINGS_ROUTES),
    canActivate: [authGuard, adminGuard],
  },
  { path: 'users', pathMatch: 'full', redirectTo: 'settings' },
  {
    path: '**',
    redirectTo: '',
  },
];
