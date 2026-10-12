import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MealGroceriesFormModal } from './meal-groceries-form-modal';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of, throwError } from 'rxjs';
import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { GrocerySelectItem } from '../../models/grocery-select-item';

describe('MealGroceriesFormModal', () => {
  let component: MealGroceriesFormModal;
  let fixture: ComponentFixture<MealGroceriesFormModal>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MealGroceriesFormModal],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(MealGroceriesFormModal);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('moves purchase products between sections with the keyboard', () => {
    const product: GrocerySelectItem = {
      id: 'product-1',
      recipeProfileProductId: 'product-1',
      name: 'Pasta',
      quantity: 1,
      selected: true,
      atHome: false,
      purchaseOrder: 0,
    };
    component.neededItems.set([product]);

    component.moveItemWithKeyboard(product, 1);

    expect(component.neededItems()).toEqual([]);
    expect(component.atHomeItems()[0]).toEqual(
      expect.objectContaining({ id: product.id, atHome: true }),
    );
    expect(component.reorderAnnouncement()).toContain('position 1');
  });

  it('removes a purchase draft product without removing unrelated products and guards saving', () => {
    const product: GrocerySelectItem = {
      id: 'one',
      recipeProfileProductId: null,
      name: 'Pasta',
      quantity: 2,
      selected: true,
      atHome: false,
      purchaseOrder: 0,
    };
    const other = { ...product, id: 'two', name: 'Rice' };
    component.neededItems.set([product, other]);
    component.saving.set(true);
    component.removeItem(product);
    expect(component.neededItems()).toEqual([product, other]);
    component.saving.set(false);
    component.removeItem(product);
    expect(component.neededItems()).toEqual([other]);
    component.atHomeItems.set([{ ...product, atHome: true }]);
    component.removeItem(product);
    expect(component.atHomeItems()).toEqual([]);
  });

  it('matches a substituted grocery by its stable profile-product identifier', () => {
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
      hasGroceriesAdded: true,
    };

    vi.spyOn(component.modal()!, 'open').mockImplementation(() => undefined);
    component.open(meal);
    http.expectOne('/api/recipe-profiles/profile-1').flush({
      id: 'profile-1',
      name: 'Default',
      servings: 4,
      products: [{ id: 'product-1', name: 'Bell pepper', quantity: 1, atHome: false }],
    });
    http.expectOne('/api/planning-meals/meal-1/groceries').flush({
      planningMeal: {
        id: 'meal-1',
        date: '2026-08-22',
        recipeId: 'recipe-1',
        recipeName: 'Pasta',
        recipeImageUrl: '',
        profileName: 'Default',
        profileServings: 4,
      },
      groceries: [
        {
          id: 'grocery-1',
          recipeProfileProductId: 'product-1',
          name: 'Zucchini',
          quantity: 2,
          order: 0,
          checked: false,
          planningMealId: 'meal-1',
        },
      ],
    });

    expect(component.neededItems()).toEqual([
      {
        id: 'product-1',
        recipeProfileProductId: 'product-1',
        name: 'Zucchini',
        quantity: 2,
        selected: true,
        atHome: false,
        purchaseOrder: 0,
      },
    ]);
  });

  it.each([false, true])(
    'defaults Needed products only before the first review (reviewed=%s)',
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
        hasGroceriesAdded: reviewed,
      });
      http.expectOne('/api/recipe-profiles/profile').flush({
        id: 'profile',
        name: 'Default',
        servings: 2,
        products: [{ id: 'p', name: 'Pasta', quantity: 1, atHome: false }],
      });
      http.expectOne('/api/planning-meals/meal/groceries').flush({ groceries: [] });
      expect(component.neededItems()[0].selected).toBe(!reviewed);
    },
  );

  it('keeps both drop zones visible and moves a product between them', () => {
    const pasta: GrocerySelectItem = {
      id: 'product-1',
      recipeProfileProductId: 'product-1',
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
      hasGroceriesAdded: false,
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
      hasGroceriesAdded: false,
    });
    component.loaded.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('This profile has no grocery products.');

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
      hasGroceriesAdded: false,
    });
    component.loadedProfile.set({
      id: 'profile-1',
      name: 'Default',
      servings: 4,
      products: [],
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
    expect(fixture.nativeElement.textContent).toContain('Update the profile');
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

  it('uses the promoted profile-product identifier for the current purchase', () => {
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
      hasGroceriesAdded: false,
    });
    component.loadedProfile.set({ id: 'profile-1', name: 'Default', servings: 4, products: [] });
    component.neededItems.set([
      {
        id: 'manual-1',
        recipeProfileProductId: null,
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
    const addMealGroceries = vi
      .spyOn(component.planningStore, 'addMealGroceries')
      .mockReturnValue(
        of({ id: 'planning-1', planningCycleId: 'cycle-1', entries: [], notes: [] }),
      );
    vi.spyOn(component.modal()!, 'close').mockImplementation(() => undefined);
    const toast = vi.spyOn(component.toast, 'success');

    component.loaded.set(true);
    component.confirm();

    const profileProductId = saveProfile.mock.calls[0][0].products[0].id;
    expect(profileProductId).toBeTruthy();
    expect(addMealGroceries.mock.calls[0][1][0].recipeProfileProductId).toBe(profileProductId);
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
      hasGroceriesAdded: false,
    });
    component.loadedProfile.set({ id: 'profile-1', name: 'Default', servings: 4, products: [] });
    vi.spyOn(component.planningStore, 'addMealGroceries').mockReturnValue(
      of({ id: 'planning-1', planningCycleId: 'cycle-1', entries: [], notes: [] }),
    );
    vi.spyOn(component.modal()!, 'close').mockImplementation(() => undefined);
    const toast = vi.spyOn(component.toast, 'success');

    component.confirm();

    expect(toast).not.toHaveBeenCalled();
  });

  it('retains saved product IDs and explains partial success before a grocery retry', () => {
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
      hasGroceriesAdded: false,
    });
    component.loadedProfile.set({ id: 'profile', name: 'Default', servings: 2, products: [] });
    component.neededItems.set([
      {
        id: 'manual',
        recipeProfileProductId: null,
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
      .spyOn(component.planningStore, 'addMealGroceries')
      .mockReturnValueOnce(throwError(() => new Error('Request failed')))
      .mockReturnValueOnce(
        of({ id: 'planning', planningCycleId: 'cycle', entries: [], notes: [] }),
      );
    const close = vi.spyOn(component.modal()!, 'close').mockImplementation(() => {});
    component.confirm();
    expect(component.error()).toContain('The profile was updated.');
    expect(close).not.toHaveBeenCalled();
    const productId = save.mock.calls[0][0].products[0].id;
    expect(component.neededItems()[0].recipeProfileProductId).toBe(productId);
    component.confirm();
    expect(save.mock.calls[1][0].products[0].id).toBe(productId);
    expect(groceries.mock.calls[1][1][0].recipeProfileProductId).toBe(productId);
    expect(close).toHaveBeenCalledOnce();
  });
});
