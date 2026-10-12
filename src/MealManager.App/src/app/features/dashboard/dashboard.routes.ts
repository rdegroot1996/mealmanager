import { Routes } from '@angular/router';

export const DASHBOARD_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/dashboard-page/dashboard-page').then(({ DashboardPage }) => DashboardPage),
    pathMatch: 'full',
    data: { pageOwnsHeading: true },
    title: $localize`:@@navigation.dashboard:Dashboard`,
  },
];
