import { Routes } from '@angular/router';
import { authGuard } from '../../core/auth/auth.guard';

export const AUTHENTICATION_ROUTES: Routes = [
  {
    path: 'change-password',
    loadComponent: () =>
      import('./pages/change-password-page/change-password-page').then(
        ({ ChangePasswordPage }) => ChangePasswordPage,
      ),
    canActivate: [authGuard],
    title: $localize`:@@authentication.changePassword:Change password`,
    data: { pageOwnsHeading: true },
  },
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
