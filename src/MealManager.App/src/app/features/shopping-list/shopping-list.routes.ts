import { Routes } from '@angular/router';

export const SHOPPING_LIST_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/shopping-list-page/shopping-list-page').then(
        ({ ShoppingListPage }) => ShoppingListPage,
      ),
    title: $localize`:@@groceries.pageTitle:Shopping list`,
    data: { pageOwnsHeading: true },
  },
];
