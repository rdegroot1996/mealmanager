import { Component, computed, inject, LOCALE_ID } from '@angular/core';
import { FavoriteRecipes } from '../../components/favorite-recipes/favorite-recipes';
import { ActiveMealPlan } from '../../components/active-meal-plan/active-meal-plan';
import { UpcomingMeals } from '../../components/upcoming-meals/upcoming-meals';

import { DashboardState } from '../../dashboard-state';

@Component({
  providers: [DashboardState],
  selector: 'app-dashboard-page',
  imports: [FavoriteRecipes, ActiveMealPlan, UpcomingMeals],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  readonly title = $localize`:@@dashboard.welcomeHome:Welcome home`;
  readonly greeting = timeOfDayGreeting(new Date().getHours());
  private readonly locale = inject(LOCALE_ID);
  readonly todayLabel = computed(() =>
    new Intl.DateTimeFormat(this.locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(
      new Date(this.state.today() + 'T12:00:00'),
    ),
  );
  state = inject(DashboardState);
  ngOnInit() {
    this.state.load();
  }
}

export function timeOfDayGreeting(hour: number): string {
  if (hour < 6) return $localize`:@@dashboard.goodNight:Good night 👋`;
  if (hour < 12) return $localize`:@@dashboard.goodMorning:Good morning 👋`;
  if (hour < 18) return $localize`:@@dashboard.goodAfternoon:Good afternoon 👋`;
  return $localize`:@@dashboard.goodEvening:Good evening 👋`;
}
