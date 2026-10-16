import { ApiPlannedEntry } from '../../../../api/models/api-meal-plan';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ShoppingListPage } from './shopping-list-page';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { of, Subject, throwError } from 'rxjs';

describe('ShoppingListPage', () => {
  let component: ShoppingListPage;
  let fixture: ComponentFixture<ShoppingListPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ShoppingListPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(ShoppingListPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  afterEach(() => vi.useRealTimers());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses singular and plural grocery counts', () => {
    expect(component.itemCountLabel(1)).toBe('1 item');
    expect(component.itemCountLabel(2)).toBe('2 items');
  });

  it('keeps a reviewed meal visible and allows adding an item when nothing is needed', () => {
    component.shoppingListStore.shoppingList.set({
      id: 'list',
      planningCycleId: 'cycle',
      items: [],
      mealGroups: [
        {
          meal: {
            id: 'meal',
            date: '2026-10-11',
            recipeId: 'recipe',
            recipeName: 'Pasta',
            recipeImageUrl: '',
            profileName: 'Family',
            profileServings: 4,
          },
          items: [],
        },
      ],
    });
    component.loading.set(false);
    fixture.detectChanges();
    const mealGroup = fixture.nativeElement.querySelector('.app-grocery-group') as HTMLElement;
    expect(mealGroup.querySelector('a')?.getAttribute('href')).toBe('/recipes/recipe');
    expect(mealGroup.textContent).toContain('Family');
    expect(mealGroup.textContent).toContain('4');
    expect(mealGroup.textContent).toContain('No groceries needed for this meal.');
    const open = vi.spyOn(component.itemEditor(), 'openNew').mockImplementation(() => {});
    mealGroup.querySelector('button')!.click();
    expect(open).toHaveBeenCalledOnce();
    expect(component.addingToMealId()).toBe('meal');
    expect(component.itemEditorContext()).toBe('Pasta');
  });

  it('debounces suggestions, cancels stale reads and allows recovery after errors', () => {
    vi.useFakeTimers();
    const pending = new Subject<string[]>();
    const query = vi
      .spyOn(component.shoppingListStore, 'suggestNames')
      .mockReturnValueOnce(pending)
      .mockReturnValueOnce(throwError(() => new Error('Offline')))
      .mockReturnValue(of(['wc papier']));
    component.suggestNames(' w ');
    expect(component.nameSuggestionsLoading()).toBe(true);
    component.suggestNames(' wc ');
    vi.advanceTimersByTime(150);
    expect(query).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenLastCalledWith('wc');
    component.suggestNames('milk');
    pending.next(['stale']);
    expect(component.nameSuggestions()).toEqual([]);
    vi.advanceTimersByTime(150);
    expect(component.nameSuggestions()).toEqual([]);
    component.suggestNames('wc');
    vi.advanceTimersByTime(150);
    expect(component.nameSuggestions()).toEqual(['wc papier']);
    expect(component.nameSuggestionsLoading()).toBe(false);
    expect(component.nameSuggestionsError()).toBe(false);
    component.suggestNames('');
    expect(component.nameSuggestions()).toEqual([]);
  });

  it('adds a meal item from the dialog without redundant success feedback', () => {
    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-26',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    const addMealItem = vi.spyOn(component.shoppingListStore, 'addMealItem').mockReturnValue(
      of({
        id: 'list-1',
        planningCycleId: 'cycle-1',
        mealGroups: [],
        items: [],
      }),
    );
    const success = vi.spyOn(component.toast, 'success');
    vi.spyOn(component.itemEditor(), 'openNew').mockImplementation(() => {});
    component.startAddMealItem('meal-1');

    component.addItem({ name: 'Tomatoes', quantity: 2 });

    expect(addMealItem).toHaveBeenCalledWith('cycle-1', 'meal-1', 'Tomatoes', 2);
    expect(component.addingToMealId()).toBeNull();
    expect(success).not.toHaveBeenCalled();
  });

  it('reveals the shared editor for Other items on demand', () => {
    component.loading.set(false);
    fixture.detectChanges();
    const sectionTitles = Array.from<HTMLElement>(
      fixture.nativeElement.querySelectorAll('h2:not(dialog h2)'),
    );
    const emptyState = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('p')).find(
      (paragraph) => paragraph.textContent?.includes('No other items yet.'),
    );
    const manualItemsGroup = emptyState?.closest('.app-grocery-group') as HTMLElement;
    expect(sectionTitles.every((heading) => heading.classList.contains('app-section-title'))).toBe(
      true,
    );
    expect(emptyState?.classList).toContain('text-sm');
    expect(manualItemsGroup).not.toBeNull();
    const open = vi.spyOn(component.itemEditor(), 'openNew').mockImplementation(() => {});

    component.startAddManualItem();
    fixture.detectChanges();

    expect(open).toHaveBeenCalledOnce();
    expect(component.addingToMealId()).toBeNull();
  });

  it('preserves the add draft after a failed save and closes only after a successful retry', () => {
    component.cycleStore.currentCycle.set({
      id: 'c',
      startDate: '2026-10-10',
      endDate: '2026-10-16',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    vi.spyOn(component.itemEditor(), 'openNew').mockImplementation(() => {});
    const close = vi.spyOn(component.itemEditor(), 'close').mockImplementation(() => {});
    vi.spyOn(component.shoppingListStore, 'addManualItem')
      .mockReturnValueOnce(throwError(() => new Error('Offline')))
      .mockReturnValue(of({ id: 'l', planningCycleId: 'c', items: [], mealGroups: [] }));
    component.startAddManualItem();
    component.addItem({ name: 'Rice', quantity: 2 });
    expect(component.itemSaveError()).toBeTruthy();
    expect(close).not.toHaveBeenCalled();
    expect(component.addingItem()).toBe(false);
    component.addItem({ name: 'Rice', quantity: 2 });
    expect(close).toHaveBeenCalledOnce();
  });

  it('does not show a late error after the add session has been dismissed', () => {
    component.cycleStore.currentCycle.set({
      id: 'c',
      startDate: '2026-10-10',
      endDate: '2026-10-16',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    vi.spyOn(component.itemEditor(), 'openNew').mockImplementation(() => {});
    const pending = new Subject<null>();
    vi.spyOn(component.shoppingListStore, 'addManualItem').mockReturnValue(pending);
    component.startAddManualItem();
    component.addItem({ name: 'Rice', quantity: 2 });
    component.endItemEditor();
    pending.error(new Error('Offline'));
    expect(component.itemSaveError()).toBeNull();
  });

  it('reorders an item with the keyboard and announces its new position', () => {
    vi.useFakeTimers();
    const first = {
      id: 'item-1',
      name: 'Apples',
      quantity: 1,
      order: 0,
      checked: false,
      plannedMealId: null,
    };
    const second = { ...first, id: 'item-2', name: 'Bread', order: 1 };
    component.shoppingListStore.shoppingList.set({
      id: 'list-1',
      planningCycleId: 'cycle-1',
      mealGroups: [],
      items: [first, second],
    });
    component.loading.set(false);
    fixture.detectChanges();
    const reorder = vi
      .spyOn(component.shoppingListStore, 'reorderItems')
      .mockReturnValue(of(component.shoppingListStore.shoppingList()));

    component.moveItemWithKeyboard(first, 1, null);
    vi.runAllTimers();

    expect(reorder).toHaveBeenCalledWith(null, ['item-2', 'item-1']);
    expect(component.reorderAnnouncement()).toContain('position 2');
    expect(document.activeElement?.getAttribute('data-item-handle')).toBe(first.id);
  });
});

describe('ShoppingListPage review notice', () => {
  let page: ShoppingListPage;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideRouter([])] });
    page = TestBed.runInInjectionContext(() => new ShoppingListPage());
  });

  it('describes missing review explicitly for one or several active-cycle meals', () => {
    expect(page.unconfirmedMealsMessage(1)).toBe("Groceries for 1 meal haven't been reviewed yet.");
    expect(page.unconfirmedMealsMessage(2)).toBe(
      "Groceries for 2 meals haven't been reviewed yet.",
    );
  });

  it('describes historical reviews in the past tense', () => {
    page.cycleStore.currentCycle.set({
      id: 'old',
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      previousPlanningCycleId: null,
      nextPlanningCycleId: 'active',
    });
    expect(page.unconfirmedMealsMessage(1)).toBe('Groceries for 1 meal were not reviewed.');
    expect(page.unconfirmedMealsMessage(2)).toBe('Groceries for 2 meals were not reviewed.');
  });

  it('does not warn for confirmed empty reviews or derived leftovers', () => {
    // The notice follows review status, irrespective of how many groceries were selected.
    const entries = [
      { kind: 'Meal', hasReviewedGroceries: true },
      { kind: 'Leftover', hasReviewedGroceries: false },
      { kind: 'Meal', hasReviewedGroceries: false },
    ] as ApiPlannedEntry[];
    page.shoppingListStore.mealPlan.set({ id: 'p', planningCycleId: 'c', notes: [], entries });
    expect(page.unconfirmedMealCount()).toBe(1);
    page.shoppingListStore.mealPlan.set({
      id: 'p',
      planningCycleId: 'c',
      notes: [],
      entries: entries.slice(0, 2),
    });
    expect(page.unconfirmedMealCount()).toBe(0);
  });
});
