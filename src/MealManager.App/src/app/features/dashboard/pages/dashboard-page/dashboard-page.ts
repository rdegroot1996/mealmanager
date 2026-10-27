import { Component, computed, inject, LOCALE_ID } from '@angular/core';
import { FavoriteRecipes } from '../../components/favorite-recipes/favorite-recipes';
import { ActiveMealPlan } from '../../components/active-meal-plan/active-meal-plan';
import { UpcomingMeals } from '../../components/upcoming-meals/upcoming-meals';
import { AuthService } from '../../../../core/auth/auth.service';

import { DashboardState } from '../../dashboard-state';

@Component({
  providers: [DashboardState],
  selector: 'app-dashboard-page',
  imports: [FavoriteRecipes, ActiveMealPlan, UpcomingMeals],
  templateUrl: './dashboard-page.html',
})
export class DashboardPage {
  private readonly auth = inject(AuthService);
  readonly title = $localize`:@@dashboard.welcomeHome:Welcome home`;
  readonly greeting = computed(() =>
    timeOfDayGreeting(new Date().getHours(), this.auth.currentUser()?.displayName),
  );
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

export function timeOfDayGreeting(hour: number, displayName?: string): string {
  const name = displayName?.trim();
  if (name) {
    if (hour < 6) return $localize`:@@dashboard.goodNightNamed:Good night, ${name}:displayName: 👋`;
    if (hour < 12)
      return $localize`:@@dashboard.goodMorningNamed:Good morning, ${name}:displayName: 👋`;
    if (hour < 18)
      return $localize`:@@dashboard.goodAfternoonNamed:Good afternoon, ${name}:displayName: 👋`;
    return $localize`:@@dashboard.goodEveningNamed:Good evening, ${name}:displayName: 👋`;
  }
  if (hour < 6) return $localize`:@@dashboard.goodNight:Good night 👋`;
  if (hour < 12) return $localize`:@@dashboard.goodMorning:Good morning 👋`;
  if (hour < 18) return $localize`:@@dashboard.goodAfternoon:Good afternoon 👋`;
  return $localize`:@@dashboard.goodEvening:Good evening 👋`;
}
