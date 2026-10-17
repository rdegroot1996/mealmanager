import { Component, computed, inject, LOCALE_ID } from '@angular/core';
import { planningDateParts } from '../../../../shared/utils/planning-date';
import { RouterLink } from '@angular/router';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

import { DashboardState } from '../../dashboard-state';

@Component({
  selector: 'app-active-meal-plan',
  imports: [RouterLink, AppIcon],
  templateUrl: './active-meal-plan.html',
})
export class ActiveMealPlan {
  state = inject(DashboardState);
  private readonly locale = inject(LOCALE_ID);
  range = computed(() => {
    const cycle = this.state.cycle();
    return cycle
      ? `${planningDateParts(cycle.startDate, this.locale).shortDate} – ${planningDateParts(cycle.endDate, this.locale).shortDate}`
      : '';
  });
  loading = this.state.loading;
  noCycle = this.state.noCycle;
  error = this.state.error;
  meals = computed(() => this.state.mealPlan()?.entries ?? []);
  originalMeals = computed(() => this.meals().filter((meal) => meal.kind === 'Meal'));
  reviewedMeals = computed(
    () => this.originalMeals().filter((meal) => meal.hasReviewedGroceries).length,
  );
  plannedEntries = computed(() => this.meals().length);
  load() {
    this.state.load();
  }
}
