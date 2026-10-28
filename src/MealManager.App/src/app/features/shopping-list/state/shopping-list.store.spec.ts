import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ShoppingListStore } from './shopping-list.store';

describe('ShoppingListStore', () => {
  let store: ShoppingListStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(ShoppingListStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('queries household name suggestions without changing shopping state', () => {
    let names: string[] = [];
    store.suggestNames('wc').subscribe((result) => (names = result));
    http
      .expectOne(
        (request) =>
          request.url === '/api/shopping-lists/suggestions' &&
          request.params.get('search') === 'wc',
      )
      .flush(['wc papier']);
    expect(names).toEqual(['wc papier']);
    expect(store.shoppingList()).toBeNull();
  });

  it('loads the shopping list and meal plan context for a cycle', () => {
    store.loadForCycle('cycle-1').subscribe();

    http.expectOne('/api/shopping-lists/cycle/cycle-1').flush({
      id: 'list-1',
      planningCycleId: 'cycle-1',
      mealGroups: [],
      items: [],
    });
    http.expectOne('/api/meal-plans/cycle/cycle-1').flush({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      meals: [],
      leftovers: [],
      notes: [],
    });

    expect(store.shoppingList()?.id).toBe('list-1');
    expect(store.mealPlan()?.id).toBe('planning-1');
  });

  it('reloads the complete cycle after adding a manual item', () => {
    store.addManualItem('cycle-1', 'Milk', 2).subscribe();

    const addRequest = http.expectOne('/api/shopping-lists/cycle/cycle-1/items');
    expect(addRequest.request.method).toBe('POST');
    expect(addRequest.request.body).toEqual({ name: 'Milk', quantity: 2 });
    addRequest.flush({
      id: 'item-1',
      name: 'Milk',
      quantity: 2,
      order: 0,
      checked: false,
      plannedMealId: null,
    });

    http.expectOne('/api/shopping-lists/cycle/cycle-1').flush({
      id: 'list-1',
      planningCycleId: 'cycle-1',
      mealGroups: [],
      items: [
        { id: 'item-1', name: 'Milk', quantity: 2, order: 0, checked: false, plannedMealId: null },
      ],
    });
    http.expectOne('/api/meal-plans/cycle/cycle-1').flush({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      meals: [],
      leftovers: [],
      notes: [],
    });

    expect(store.shoppingList()?.items).toHaveLength(1);
  });

  it('persists and reloads a grocery-group order', () => {
    store.shoppingList.set({
      id: 'list-1',
      planningCycleId: 'cycle-1',
      mealGroups: [],
      items: [],
    });

    store.reorderItems(null, ['item-2', 'item-1']).subscribe();

    const reorder = http.expectOne('/api/shopping-lists/list-1/items/order');
    expect(reorder.request.method).toBe('PUT');
    expect(reorder.request.body).toEqual({ plannedMealId: null, itemIds: ['item-2', 'item-1'] });
    reorder.flush([]);
    http.expectOne('/api/shopping-lists/cycle/cycle-1').flush({
      id: 'list-1',
      planningCycleId: 'cycle-1',
      mealGroups: [],
      items: [],
    });
    http.expectOne('/api/meal-plans/cycle/cycle-1').flush({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      meals: [],
      leftovers: [],
      notes: [],
    });
  });

  it('acknowledges a successful add even when its subsequent list refresh fails', () => {
    const result = vi.fn();
    store.addManualItem('cycle-1', 'Milk', 2).subscribe(result);
    const add = http.expectOne('/api/shopping-lists/cycle/cycle-1/items');
    expect(add.request.method).toBe('POST');
    add.flush({ id: 'milk' });
    const list = http.expectOne('/api/shopping-lists/cycle/cycle-1');
    http.expectOne('/api/meal-plans/cycle/cycle-1');
    list.flush({}, { status: 503, statusText: 'Unavailable' });
    expect(result).toHaveBeenCalledExactlyOnceWith({ refreshFailed: true });
    http.expectNone((request) => request.method === 'POST');
  });
});
