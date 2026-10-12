import { Routes } from '@angular/router';

export const PLANNING_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./pages/planning-timeline-page/planning-timeline-page').then(
        ({ PlanningTimelinePage }) => PlanningTimelinePage,
      ),
    data: { pageOwnsHeading: true },
    title: $localize`:@@navigation.planning:Planning`,
  },
];
