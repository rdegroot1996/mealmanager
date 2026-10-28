import { By } from '@angular/platform-browser';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlannerPage } from './planner-page';
import { provideRouter } from '@angular/router';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiPlannedEntry } from '../../../../api/models/api-meal-plan';
import { of, throwError } from 'rxjs';

describe('PlannerPage', () => {
  let component: PlannerPage;
  let fixture: ComponentFixture<PlannerPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlannerPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(PlannerPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps meal and note creation available on an empty day', () => {
    fixture.detectChanges();
    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-20',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.mealPlanStore.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [],
      notes: [],
    });
    component.loading.set(false);

    fixture.detectChanges();

    const day = fixture.nativeElement.querySelector('[data-testid="planning-day"]') as HTMLElement;

    const dayDate = day.querySelector('[data-testid="planning-day-date"]') as HTMLElement;
    expect(dayDate).not.toBeNull();

    expect(day.querySelector('.planning-day-meal')).toBeNull();
    expect(day.querySelector('.planning-day-note')).toBeNull();
    const dayActions = day.querySelector('.planning-day-actions') as HTMLElement;
    expect(dayActions).not.toBeNull();

    expect(dayActions.textContent).toContain('Add meal');
    expect(dayActions.textContent).toContain('Add note');
    expect(dayActions.querySelector('app-icon[name="add"]')).not.toBeNull();
    expect(dayActions.querySelectorAll('app-icon[name="add"]')).toHaveLength(2);
    expect(dayActions.querySelectorAll('.btn-ghost')).toHaveLength(2);
  });

  it('rejects leftover destinations on or before the original meal', () => {
    const original = createMeal('meal-1', '2026-08-20', false);
    const leftovers = createMeal('leftover-1', '2026-08-21', true);
    leftovers.originalMealId = original.id;
    renderMeals([original, leftovers]);
    expect(component.canMoveToDate(original.date, leftovers)).toBe(false);
    expect(component.canMoveToDate('2026-08-19', leftovers)).toBe(false);
    expect(component.canMoveToDate('2026-08-22', leftovers)).toBe(true);
  });

  it('keeps notes visible without rendering a meal section', () => {
    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-20',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.mealPlanStore.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [],
      notes: [{ id: 'note-1', date: '2026-08-20', text: 'Meals away' }],
    });
    component.loading.set(false);

    fixture.detectChanges();

    const day = fixture.nativeElement.querySelector('[data-testid="planning-day"]') as HTMLElement;
    expect(fixture.nativeElement.textContent).toContain('Meals away');
    const noteRow = day.querySelector('.planning-day-note') as HTMLElement;
    expect(noteRow).not.toBeNull();

    expect(noteRow.querySelector('button[aria-label="Edit note"]')).not.toBeNull();
    expect(noteRow.querySelector('app-action-dialog')).toBeNull();

    expect(day.querySelector('.planning-day-meal')).toBeNull();
    expect(day.querySelector('.planning-day-content-divider')).toBeNull();
  });

  it('groups notes and meals in order without an extra divider', () => {
    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-20',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.mealPlanStore.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [createMeal('meal-1', '2026-08-20', false)],
      notes: [{ id: 'note-1', date: '2026-08-20', text: 'Meals away' }],
    });
    component.loading.set(false);

    fixture.detectChanges();

    const day = fixture.nativeElement.querySelector('[data-testid="planning-day"]') as HTMLElement;
    const note = day.querySelector('.planning-day-note')!;
    const meal = day.querySelector('.planning-day-meal')!;
    expect(note.compareDocumentPosition(meal) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(day.querySelector('.planning-day-content-divider')).toBeNull();
  });

  it('opens the note modal with the existing note when editing', () => {
    const note = { id: 'note-1', date: '2026-08-20', text: 'Meals away' };
    fixture.detectChanges();
    const open = vi.spyOn(component.addNoteModal()!, 'open').mockImplementation(() => undefined);

    component.editNote(note);

    expect(open).toHaveBeenCalledWith(note.date, note);
  });

  it('renders distinct timeline states without muting upcoming cards', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 21, 12));
    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-22',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.mealPlanStore.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [],
      notes: [],
    });
    component.loading.set(false);

    fixture.detectChanges();

    const days = fixture.nativeElement.querySelectorAll('[data-testid="planning-day"]');
    expect(days[1].textContent).toContain('Today');

    expect(days[0].querySelector('[data-testid="planning-day-date"] .opacity-60')).toBeNull();
  });

  it('renders compact meal metadata and responsive grocery and leftover states', () => {
    const unconfirmedMeal = createMeal('meal-1', '2026-08-20', false);
    unconfirmedMeal.recipeProfile = { id: 'profile-1', name: 'Family', servings: 4 };
    const confirmedMeal = createMeal('meal-2', '2026-08-20', false);
    confirmedMeal.sortOrder = 1;
    confirmedMeal.recipe.name = 'Lasagna';
    confirmedMeal.hasReviewedGroceries = true;
    const leftovers = createMeal('leftover-1', '2026-08-21', true);
    leftovers.originalMealId = unconfirmedMeal.id;
    leftovers.sortOrder = 2;
    leftovers.recipe.name = 'Soup';
    renderMeals([unconfirmedMeal, confirmedMeal, leftovers]);

    const rows = fixture.nativeElement.querySelectorAll(
      '.planning-day-meal',
    ) as NodeListOf<HTMLElement>;
    expect(rows).toHaveLength(3);

    expect(rows[0].querySelector('app-recipe-summary')).not.toBeNull();

    expect(rows[0].querySelector('[data-testid="meal-mobile-divider"]')).toBeNull();
    const mealMetadata = rows[0].querySelector('[data-testid="recipe-meal-meta"]') as HTMLElement;
    expect(mealMetadata.querySelector('app-icon[name="group"]')).toBeNull();
    expect(mealMetadata.textContent).toContain('4');
    expect(mealMetadata.textContent).toContain('servings');
    expect(mealMetadata.textContent).toContain('·');
    expect(mealMetadata.textContent).toContain('Family');
    expect(rows[0].querySelector('[data-testid="recipe-meal-meta-pill"]')).toBeNull();

    const addGroceries = rows[0].querySelector(
      'button[aria-label="Review groceries for Pasta"]',
    ) as HTMLButtonElement;
    expect(
      fixture.debugElement
        .query(By.css('button[aria-label="Review groceries for Pasta"] app-icon'))
        .componentInstance.name(),
    ).toBe('shopping_cart');
    expect(addGroceries.textContent).toContain('Review');

    const status = rows[0].querySelector('[data-testid="meal-status"]') as HTMLElement;
    const menuContainer = rows[0].querySelector('[data-testid="meal-menu"]') as HTMLElement;
    expect(menuContainer.querySelector('app-action-dialog')).not.toBeNull();
    expect(rows[0].querySelector('.planning-meal-actions')?.contains(status)).toBe(true);

    const groceriesAdded = rows[1].querySelector(
      'button[aria-label="Edit grocery selection for Lasagna"]',
    ) as HTMLButtonElement;
    expect(
      fixture.debugElement
        .query(By.css('button[aria-label="Edit grocery selection for Lasagna"] app-icon'))
        .componentInstance.name(),
    ).toBe('check');
    expect(groceriesAdded.textContent).toContain('Reviewed');

    expect(rows[2].querySelector('[data-testid="recipe-status"] app-icon')).not.toBeNull();
    expect(rows[2].textContent).toContain('Leftovers');
    expect(rows[2].querySelector('[data-testid="meal-status"]')).toBeNull();
    expect(rows[2].querySelector('[data-testid="recipe-status"]')?.textContent).toContain(
      'Leftovers',
    );

    expect(rows[2].querySelector('button[aria-label*="groceries"]')).toBeNull();
    expect(rows[2].querySelector('[data-testid="recipe-meal-meta"]')).toBeNull();
    expect(rows[2].querySelector('app-action-dialog')).not.toBeNull();
    expect(rows[2].querySelectorAll('app-action-dialog li button')).toHaveLength(2);
    const remove = vi.spyOn(component, 'removeMeal').mockImplementation(async () => {});
    const removeLeftover = rows[2].querySelector(
      'app-action-dialog li:last-child button',
    ) as HTMLButtonElement;
    expect(removeLeftover.textContent).toContain('Remove leftovers');
    removeLeftover.click();
    expect(remove).toHaveBeenCalledWith(leftovers);
    expect(rows[2].querySelector('[data-testid="recipe-status"]')?.textContent).toContain(
      'Leftovers from Thursday',
    );
    expect(rows[2].querySelector('app-icon[name="corner_down_right"]')).not.toBeNull();
    const openMove = vi.spyOn(component, 'openMoveMeal').mockImplementation(() => {});
    const leftoverMove = rows[2].querySelector('app-action-dialog li button') as HTMLButtonElement;
    leftoverMove.click();
    expect(openMove).toHaveBeenCalledWith(leftovers);
    expect(rows[0].querySelector('[cdkDragHandle]')).toBeNull();
    expect(rows[2].querySelector('[cdkDragHandle]')).toBeNull();
  });

  it('keeps historical meal reviews and editing controls available', () => {
    const unreviewed = createMeal('meal-1', '2026-08-20', false);
    const reviewed = createMeal('meal-2', '2026-08-20', false);
    reviewed.hasReviewedGroceries = true;
    reviewed.sortOrder = 1;
    renderMeals([unreviewed, reviewed]);
    component.cycleStore.currentCycle.update((cycle) => ({
      ...cycle!,
      nextPlanningCycleId: 'next-cycle',
    }));
    fixture.detectChanges();

    const days = fixture.nativeElement.querySelector(
      '[data-testid="planning-timeline"]',
    ) as HTMLElement;
    const statuses = days.querySelectorAll('[data-testid="meal-status"]');
    expect(statuses[0].textContent).toContain('Review');
    expect(statuses[1].textContent).toContain('Reviewed');
    expect(days.querySelector('button')).not.toBeNull();
    expect(days.querySelector('.planning-day-actions')).not.toBeNull();
    expect(days.querySelector('app-action-dialog')).not.toBeNull();
    expect(days.querySelector('a[href^="/recipes/recipe-1?profile="]')).not.toBeNull();
  });

  it('opens the grocery dialog from the add-groceries button', () => {
    const meal = createMeal('meal-1', '2026-08-20', false);
    renderMeals([meal]);
    const open = vi
      .spyOn(component.mealGroceryReviewModal()!, 'open')
      .mockImplementation(() => undefined);

    const addGroceries = fixture.nativeElement.querySelector(
      'button[aria-label="Review groceries for Pasta"]',
    ) as HTMLButtonElement;
    addGroceries.click();

    expect(open).toHaveBeenCalledWith(meal);
  });

  it('opens the grocery dialog from the confirmed-groceries indicator', () => {
    const meal = createMeal('meal-1', '2026-08-20', false);
    meal.hasReviewedGroceries = true;
    renderMeals([meal]);
    const open = vi
      .spyOn(component.mealGroceryReviewModal()!, 'open')
      .mockImplementation(() => undefined);

    const groceriesAdded = fixture.nativeElement.querySelector(
      'button[aria-label="Edit grocery selection for Pasta"]',
    ) as HTMLButtonElement;
    groceriesAdded.click();

    expect(open).toHaveBeenCalledWith(meal);
  });

  it('places the first-cycle action inside the empty state', () => {
    component.cycleStore.currentCycle.set(null);
    component.loading.set(false);
    component.noCycle.set(true);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No planning cycle yet');
    expect(fixture.nativeElement.querySelector('app-empty-state button').textContent).toContain(
      'Start first cycle',
    );
    expect(fixture.nativeElement.querySelector('app-action-dialog')).toBeNull();
  });

  it('moves leftovers through the dialog at the end of the selected day', () => {
    const original = createMeal('meal-1', '2026-08-20', false);
    const leftovers = createMeal('leftover-1', '2026-08-21', true);
    leftovers.originalMealId = original.id;
    const other = createMeal('meal-2', '2026-08-22', false);
    renderMeals([original, leftovers, other]);
    component.cycleStore.currentCycle.update((cycle) => ({ ...cycle!, endDate: '2026-08-23' }));
    vi.spyOn(component.moveDialog(), 'open').mockImplementation(() => undefined);
    const move = vi
      .spyOn(component.mealPlanStore, 'moveEntry')
      .mockReturnValue(of(component.mealPlanStore.activeMealPlan()!));
    component.openMoveMeal(leftovers);
    component.changeMoveDate('2026-08-22');
    component.confirmMoveMeal();
    expect(move).toHaveBeenCalledWith(leftovers.id, '2026-08-22');
  });

  it('blocks an invalid leftover move draft without calling the API', () => {
    const original = createMeal('meal-1', '2026-08-20', false);
    const leftovers = createMeal('leftover-1', '2026-08-21', true);
    leftovers.originalMealId = original.id;
    renderMeals([original, leftovers]);
    component.cycleStore.currentCycle.update((cycle) => ({ ...cycle!, endDate: '2026-08-22' }));
    vi.spyOn(component.moveDialog(), 'open').mockImplementation(() => undefined);
    const move = vi.spyOn(component.mealPlanStore, 'moveEntry');
    component.openMoveMeal(leftovers);
    component.changeMoveDate(original.date);
    component.confirmMoveMeal();
    expect(move).not.toHaveBeenCalled();
  });

  it('appends within the same day through the move dialog', () => {
    const meal = createMeal('meal-1', '2026-08-20', false);
    const second = createMeal('meal-2', meal.date, false);
    const third = createMeal('meal-3', meal.date, false);
    second.sortOrder = 1;
    third.sortOrder = 2;
    renderMeals([meal, second, third]);
    vi.spyOn(component.moveDialog(), 'open').mockImplementation(() => undefined);
    const move = vi
      .spyOn(component.mealPlanStore, 'moveEntry')
      .mockReturnValue(of(component.mealPlanStore.activeMealPlan()!));
    component.openMoveMeal(meal);
    component.confirmMoveMeal();
    expect(move).toHaveBeenCalledWith(meal.id, meal.date);
  });

  it('moves from the options dialog to a valid day', () => {
    const meal = createMeal('meal-1', '2026-08-20', false);
    renderMeals([meal]);
    component.cycleStore.currentCycle.update((cycle) => ({ ...cycle!, endDate: '2026-08-22' }));
    const open = vi.spyOn(component.moveDialog(), 'open').mockImplementation(() => undefined);
    const close = vi.spyOn(component.moveDialog(), 'close');
    const move = vi
      .spyOn(component.mealPlanStore, 'moveEntry')
      .mockReturnValue(of(component.mealPlanStore.activeMealPlan()!));
    component.openMoveMeal(meal);
    expect(open).toHaveBeenCalledOnce();
    component.changeMoveDate('2026-08-21');
    component.confirmMoveMeal();
    expect(move).toHaveBeenCalledWith(meal.id, '2026-08-21');
    expect(close).toHaveBeenCalledOnce();
  });

  it('filters invalid leftover destinations and blocks stale or invalid move drafts', () => {
    const meal = createMeal('meal-1', '2026-08-20', false);
    const leftovers = createMeal('leftover-1', '2026-08-22', true);
    leftovers.originalMealId = meal.id;
    renderMeals([meal, leftovers]);
    component.cycleStore.currentCycle.update((cycle) => ({ ...cycle!, endDate: '2026-08-23' }));
    vi.spyOn(component.moveDialog(), 'open').mockImplementation(() => undefined);
    const move = vi.spyOn(component.mealPlanStore, 'moveEntry');
    component.openMoveMeal(meal);
    expect(component.moveDays().map((day) => day.date)).toEqual(['2026-08-20', '2026-08-21']);
    component.changeMoveDate('2026-08-24');
    component.confirmMoveMeal();
    component.changeMoveDate('2026-08-21');
    component.cycleStore.currentCycle.update((cycle) => ({ ...cycle!, id: 'another-cycle' }));
    component.confirmMoveMeal();
    expect(move).not.toHaveBeenCalled();
  });

  it('announces a dialog move and returns focus to the meal actions', () => {
    vi.useFakeTimers();
    const first = createMeal('meal-1', '2026-08-20', false);
    const second = createMeal('meal-2', first.date, false);
    second.sortOrder = 1;
    renderMeals([first, second]);
    vi.spyOn(component.moveDialog(), 'open').mockImplementation(() => undefined);
    const move = vi
      .spyOn(component.mealPlanStore, 'moveEntry')
      .mockReturnValue(of(component.mealPlanStore.activeMealPlan()!));
    component.openMoveMeal(first);
    component.confirmMoveMeal();
    vi.runAllTimers();
    expect(move).toHaveBeenCalledWith(first.id, first.date);
    expect(component.moveAnnouncement()).toContain('moved to Thursday.');
    expect(
      document.activeElement?.closest('[data-planning-entry]')?.getAttribute('data-planning-entry'),
    ).toBe(first.id);
  });

  it('rejects original-meal dates on or after linked leftovers', () => {
    const meal = createMeal('meal-1', '2026-08-20', false);
    const leftovers = createMeal('leftover-1', '2026-08-22', true);
    leftovers.originalMealId = meal.id;
    renderMeals([meal, leftovers]);
    expect(component.canMoveToDate('2026-08-21', meal)).toBe(true);
    expect(component.canMoveToDate(leftovers.date, meal)).toBe(false);
    expect(component.canMoveToDate('2026-08-23', meal)).toBe(false);
  });

  it('announces a move rejection and restores planner controls', () => {
    const meal = createMeal('meal-1', '2026-08-20', false);
    component.mealPlanStore.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries: [meal],
      notes: [],
    });
    vi.spyOn(component.mealPlanStore, 'moveEntry').mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            error: { detail: 'That ordering is no longer valid.' },
            status: 400,
          }),
      ),
    );
    const toast = vi.spyOn(component.toast, 'error');

    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: meal.date,
      endDate: '2026-08-21',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    vi.spyOn(component.moveDialog(), 'open').mockImplementation(() => undefined);
    component.openMoveMeal(meal);
    component.changeMoveDate('2026-08-21');
    component.confirmMoveMeal();

    expect(toast).toHaveBeenCalledWith('That ordering is no longer valid.');
    expect(component.mutationPending()).toBe(false);
  });

  it('keeps the cycle when deletion is cancelled', async () => {
    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-26',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    vi.spyOn(component.confirmationModal(), 'open').mockResolvedValue(false);
    const deleteCycle = vi.spyOn(component.cycleStore, 'deleteCycle');

    await component.deleteCycle();

    expect(deleteCycle).not.toHaveBeenCalled();
  });

  it('shows the empty state after deleting the last cycle', async () => {
    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-26',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    vi.spyOn(component.confirmationModal(), 'open').mockResolvedValue(true);
    vi.spyOn(component.cycleStore, 'deleteCycle').mockReturnValue(of(null));

    await component.deleteCycle();

    expect(component.noCycle()).toBe(true);
    expect(component.mealPlanStore.activeMealPlan()).toBeNull();
    expect(component.mutationPending()).toBe(false);
  });

  function createMeal(id: string, date: string, isLeftover: boolean): ApiPlannedEntry {
    return {
      id,
      kind: isLeftover ? 'Leftover' : 'Meal',
      originalMealId: null,
      date,
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
  }

  function renderMeals(entries: ApiPlannedEntry[]) {
    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-20',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.mealPlanStore.activeMealPlan.set({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      entries,
      notes: [],
    });
    component.loading.set(false);
    fixture.detectChanges();
  }
});
