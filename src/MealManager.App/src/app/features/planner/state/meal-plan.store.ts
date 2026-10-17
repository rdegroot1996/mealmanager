import { computed, inject, Injectable, LOCALE_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import {
  ApiPlannedEntry,
  ApiPlanningDayNote,
  ApiMealPlan,
} from '../../../api/models/api-meal-plan';
import { ApiPlanningCycle } from '../../../api/models/api-planning-cycle';
import { PlanningCycleStore } from '../../planning-cycle/state/planning-cycle.store';
import { ApiUpcomingMealPlan } from '../../../api/models/api-upcoming-meal-plan';
import { ApiMealShoppingGroup } from '../../../api/models/api-shopping-list';
import { DateTime } from 'luxon';
import { of, switchMap, tap, throwError } from 'rxjs';
import { planningDateParts } from '../../../shared/utils/planning-date';
import { DEFAULT_LOCALE } from '../../../core/i18n/locale';

export interface PlanningDay {
  date: string;
  dateTime: DateTime;
  isPast: boolean;
  isToday: boolean;
  weekday: string;
  longWeekday: string;
  shortDate: string;
  entries: ApiPlannedEntry[];
  notes: ApiPlanningDayNote[];
}

@Injectable({
  providedIn: 'root',
})
export class MealPlanStore {
  private http = inject(HttpClient);
  private cycleStore = inject(PlanningCycleStore);
  private locale = inject(LOCALE_ID);

  private loadRequest = 0;
  activeMealPlan = signal<ApiMealPlan | null>(null);

  days = computed<PlanningDay[]>(() => {
    const mealPlan = this.activeMealPlan();
    const cycle = this.cycleStore.currentCycle();
    if (!mealPlan || !cycle || mealPlan.planningCycleId !== cycle.id) return [];

    return planningDays(cycle, mealPlan, this.locale);
  });

  fetchMealPlan(cycleId: string) {
    return this.http.get<ApiMealPlan>(`/api/meal-plans/cycle/${cycleId}`);
  }

  fetchUpcomingMealPlan(fromDate: string) {
    return this.http.get<ApiUpcomingMealPlan>('/api/meal-plans/upcoming', { params: { fromDate } });
  }

  planMeal(mealPlanId: string, date: string, recipeId: string, recipeProfileId: string) {
    return this.http.post<ApiPlannedEntry>('/api/planned-meals', {
      mealPlanId,
      date,
      recipeId,
      recipeProfileId,
    });
  }

  loadMealPlan(cycleId: string, cycle?: ApiPlanningCycle) {
    const request = ++this.loadRequest;
    if (cycle) this.cycleStore.currentCycle.set(cycle);
    return this.http.get<ApiMealPlan>(`/api/meal-plans/cycle/${cycleId}`).pipe(
      tap((data) => {
        if (request === this.loadRequest && this.cycleStore.currentCycle()?.id === cycleId)
          this.activeMealPlan.set(data);
      }),
    );
  }

  addMeal(date: string, recipeId: string, profileId: string) {
    const cycleId = this.activeMealPlan()?.planningCycleId;
    const mealPlanId = this.activeMealPlan()?.id;
    if (!mealPlanId)
      return throwError(
        () =>
          new Error(
            $localize`:@@planner.mealPlan.store.noActiveMealPlanIsLoaded:No active meal plan is loaded.`,
          ),
      );
    return this.planMeal(mealPlanId, date, recipeId, profileId).pipe(
      switchMap(() => this.reloadMealPlan(cycleId)),
    );
  }

  removeMeal(mealId: string) {
    const cycleId = this.activeMealPlan()?.planningCycleId;
    return this.http
      .delete(`/api/planned-meals/${mealId}`)
      .pipe(switchMap(() => this.reloadMealPlan(cycleId)));
  }

  changeProfile(mealId: string, profileId: string) {
    const cycleId = this.activeMealPlan()?.planningCycleId;
    return this.http
      .put(`/api/planned-meals/${mealId}/profile/${profileId}`, null)
      .pipe(switchMap(() => this.reloadMealPlan(cycleId)));
  }

  moveEntry(entryId: string, targetDate: string, targetIndex?: number) {
    const cycleId = this.activeMealPlan()?.planningCycleId;
    return this.http
      .post(`/api/planned-meals/${entryId}/move`, { targetDate, targetIndex })
      .pipe(switchMap(() => this.reloadMealPlan(cycleId)));
  }

  planLeftovers(mealId: string, targetDate: string) {
    const cycleId = this.activeMealPlan()?.planningCycleId;
    return this.http
      .post(`/api/planned-meals/${mealId}/leftovers`, { date: targetDate })
      .pipe(switchMap(() => this.reloadMealPlan(cycleId)));
  }

  reviewMealGroceries(
    mealId: string,
    items: { recipeProfileGroceryItemId: string | null; name: string; quantity: number }[],
  ) {
    const cycleId = this.activeMealPlan()?.planningCycleId;
    return this.http
      .post(`/api/planned-meals/${mealId}/groceries`, { groceries: items })
      .pipe(switchMap(() => this.reloadMealPlan(cycleId)));
  }

  loadMealGroceries(mealId: string) {
    return this.http.get<ApiMealShoppingGroup>(`/api/planned-meals/${mealId}/groceries`);
  }

  addNote(date: string, text: string) {
    const cycleId = this.activeMealPlan()?.planningCycleId;
    const mealPlanId = this.activeMealPlan()?.id;
    if (!mealPlanId)
      return throwError(
        () =>
          new Error(
            $localize`:@@planner.mealPlan.store.noActiveMealPlanIsLoaded:No active meal plan is loaded.`,
          ),
      );
    return this.http
      .post(`/api/planning-day-notes`, { mealPlanId, date, text })
      .pipe(switchMap(() => this.reloadMealPlan(cycleId)));
  }

  updateNote(noteId: string, text: string) {
    const cycleId = this.activeMealPlan()?.planningCycleId;
    return this.http
      .put(`/api/planning-day-notes/${noteId}`, { text })
      .pipe(switchMap(() => this.reloadMealPlan(cycleId)));
  }

  deleteNote(noteId: string) {
    const cycleId = this.activeMealPlan()?.planningCycleId;
    return this.http
      .delete(`/api/planning-day-notes/${noteId}`)
      .pipe(switchMap(() => this.reloadMealPlan(cycleId)));
  }

  private reloadMealPlan(cycleId: string | undefined) {
    return cycleId && this.cycleStore.currentCycle()?.id === cycleId
      ? this.loadMealPlan(cycleId)
      : of(null);
  }
}

export function planningDays(
  cycle: ApiPlanningCycle,
  mealPlan: ApiMealPlan,
  locale = DEFAULT_LOCALE,
): PlanningDay[] {
  const dateMap = new Map<string, PlanningDay>();

  // Generate all days in the cycle range
  const today = DateTime.local().startOf('day');
  const start = DateTime.fromISO(cycle.startDate);
  const end = DateTime.fromISO(cycle.endDate);
  for (let dt = start; dt <= end; dt = dt.plus({ days: 1 })) {
    const dateStr = dt.toISODate()!;
    dateMap.set(dateStr, {
      date: dateStr,
      dateTime: dt,
      isPast: dt < today,
      isToday: dt.hasSame(today, 'day'),
      ...planningDateParts(dt, locale),
      longWeekday: dt.setLocale(locale).toFormat('cccc'),
      entries: [],
      notes: [],
    });
  }

  for (const entry of mealPlan.entries) {
    if (!dateMap.has(entry.date)) {
      const dt = DateTime.fromISO(entry.date);
      dateMap.set(entry.date, {
        date: entry.date,
        dateTime: dt,
        isPast: dt < today,
        isToday: dt.hasSame(today, 'day'),
        ...planningDateParts(dt, locale),
        longWeekday: dt.setLocale(locale).toFormat('cccc'),
        entries: [],
        notes: [],
      });
    }
    dateMap.get(entry.date)!.entries.push(entry);
  }

  for (const note of mealPlan.notes) {
    if (!dateMap.has(note.date)) {
      const dt = DateTime.fromISO(note.date);
      dateMap.set(note.date, {
        date: note.date,
        dateTime: dt,
        isPast: dt < today,
        isToday: dt.hasSame(today, 'day'),
        ...planningDateParts(dt, locale),
        longWeekday: dt.setLocale(locale).toFormat('cccc'),
        entries: [],
        notes: [],
      });
    }
    dateMap.get(note.date)!.notes.push(note);
  }

  for (const day of dateMap.values()) {
    day.entries.sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
  }
  return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}
