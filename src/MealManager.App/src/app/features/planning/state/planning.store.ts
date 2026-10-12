import { computed, inject, Injectable, LOCALE_ID, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiPlanningEntry, ApiPlanningNote, ApiPlanning } from '../../../api/models/api-planning';
import { ApiPlanningCycle } from '../../../api/models/api-planning-cycle';
import { PlanningCycleStore } from '../../planning-cycle/state/planning-cycle.store';
import { ApiUpcomingPlanning } from '../../../api/models/api-upcoming-planning';
import { ApiPlanningMealGroceries } from '../../../api/models/api-groceries';
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
  entries: ApiPlanningEntry[];
  notes: ApiPlanningNote[];
}

@Injectable({
  providedIn: 'root',
})
export class PlanningStore {
  private http = inject(HttpClient);
  private cycleStore = inject(PlanningCycleStore);
  private locale = inject(LOCALE_ID);

  private loadRequest = 0;
  activePlanning = signal<ApiPlanning | null>(null);

  days = computed<PlanningDay[]>(() => {
    const planning = this.activePlanning();
    const cycle = this.cycleStore.currentCycle();
    if (!planning || !cycle || planning.planningCycleId !== cycle.id) return [];

    return planningDays(cycle, planning, this.locale);
  });

  fetchPlanning(cycleId: string) {
    return this.http.get<ApiPlanning>(`/api/planning/cycle/${cycleId}`);
  }

  fetchUpcomingPlanning(fromDate: string) {
    return this.http.get<ApiUpcomingPlanning>('/api/planning/upcoming', { params: { fromDate } });
  }

  addRecipeToPlanning(planningId: string, date: string, recipeId: string, recipeProfileId: string) {
    return this.http.post<ApiPlanningEntry>('/api/planning-meals', {
      planningId,
      date,
      recipeId,
      recipeProfileId,
    });
  }

  loadPlanning(cycleId: string, cycle?: ApiPlanningCycle) {
    const request = ++this.loadRequest;
    if (cycle) this.cycleStore.currentCycle.set(cycle);
    return this.http.get<ApiPlanning>(`/api/planning/cycle/${cycleId}`).pipe(
      tap((data) => {
        if (request === this.loadRequest && this.cycleStore.currentCycle()?.id === cycleId)
          this.activePlanning.set(data);
      }),
    );
  }

  addMeal(date: string, recipeId: string, profileId: string) {
    const cycleId = this.activePlanning()?.planningCycleId;
    const planningId = this.activePlanning()?.id;
    if (!planningId)
      return throwError(
        () =>
          new Error(
            $localize`:@@planning.planning.store.noActivePlanningIsLoaded:No active planning is loaded.`,
          ),
      );
    return this.http
      .post<ApiPlanningEntry>('/api/planning-meals', {
        planningId,
        date,
        recipeId,
        recipeProfileId: profileId,
      })
      .pipe(switchMap(() => this.reloadPlanning(cycleId)));
  }

  removeMeal(mealId: string) {
    const cycleId = this.activePlanning()?.planningCycleId;
    return this.http
      .delete(`/api/planning-meals/${mealId}`)
      .pipe(switchMap(() => this.reloadPlanning(cycleId)));
  }

  changeProfile(mealId: string, profileId: string) {
    const cycleId = this.activePlanning()?.planningCycleId;
    return this.http
      .put(`/api/planning-meals/${mealId}/profile/${profileId}`, null)
      .pipe(switchMap(() => this.reloadPlanning(cycleId)));
  }

  moveEntry(entryId: string, targetDate: string, targetIndex?: number) {
    const cycleId = this.activePlanning()?.planningCycleId;
    return this.http
      .post(`/api/planning-meals/${entryId}/move`, { targetDate, targetIndex })
      .pipe(switchMap(() => this.reloadPlanning(cycleId)));
  }

  planLeftovers(mealId: string, targetDate: string) {
    const cycleId = this.activePlanning()?.planningCycleId;
    return this.http
      .post(`/api/planning-meals/${mealId}/leftovers`, { date: targetDate })
      .pipe(switchMap(() => this.reloadPlanning(cycleId)));
  }

  addMealGroceries(
    mealId: string,
    items: { recipeProfileProductId: string | null; name: string; quantity: number }[],
  ) {
    const cycleId = this.activePlanning()?.planningCycleId;
    return this.http
      .post(`/api/planning-meals/${mealId}/groceries`, { groceries: items })
      .pipe(switchMap(() => this.reloadPlanning(cycleId)));
  }

  loadMealGroceries(mealId: string) {
    return this.http.get<ApiPlanningMealGroceries>(`/api/planning-meals/${mealId}/groceries`);
  }

  addNote(date: string, text: string) {
    const cycleId = this.activePlanning()?.planningCycleId;
    const planningId = this.activePlanning()?.id;
    if (!planningId)
      return throwError(
        () =>
          new Error(
            $localize`:@@planning.planning.store.noActivePlanningIsLoaded:No active planning is loaded.`,
          ),
      );
    return this.http
      .post(`/api/planning-notes`, { planningId, date, text })
      .pipe(switchMap(() => this.reloadPlanning(cycleId)));
  }

  updateNote(noteId: string, text: string) {
    const cycleId = this.activePlanning()?.planningCycleId;
    return this.http
      .put(`/api/planning-notes/${noteId}`, { text })
      .pipe(switchMap(() => this.reloadPlanning(cycleId)));
  }

  deleteNote(noteId: string) {
    const cycleId = this.activePlanning()?.planningCycleId;
    return this.http
      .delete(`/api/planning-notes/${noteId}`)
      .pipe(switchMap(() => this.reloadPlanning(cycleId)));
  }

  private reloadPlanning(cycleId: string | undefined) {
    return cycleId && this.cycleStore.currentCycle()?.id === cycleId
      ? this.loadPlanning(cycleId)
      : of(null);
  }
}

export function planningDays(
  cycle: ApiPlanningCycle,
  planning: ApiPlanning,
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

  for (const entry of planning.entries) {
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

  for (const note of planning.notes) {
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
