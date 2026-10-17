import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { MealPlanStore } from './meal-plan.store';
import { PlanningCycleStore } from '../../planning-cycle/state/planning-cycle.store';

describe('MealPlanStore', () => {
  let store: MealPlanStore;
  let cycleStore: PlanningCycleStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(MealPlanStore);
    cycleStore = TestBed.inject(PlanningCycleStore);
    cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-15',
      endDate: '2026-08-17',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
  });

  it('classifies past, today, and upcoming days from the local calendar date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 16, 12));
    cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-15',
      endDate: '2026-08-17',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    store.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [],
      notes: [],
    });

    expect(
      store.days().map((day) => ({ date: day.date, isPast: day.isPast, isToday: day.isToday })),
    ).toEqual([
      { date: '2026-08-15', isPast: true, isToday: false },
      { date: '2026-08-16', isPast: false, isToday: true },
      { date: '2026-08-17', isPast: false, isToday: false },
    ]);
  });

  it('moves a meal with the explicit move action and reloads its planning cycle', () => {
    store.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [],
      notes: [],
    });

    store.moveEntry('meal-1', '2026-08-16').subscribe();

    const move = http.expectOne('/api/planned-meals/meal-1/move');
    expect(move.request.method).toBe('POST');
    expect(move.request.body).toEqual({ targetDate: '2026-08-16' });
    move.flush({});

    http.expectOne('/api/meal-plans/cycle/cycle-1').flush({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [],
      notes: [],
    });
  });

  it('moves a leftover with the dedicated endpoint and reloads its planning cycle', () => {
    store.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [],
      notes: [],
    });

    store.moveEntry('leftover-1', '2026-08-17', 1).subscribe();

    const move = http.expectOne('/api/planned-meals/leftover-1/move');
    expect(move.request.body).toEqual({ targetDate: '2026-08-17', targetIndex: 1 });
    move.flush({});
    http
      .expectOne('/api/meal-plans/cycle/cycle-1')
      .flush({ id: 'planning-1', planningCycleId: 'cycle-1', entries: [], notes: [] });
  });

  it('updates a note and reloads its planning cycle', () => {
    store.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [],
      notes: [],
    });

    store.updateNote('note-1', 'Updated note').subscribe();

    const update = http.expectOne('/api/planning-day-notes/note-1');
    expect(update.request.method).toBe('PUT');
    expect(update.request.body).toEqual({ text: 'Updated note' });
    update.flush({ id: 'note-1', date: '2026-08-16', text: 'Updated note' });

    http
      .expectOne('/api/meal-plans/cycle/cycle-1')
      .flush({ id: 'planning-1', planningCycleId: 'cycle-1', entries: [], notes: [] });
  });

  it('merges normal meals and leftovers by their persisted sort order', () => {
    cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-15',
      endDate: '2026-08-16',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    store.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [
        {
          id: 'meal-2',
          kind: 'Meal',
          originalMealId: null,
          date: '2026-08-16',
          sortOrder: 2,
          recipe: {
            id: 'r',
            name: 'Pasta',
            category: 'Meals',
            imageUrl: null,
            tags: [],
            isFavorite: false,
          },
          recipeProfile: { id: 'p', name: 'Default', servings: 4 },
          hasReviewedGroceries: false,
        },
        {
          id: 'meal-1',
          kind: 'Meal',
          originalMealId: null,
          date: '2026-08-15',
          sortOrder: 0,
          recipe: {
            id: 'r',
            name: 'Pasta',
            category: 'Meals',
            imageUrl: null,
            tags: [],
            isFavorite: false,
          },
          recipeProfile: { id: 'p', name: 'Default', servings: 4 },
          hasReviewedGroceries: false,
        },
        {
          id: 'leftover-1',
          kind: 'Leftover',
          originalMealId: 'meal-1',
          date: '2026-08-16',
          sortOrder: 1,
          recipe: {
            id: 'r',
            name: 'Pasta',
            category: 'Meals',
            imageUrl: null,
            tags: [],
            isFavorite: false,
          },
          recipeProfile: { id: 'p', name: 'Default', servings: 4 },
          hasReviewedGroceries: false,
        },
      ],
      notes: [],
    });

    expect(
      store
        .days()
        .find((day) => day.date === '2026-08-16')
        ?.entries.map((entry) => entry.id),
    ).toEqual(['leftover-1', 'meal-2']);
  });
});
