import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActivePlanning } from './active-planning';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';

import { DashboardState } from '../../dashboard-state';

describe('ActivePlanning', () => {
  let component: ActivePlanning;
  let fixture: ComponentFixture<ActivePlanning>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ActivePlanning],
      providers: [
        DashboardState,
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ActivePlanning);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses a stable skeleton while loading', () => {
    component.loading.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="active-planning-skeleton"]'),
    ).not.toBeNull();
  });

  it('shows a quiet empty-cycle summary and a planner action', () => {
    component.loading.set(false);
    component.noCycle.set(false);
    component.error.set('');
    component.state.cycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-26',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.state.planning.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [],
      notes: [],
    });

    fixture.detectChanges();

    const planningSummary = fixture.nativeElement.querySelector(
      '[data-testid="active-planning-summary"]',
    ) as HTMLElement;
    const planningLink = fixture.nativeElement.querySelector('a[href="/planning"]') as HTMLElement;
    expect(planningSummary.tagName).toBe('DIV');
    expect(planningSummary.querySelector('a')).toBeNull();
    expect(planningSummary.textContent).not.toContain('review');
    expect(planningSummary.querySelector('[aria-hidden]')).toBeNull();
    expect(planningSummary.textContent).not.toContain('0/0');
    expect(planningLink.getAttribute('href')).toBe('/planning');
    expect(planningLink.textContent).toContain('Plan a meal');
    expect(planningLink.getAttribute('aria-label') ?? planningLink.textContent).toContain(
      'Plan a meal',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Nothing planned yet');
  });

  it('counts grocery review only for original meals', () => {
    component.loading.set(false);
    component.noCycle.set(false);
    component.state.cycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-26',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    const recipe = {
      id: 'recipe-1',
      name: 'Pasta',
      imageUrl: null,
      category: 'Meals' as const,
      tags: [],
      isFavorite: false,
    };
    component.state.planning.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [
        {
          id: 'meal-1',
          kind: 'Meal',
          originalMealId: null,
          date: '2026-08-20',
          sortOrder: 0,
          recipe,
          recipeProfile: { id: 'profile-1', name: 'Default', servings: 2 },
          hasGroceriesAdded: false,
        },
        {
          id: 'leftover-1',
          kind: 'Leftover',
          originalMealId: 'meal-1',
          date: '2026-08-21',
          sortOrder: 0,
          recipe,
          recipeProfile: { id: 'profile-1', name: 'Default', servings: 2 },
          hasGroceriesAdded: false,
        },
      ],
      notes: [],
    });

    fixture.detectChanges();

    expect(component.originalMeals()).toHaveLength(1);
    expect(component.reviewedMeals()).toBe(0);
    expect(component.plannedEntries()).toBe(2);
    expect(fixture.nativeElement.textContent.replace(/\s/g, ' ')).toContain('2 meals planned');
    expect(fixture.nativeElement.textContent.replace(/\s/g, ' ')).toContain('0 reviewed');
    expect(fixture.nativeElement.textContent).toContain('Go to planner');
  });
});
