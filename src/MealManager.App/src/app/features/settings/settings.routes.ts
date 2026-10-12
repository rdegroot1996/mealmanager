import { Routes } from '@angular/router';
import { SettingsPage } from './pages/settings-page/settings-page';

export const SETTINGS_ROUTES: Routes = [
  {
    path: '',
    pathMatch: 'full',
    component: SettingsPage,
    title: $localize`:@@settings.title:Settings`,
  },
  { path: 'users', pathMatch: 'full', redirectTo: '' },
  { path: 'supermarkets', pathMatch: 'full', redirectTo: '' },
];
