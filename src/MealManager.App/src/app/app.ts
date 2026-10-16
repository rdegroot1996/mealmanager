import { Component, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './core/auth/auth.service';
import { AppNavigation, AppNavigationItem } from './core/layout/app-navigation/app-navigation';
import { ToastHost } from './shared/components/toast-host/toast-host';
import { LanguageSwitcher } from './core/i18n/language-switcher';
import { AppIcon } from './shared/components/app-icon/app-icon';
import { MobileAppBar } from './core/layout/mobile-app-bar';
import { RecipeReturnContext } from './core/layout/recipe-return-context';
import { AppBrand } from './shared/components/app-brand/app-brand';
import { Modal } from './shared/components/modal/modal';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    AppNavigation,
    ToastHost,
    LanguageSwitcher,
    AppIcon,
    AppBrand,
    Modal,
    MobileAppBar,
  ],
  templateUrl: './app.html',
})
export class App {
  auth = inject(AuthService);
  private router = inject(Router);
  pageTitle = signal($localize`:@@navigation.dashboard:Dashboard`);
  pageOwnsHeading = signal(false);

  private recipeReturnContext = inject(RecipeReturnContext);

  constructor() {
    this.updatePageTitle();
    this.router.events
      .pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
      .subscribe(() => {
        this.updatePageTitle();
      });
  }

  signOut() {
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => {
        this.auth.markUnauthenticated();
        void this.router.navigate(['/login']);
      },
    });
  }

  menuItems: AppNavigationItem[] = [
    { name: $localize`:@@navigation.dashboard:Dashboard`, route: '/', icon: 'home' },
    { name: $localize`:@@navigation.recipes:Recipes`, route: '/recipes', icon: 'menu_book' },
    { name: $localize`:@@navigation.planner:Planner`, route: '/planner', icon: 'date_range' },
    {
      name: $localize`:@@groceries.pageTitle:Shopping list`,
      route: '/shopping-list',
      icon: 'shopping_cart',
    },
  ];

  private updatePageTitle() {
    let route = this.router.routerState.snapshot.root;
    while (route.firstChild) route = route.firstChild;
    this.pageOwnsHeading.set(route.data['pageOwnsHeading'] === true);
    this.pageTitle.set(route.title ?? $localize`:@@app.name:MealManager`);
  }
}
