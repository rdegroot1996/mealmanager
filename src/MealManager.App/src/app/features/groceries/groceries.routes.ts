import { Routes } from '@angular/router';

export const GROCERIES_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/groceries-page/groceries-page').then(({ GroceriesPage }) => GroceriesPage),
    title: $localize`:@@groceries.pageTitle:Groceries list`,
    data: { pageOwnsHeading: true },
  },
];
