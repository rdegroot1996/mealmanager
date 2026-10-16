import { inject, Injectable, signal } from '@angular/core';
import { map, Subscription, switchMap } from 'rxjs';
import { PlanningCycleStore } from '../planning-cycle/state/planning-cycle.store';
import { MealPlanStore } from '../planner/state/meal-plan.store';
import { ApiPlanningCycle } from '../../api/models/api-planning-cycle';
import { ApiMealPlan } from '../../api/models/api-meal-plan';
import { ApiUpcomingMealPlan } from '../../api/models/api-upcoming-meal-plan';
import { DateTime } from 'luxon';

/** Owned by the dashboard page; never changes the planner/shopping browsing selection. */
@Injectable()
export class DashboardState {
  private cycles = inject(PlanningCycleStore);
  private mealPlans = inject(MealPlanStore);
  private request?: Subscription;
  cycle = signal<ApiPlanningCycle | null>(null);
  mealPlan = signal<ApiMealPlan | null>(null);
  loading = signal(false);
  noCycle = signal(false);
  error = signal('');
  upcoming = signal<ApiUpcomingMealPlan | null>(null);
  upcomingLoading = signal(false);
  upcomingError = signal('');
  today = signal(DateTime.local().toISODate()!);
  private upcomingRequest?: Subscription;
  private dateTimer?: ReturnType<typeof setInterval>;

  private loadUpcoming() {
    this.upcomingRequest?.unsubscribe();
    this.upcoming.set(null);
    this.upcomingLoading.set(true);
    this.upcomingError.set('');
    this.upcomingRequest = this.mealPlans.fetchUpcomingMealPlan(this.today()).subscribe({
      next: (upcoming) => {
        this.upcoming.set(upcoming);
        this.upcomingLoading.set(false);
      },
      error: () => {
        this.upcomingLoading.set(false);
        this.upcomingError.set(
          $localize`:@@dashboard.upcomingLoadError:Upcoming meals could not be loaded. Please retry.`,
        );
      },
    });
  }

  load() {
    this.today.set(DateTime.local().toISODate()!);
    this.loadUpcoming();
    if (!this.dateTimer)
      this.dateTimer = setInterval(() => {
        const today = DateTime.local().toISODate()!;
        if (today !== this.today()) {
          this.today.set(today);
          this.loadUpcoming();
        }
      }, 30_000);
    this.request?.unsubscribe();
    this.cycle.set(null);
    this.mealPlan.set(null);
    this.loading.set(true);
    this.noCycle.set(false);
    this.error.set('');
    this.request = this.cycles
      .fetchActiveCycle()
      .pipe(
        switchMap((cycle) =>
          this.mealPlans.fetchMealPlan(cycle.id).pipe(map((mealPlan) => ({ cycle, mealPlan }))),
        ),
      )
      .subscribe({
        next: ({ cycle, mealPlan }) => {
          this.cycle.set(cycle);
          this.mealPlan.set(mealPlan);
          this.loading.set(false);
        },
        error: (error: { status?: number }) => {
          this.loading.set(false);
          if (error.status === 404) this.noCycle.set(true);
          else
            this.error.set(
              $localize`:@@dashboard.dashboardState.activeMealPlanCouldNotBeLoadedPlease:Active cycle could not be loaded. Please retry.`,
            );
        },
      });
  }

  ngOnDestroy() {
    this.request?.unsubscribe();
    this.upcomingRequest?.unsubscribe();
    if (this.dateTimer) clearInterval(this.dateTimer);
  }
}
