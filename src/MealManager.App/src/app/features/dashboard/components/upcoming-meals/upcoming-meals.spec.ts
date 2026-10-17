import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { UpcomingMeals } from './upcoming-meals';

import { DashboardState } from '../../dashboard-state';

describe('UpcomingMeals', () => {
  let component: UpcomingMeals;
  let fixture: ComponentFixture<UpcomingMeals>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [UpcomingMeals],
      providers: [DashboardState, provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(UpcomingMeals);
    component = fixture.componentInstance;
    component.state.today.set('2099-01-01');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses row-shaped placeholders while loading', () => {
    component.state.upcomingLoading.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="upcoming-meals-skeleton"]'),
    ).not.toBeNull();
  });

  it('starts its calendar today independently of a future active cycle and marks dates beyond the three meals', () => {
    component.state.cycle.set({
      id: 'future',
      startDate: '2099-02-01',
      endDate: '2099-02-07',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.state.upcoming.set({
      fromDate: '2099-01-01',
      entries: [],
      plannedDates: ['2099-01-01', '2099-01-07'],
    });
    expect(component.previewDays().map((day) => day.date)).toEqual([
      '2099-01-01',
      '2099-01-02',
      '2099-01-03',
      '2099-01-04',
      '2099-01-05',
      '2099-01-06',
      '2099-01-07',
    ]);
    expect(
      component
        .previewDays()
        .filter((day) => day.hasMeal)
        .map((day) => day.date),
    ).toEqual(['2099-01-01', '2099-01-07']);
  });

  it('shows seven days from today even without upcoming meals', () => {
    component.state.upcomingLoading.set(false);
    component.state.cycle.set({
      id: 'cycle-1',
      startDate: '2099-01-01',
      endDate: '2099-01-07',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.state.upcoming.set({
      fromDate: '2099-01-01',
      plannedDates: [],
      entries: [],
    });

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="upcoming-day-preview"]'),
    ).toHaveLength(7);
    expect(fixture.nativeElement.textContent).toContain('No meals coming up yet.');
    expect(fixture.nativeElement.querySelector('a[href="/planner"]')).not.toBeNull();
  });

  it('shows the meal plan calendar alongside dated meal summaries', () => {
    component.state.cycle.set({
      id: 'cycle-1',
      startDate: '2099-01-01',
      endDate: '2099-01-07',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.state.upcoming.set({
      fromDate: '2099-01-01',
      plannedDates: ['2099-01-02'],
      entries: [
        {
          id: 'meal-1',
          kind: 'Meal',
          originalMealId: null,
          date: '2099-01-02',
          sortOrder: 0,
          recipe: {
            id: 'recipe-1',
            name: 'Pasta',
            imageUrl: null,
            category: 'Meals',
            tags: [],
            isFavorite: false,
          },
          recipeProfile: { id: 'profile-1', name: 'Family', servings: 4 },
          hasReviewedGroceries: false,
        },
      ],
    });
    fixture.detectChanges();

    const row = fixture.nativeElement.querySelector('a[aria-label="View recipe Pasta"]');
    const date = row.querySelector('[summary-eyebrow]') as HTMLElement;
    const summary = row.querySelector('app-recipe-summary') as HTMLElement;

    expect(date.textContent).toContain(component.mealWeekday('2099-01-02'));
    expect(date.textContent).toContain(component.upcomingMonth('2099-01-02'));
    expect(row.querySelector('app-recipe-summary').contains(date)).toBe(true);
    expect(summary.textContent).toContain('Pasta');
    expect(fixture.nativeElement.querySelector('a[href="/planner"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="upcoming-calendar"]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelectorAll('[data-testid="upcoming-day-preview"]'),
    ).toHaveLength(7);
    expect(
      fixture.nativeElement.querySelector('[data-testid="upcoming-day-status"].bg-primary'),
    ).not.toBeNull();
    const calendar = fixture.nativeElement.querySelector('[data-testid="upcoming-calendar"]');
    expect(calendar.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(fixture.nativeElement.textContent).not.toContain('No meals coming up yet.');
  });

  it('uses the same compact pill styling for leftovers and meal metadata', () => {
    component.state.upcoming.set({
      fromDate: '2099-01-01',
      plannedDates: ['2099-01-02'],
      entries: [
        {
          id: 'leftover-1',
          kind: 'Leftover',
          originalMealId: 'meal-1',
          date: '2099-01-02',
          sortOrder: 0,
          recipe: {
            id: 'recipe-1',
            name: 'Pasta',
            imageUrl: null,
            category: 'Meals',
            tags: [],
            isFavorite: false,
          },
          recipeProfile: { id: 'profile-1', name: 'Family', servings: 4 },
          hasReviewedGroceries: false,
        },
      ],
    });
    fixture.detectChanges();

    const metadata = fixture.nativeElement.querySelector(
      '[data-testid="recipe-meal-meta"]',
    ) as HTMLElement;
    const leftovers = fixture.nativeElement.querySelector(
      '[data-testid="recipe-status"]',
    ) as HTMLElement;

    expect(leftovers.textContent).toContain('Leftovers');
    expect(metadata).toBeNull();
    expect(fixture.nativeElement.querySelector('app-leftover-badge')).not.toBeNull();
  });
});
