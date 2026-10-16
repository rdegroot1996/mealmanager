import { Routes } from '@angular/router';

export const PLANNER_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/planner-page/planner-page').then(({ PlannerPage }) => PlannerPage),
    data: { pageOwnsHeading: true },
    title: $localize`:@@navigation.planner:Planner`,
  },
];
