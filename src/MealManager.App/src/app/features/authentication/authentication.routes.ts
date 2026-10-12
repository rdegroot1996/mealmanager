import { Routes } from '@angular/router';

export const AUTHENTICATION_ROUTES: Routes = [
  {
    path: 'setup',
    loadComponent: () => import('./pages/setup-page/setup-page').then(({ SetupPage }) => SetupPage),
    title: $localize`:@@authentication.setupTitle:Set up MealManager`,
  },
  {
    path: 'login',
    loadComponent: () => import('./pages/login-page/login-page').then(({ LoginPage }) => LoginPage),
    title: $localize`:@@authentication.signIn:Sign in`,
  },
];
