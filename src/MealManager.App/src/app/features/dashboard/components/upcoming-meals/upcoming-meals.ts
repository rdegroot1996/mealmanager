import { Component, computed, inject, LOCALE_ID } from '@angular/core';
import { DateTime } from 'luxon';
import { DashboardState } from '../../dashboard-state';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { planningDateParts } from '../../../../shared/utils/planning-date';
import { RouterLink } from '@angular/router';
import { viewRecipeLabel } from '../../../../core/i18n/labels';
import { LeftoverBadge } from '../../../planning/components/leftover-badge/leftover-badge';

@Component({
  selector: 'app-upcoming-meals',
  imports: [RecipeSummary, RouterLink, LeftoverBadge],
  templateUrl: './upcoming-meals.html',
})
export class UpcomingMeals {
  readonly viewRecipeLabel = viewRecipeLabel;
  state = inject(DashboardState);
  private locale = inject(LOCALE_ID);

  mealWeekday(date: string): string {
    return new Intl.DateTimeFormat(this.locale, { weekday: 'long' }).format(
      new Date(date + 'T12:00:00'),
    );
  }

  upcomingDay(date: string): string {
    return planningDateParts(date, this.locale).weekday;
  }

  upcomingMonth(date: string): string {
    return planningDateParts(date, this.locale).shortDate;
  }

  upcomingMeals = computed(() => {
    const meals = this.state.upcoming()?.entries ?? [];
    const today = this.state.today();
    return meals
      .filter((m) => m.date >= today)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      )
      .slice(0, 3);
  });

  previewDays = computed(() => {
    const firstDate = this.state.today();
    const plannedDates = this.state.upcoming()?.plannedDates ?? [];
    const days: { date: string; weekday: string; dayNumber: number; hasMeal: boolean }[] = [];

    for (let date = DateTime.fromISO(firstDate); days.length < 7; date = date.plus({ days: 1 })) {
      const iso = date.toISODate()!;
      days.push({
        date: iso,
        weekday: this.upcomingDay(iso),
        dayNumber: date.day,
        hasMeal: plannedDates.includes(iso),
      });
    }

    return days;
  });
}
