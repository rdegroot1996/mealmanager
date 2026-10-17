import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { ApiPlannedEntry } from '../../../../api/models/api-meal-plan';
import { MealPlanStore } from '../../state/meal-plan.store';
import { PlanLeftoversModal } from './plan-leftovers-modal';
import { vi } from 'vitest';

describe('PlanLeftoversModal', () => {
  let component: PlanLeftoversModal;
  let mealPlanStore: MealPlanStore;
  let cycleStore: PlanningCycleStore;
  let http: HttpTestingController;

  const meal: ApiPlannedEntry = {
    id: 'meal-1',
    kind: 'Meal',
    originalMealId: null,
    date: '2026-08-20',
    sortOrder: 0,
    recipe: {
      id: 'recipe-1',
      name: 'Pasta',
      category: 'Meals',
      imageUrl: null,
      tags: [],
      isFavorite: false,
    },
    recipeProfile: { id: 'profile-1', name: 'Default', servings: 4 },
    hasReviewedGroceries: false,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [PlanLeftoversModal],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PlanLeftoversModal);
    component = fixture.componentInstance;
    mealPlanStore = TestBed.inject(MealPlanStore);
    cycleStore = TestBed.inject(PlanningCycleStore);
    http = TestBed.inject(HttpTestingController);
    cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-19',
      endDate: '2026-08-23',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    mealPlanStore.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [
        meal,
        {
          ...meal,
          id: 'leftover-1',
          kind: 'Leftover',
          originalMealId: meal.id,
          date: '2026-08-22',
        },
      ],
      notes: [],
    });
    component.meal.set(meal);
  });

  afterEach(() => http.verify());

  it('offers only later in-cycle days without an existing leftover', () => {
    expect(component.days().map((day) => day.date)).toEqual(['2026-08-21', '2026-08-23']);
  });

  it('preselects the first available day after the original meal', () => {
    const open = vi.fn();
    (component as unknown as { modal: () => { open: typeof open } }).modal = () => ({ open });

    component.open(meal);

    expect(component.selectedDate()).toBe('2026-08-21');
  });

  it('keeps the failure visible and restores submission after a server rejection', () => {
    component.selectedDate.set('2026-08-21');

    vi.spyOn(component.modal()!, 'open').mockImplementation(() => undefined);
    component.open(component.meal()!);
    component.selectedDate.set('2026-08-23');
    component.confirm();
    expect(component.saving()).toBe(true);
    http
      .expectOne('/api/planned-meals/meal-1/leftovers')
      .flush({ detail: 'Choose a later day.' }, { status: 400, statusText: 'Bad Request' });

    expect(component.saving()).toBe(false);
    expect(component.error()).toBe('Choose a later day.');
  });
});
