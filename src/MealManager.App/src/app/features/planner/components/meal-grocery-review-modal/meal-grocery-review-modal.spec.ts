import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MealGroceryReviewModal } from './meal-grocery-review-modal';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { GrocerySelectItem } from '../../models/grocery-select-item';

describe('MealGroceryReviewModal', () => {
  let component: MealGroceryReviewModal;
  let fixture: ComponentFixture<MealGroceryReviewModal>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MealGroceryReviewModal],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MealGroceryReviewModal);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('moves purchase groceries between sections with the keyboard', () => {
    const item: GrocerySelectItem = {
      id: 'item-1',
      recipeProfileGroceryItemId: 'item-1',
      name: 'Pasta',
      quantity: 1,
      selected: true,
      atHome: false,
      purchaseOrder: 0,
    };
    component.neededItems.set([item]);

    component.moveItemWithKeyboard(item, 1);

    expect(component.neededItems()).toEqual([]);
    expect(component.atHomeItems()[0]).toEqual(
      expect.objectContaining({ id: item.id, atHome: true }),
    );
    expect(component.reorderAnnouncement()).toContain('position 1');
  });

  it('removes a purchase draft item without removing unrelated groceries and guards saving', () => {
    const item: GrocerySelectItem = {
      id: 'one',
      recipeProfileGroceryItemId: null,
      name: 'Pasta',
      quantity: 2,
      selected: true,
      atHome: false,
      purchaseOrder: 0,
    };
    const other = { ...item, id: 'two', name: 'Rice' };
    component.neededItems.set([item, other]);
    component.saving.set(true);
    component.removeItem(item);
    expect(component.neededItems()).toEqual([item, other]);
    component.saving.set(false);
    component.removeItem(item);
    expect(component.neededItems()).toEqual([other]);
    component.atHomeItems.set([{ ...item, atHome: true }]);
    component.removeItem(item);
    expect(component.atHomeItems()).toEqual([]);
  });

  it('matches substituted groceries and protects review selection, group, and profile-update changes', async () => {
    const meal = {
      id: 'meal-1',
      kind: 'Meal' as const,
      originalMealId: null,
      date: '2026-08-22',
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
      hasReviewedGroceries: true,
    };

    vi.spyOn(component.modal()!, 'open').mockImplementation(() => undefined);
    component.open(meal);
    http.expectOne('/api/recipe-profiles/profile-1').flush({
      id: 'profile-1',
      name: 'Default',
      servings: 4,
      groceries: [{ id: 'item-1', name: 'Bell pepper', quantity: 1, atHome: false }],
    });
    http.expectOne('/api/planned-meals/meal-1/groceries').flush({
      meal: {
        id: 'meal-1',
        date: '2026-08-22',
        recipeId: 'recipe-1',
        recipeName: 'Pasta',
        recipeImageUrl: '',
        profileName: 'Default',
        profileServings: 4,
      },
      items: [
        {
          id: 'grocery-1',
          recipeProfileGroceryItemId: 'item-1',
          name: 'Zucchini',
          quantity: 2,
          order: 0,
          checked: false,
          plannedMealId: 'meal-1',
        },
      ],
    });

    expect(component.neededItems()).toEqual([
      {
        id: 'item-1',
        recipeProfileGroceryItemId: 'item-1',
        name: 'Zucchini',
        quantity: 2,
        selected: true,
        atHome: false,
        purchaseOrder: 0,
      },
    ]);
    const discard = vi.spyOn(component.discardModal(), 'confirmDiscard').mockResolvedValue(false);
    expect(await component.beforeDismiss()).toBe(true);
    const item = component.neededItems()[0];
    component.toggleItem(item);
    expect(await component.beforeDismiss()).toBe(false);
    component.toggleItem(component.neededItems()[0]);
    expect(await component.beforeDismiss()).toBe(true);
    component.updateReusableProfile.set(true);
    expect(await component.beforeDismiss()).toBe(false);
    component.updateReusableProfile.set(false);
    component.moveItemWithKeyboard(component.neededItems()[0], 1);
    expect(await component.beforeDismiss()).toBe(false);
    expect(component.atHomeItems()[0].name).toBe('Zucchini');
    expect(discard).toHaveBeenCalledTimes(3);
  });

  it.each([false, true])(
    'defaults Needed groceries only before the first review (reviewed=%s)',
    (reviewed) => {
      vi.spyOn(component.modal()!, 'open').mockImplementation(() => undefined);
      component.open({
        id: 'meal',
        kind: 'Meal',
        originalMealId: null,
        date: '2026-09-08',
        sortOrder: 0,
        recipe: {
          id: 'r',
          name: 'Pasta',
          category: 'Meals',
          imageUrl: null,
          tags: [],
          isFavorite: false,
        },
        recipeProfile: { id: 'profile', name: 'Default', servings: 2 },
        hasReviewedGroceries: reviewed,
      });
      http.expectOne('/api/recipe-profiles/profile').flush({
        id: 'profile',
        name: 'Default',
        servings: 2,
        groceries: [{ id: 'p', name: 'Pasta', quantity: 1, atHome: false }],
      });
      http.expectOne('/api/planned-meals/meal/groceries').flush({ items: [] });
      expect(component.neededItems()[0].selected).toBe(!reviewed);
      expect(component.confirmLabel()).toBe(
        reviewed ? 'Confirm nothing to buy' : 'Add 1 item to shopping list',
      );
      // Counts represent item rows, not the number of packs in a row.
      component.saveEditing(component.neededItems()[0], { name: 'Pasta', quantity: 10 });
      if (reviewed) component.toggleItem(component.neededItems()[0]);
      component.addManualItem({ name: 'Salt', quantity: 2 }, true);
      expect(component.selectedItemCount()).toBe(2);
      expect(component.confirmLabel()).toBe(
        reviewed ? 'Update shopping list' : 'Add 2 items to shopping list',
      );
      component.toggleItem(component.neededItems()[0]);
      component.toggleItem(component.atHomeItems()[0]);
      expect(component.confirmLabel()).toBe('Confirm nothing to buy');
    },
  );

  it('keeps both drop zones visible and moves a item between them', () => {
    const pasta: GrocerySelectItem = {
      id: 'item-1',
      recipeProfileGroceryItemId: 'item-1',
      name: 'Pasta',
      quantity: 1,
      selected: true,
      atHome: false,
      purchaseOrder: null,
    };
    component.meal.set({
      id: 'meal-1',
      kind: 'Meal',
      originalMealId: null,
      date: '2026-08-22',
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
    });
    component.neededItems.set([pasta]);
    component.atHomeItems.set([]);
    component.loaded.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Usually at home');
    component.dropItem(
      {
        previousContainer: { data: component.neededItems() },
        container: { data: component.atHomeItems() },
        previousIndex: 0,
        currentIndex: 0,
      } as CdkDragDrop<GrocerySelectItem[]>,
      true,
    );

    expect(component.neededItems()).toEqual([]);
    expect(component.atHomeItems()).toEqual([{ ...pasta, atHome: true }]);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('distinguishes a loaded empty profile from a failed load', () => {
    component.meal.set({
      id: 'meal-1',
      kind: 'Meal',
      originalMealId: null,
      date: '2026-08-22',
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
    });
    component.loaded.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Confirm nothing to buy');

    component.loaded.set(false);
    component.error.set('The meal groceries could not be loaded.');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).not.toContain(
      'You can still confirm to record that there is nothing to buy.',
    );
    expect(fixture.nativeElement.textContent).toContain('The meal groceries could not be loaded.');
  });

  it('keeps manual item entry and profile updates optional and compact', () => {
    component.meal.set({
      id: 'meal-1',
      kind: 'Meal',
      originalMealId: null,
      date: '2026-08-22',
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
    });
    component.loadedProfile.set({
      id: 'profile-1',
      name: 'Default',
      servings: 4,
      groceries: [],
    });
    component.loaded.set(true);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="Item name"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[aria-label="Add item to Needed"]')).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Add item to Usually at home"]'),
    ).not.toBeNull();
    expect(component.updateReusableProfile()).toBe(false);

    const open = vi.spyOn(component.itemEditor(), 'openNew').mockImplementation(() => {});
    component.startAddItem('needed');
    fixture.detectChanges();
    expect(component.addingItemTo()).toBe('needed');
    expect(open).toHaveBeenCalledOnce();
    expect(fixture.nativeElement.textContent).not.toContain('Add an item for this purchase');
    expect(fixture.nativeElement.textContent).toContain('Also update profile “Default”');
  });

  it('uses section defaults for newly added purchase items', () => {
    component.addManualItem({ name: 'Basil', quantity: 1 }, false);
    component.addManualItem({ name: 'Salt', quantity: 1 }, true);

    expect(component.neededItems()[0]).toEqual(
      expect.objectContaining({ name: 'Basil', selected: true, atHome: false }),
    );
    expect(component.atHomeItems()[0]).toEqual(
      expect.objectContaining({ name: 'Salt', selected: true, atHome: true }),
    );
  });

  it('uses the promoted profile-grocery identifier for the current purchase', () => {
    component.meal.set({
      id: 'meal-1',
      kind: 'Meal',
      originalMealId: null,
      date: '2026-08-22',
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
    });
    component.loadedProfile.set({ id: 'profile-1', name: 'Default', servings: 4, groceries: [] });
    component.neededItems.set([
      {
        id: 'manual-1',
        recipeProfileGroceryItemId: null,
        name: 'Croutons',
        quantity: 1,
        selected: true,
        atHome: false,
        purchaseOrder: null,
      },
    ]);
    component.updateReusableProfile.set(true);
    const saveProfile = vi
      .spyOn(component.recipesStore, 'saveProfile')
      .mockImplementation((profile) => of(profile));
    const reviewMealGroceries = vi
      .spyOn(component.mealPlanStore, 'reviewMealGroceries')
      .mockReturnValue(
        of({ id: 'planning-1', planningCycleId: 'cycle-1', entries: [], notes: [] }),
      );
    vi.spyOn(component.modal()!, 'close').mockImplementation(() => undefined);
    const toast = vi.spyOn(component.toast, 'success');

    component.loaded.set(true);
    component.confirm();

    const recipeProfileGroceryItemId = saveProfile.mock.calls[0][0].groceries[0].id;
    expect(recipeProfileGroceryItemId).toBeTruthy();
    expect(reviewMealGroceries.mock.calls[0][1][0].recipeProfileGroceryItemId).toBe(
      recipeProfileGroceryItemId,
    );
    expect(toast).toHaveBeenCalledWith('Profile "Default" updated.');
  });

  it('does not show a profile-update toast when the reusable profile is unchanged', () => {
    component.meal.set({
      id: 'meal-1',
      kind: 'Meal',
      originalMealId: null,
      date: '2026-08-22',
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
    });
    component.loadedProfile.set({ id: 'profile-1', name: 'Default', servings: 4, groceries: [] });
    vi.spyOn(component.mealPlanStore, 'reviewMealGroceries').mockReturnValue(
      of({ id: 'planning-1', planningCycleId: 'cycle-1', entries: [], notes: [] }),
    );
    vi.spyOn(component.modal()!, 'close').mockImplementation(() => undefined);
    const toast = vi.spyOn(component.toast, 'success');

    component.confirm();

    expect(toast).not.toHaveBeenCalled();
  });

  it('retains saved item IDs and explains partial success before a grocery retry', () => {
    component.meal.set({
      id: 'meal',
      kind: 'Meal',
      originalMealId: null,
      date: '2026-08-22',
      sortOrder: 0,
      recipe: {
        id: 'recipe',
        name: 'Pasta',
        category: 'Meals',
        imageUrl: null,
        tags: [],
        isFavorite: false,
      },
      recipeProfile: { id: 'profile', name: 'Default', servings: 2 },
      hasReviewedGroceries: false,
    });
    component.loadedProfile.set({ id: 'profile', name: 'Default', servings: 2, groceries: [] });
    component.neededItems.set([
      {
        id: 'manual',
        recipeProfileGroceryItemId: null,
        name: 'Basil',
        quantity: 1,
        atHome: false,
        selected: true,
        purchaseOrder: null,
      },
    ]);
    component.loaded.set(true);
    component.updateReusableProfile.set(true);
    const save = vi
      .spyOn(component.recipesStore, 'saveProfile')
      .mockImplementation((profile) => of(profile));
    const groceries = vi
      .spyOn(component.mealPlanStore, 'reviewMealGroceries')
      .mockReturnValueOnce(throwError(() => new Error('Request failed')))
      .mockReturnValueOnce(
        of({ id: 'mealPlan', planningCycleId: 'cycle', entries: [], notes: [] }),
      );
    const close = vi.spyOn(component.modal()!, 'close').mockImplementation(() => {});
    component.confirm();
    expect(component.error()).toContain('The profile was updated.');
    expect(close).not.toHaveBeenCalled();
    const groceryItemId = save.mock.calls[0][0].groceries[0].id;
    expect(component.neededItems()[0].recipeProfileGroceryItemId).toBe(groceryItemId);
    component.confirm();
    expect(save.mock.calls[1][0].groceries[0].id).toBe(groceryItemId);
    expect(groceries.mock.calls[1][1][0].recipeProfileGroceryItemId).toBe(groceryItemId);
    expect(close).toHaveBeenCalledOnce();
  });
});
