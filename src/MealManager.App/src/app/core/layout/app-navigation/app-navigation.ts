import { Component, input } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AppIcon } from '../../../shared/components/app-icon/app-icon';

export interface AppNavigationItem {
  name: string;
  route: string;
  icon: string;
}

@Component({
  selector: 'app-navigation',
  host: {
    class:
      'contents min-[800px]:col-start-1 min-[800px]:row-start-2 min-[800px]:block min-[800px]:min-h-0',
  },
  imports: [RouterLink, RouterLinkActive, AppIcon],
  templateUrl: './app-navigation.html',
})
export class AppNavigation {
  items = input.required<AppNavigationItem[]>();
}
