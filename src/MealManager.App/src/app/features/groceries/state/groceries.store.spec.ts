import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { GroceriesStore } from './groceries.store';

describe('GroceriesStore', () => {
  let store: GroceriesStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(GroceriesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('queries household name suggestions without changing shopping state', () => {
    let names: string[] = [];
    store.suggestNames('wc').subscribe((result) => (names = result));
    http
      .expectOne(
        (request) =>
          request.url === '/api/grocery-lists/suggestions' && request.params.get('search') === 'wc',
      )
      .flush(['wc papier']);
    expect(names).toEqual(['wc papier']);
    expect(store.groceryList()).toBeNull();
  });

  it('loads the shopping list and planning context for a cycle', () => {
    store.loadForCycle('cycle-1').subscribe();

    http.expectOne('/api/grocery-lists/cycle/cycle-1').flush({
      id: 'list-1',
      planningCycleId: 'cycle-1',
      planningMealGroceries: [],
      groceries: [],
    });
    http.expectOne('/api/planning/cycle/cycle-1').flush({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      meals: [],
      leftovers: [],
      notes: [],
    });

    expect(store.groceryList()?.id).toBe('list-1');
    expect(store.planning()?.id).toBe('planning-1');
  });

  it('reloads the complete cycle after adding a manual item', () => {
    store.addManualItem('cycle-1', 'Milk', 2).subscribe();

    const addRequest = http.expectOne('/api/grocery-lists/cycle/cycle-1/items');
    expect(addRequest.request.method).toBe('POST');
    expect(addRequest.request.body).toEqual({ name: 'Milk', quantity: 2 });
    addRequest.flush({
      id: 'item-1',
      name: 'Milk',
      quantity: 2,
      order: 0,
      checked: false,
      planningMealId: null,
    });

    http.expectOne('/api/grocery-lists/cycle/cycle-1').flush({
      id: 'list-1',
      planningCycleId: 'cycle-1',
      planningMealGroceries: [],
      groceries: [
        { id: 'item-1', name: 'Milk', quantity: 2, order: 0, checked: false, planningMealId: null },
      ],
    });
    http.expectOne('/api/planning/cycle/cycle-1').flush({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      meals: [],
      leftovers: [],
      notes: [],
    });

    expect(store.groceryList()?.groceries).toHaveLength(1);
  });

  it('persists and reloads a grocery-group order', () => {
    store.groceryList.set({
      id: 'list-1',
      planningCycleId: 'cycle-1',
      planningMealGroceries: [],
      groceries: [],
    });

    store.reorderItems(null, ['item-2', 'item-1']).subscribe();

    const reorder = http.expectOne('/api/grocery-lists/list-1/items/order');
    expect(reorder.request.method).toBe('PUT');
    expect(reorder.request.body).toEqual({ planningMealId: null, itemIds: ['item-2', 'item-1'] });
    reorder.flush([]);
    http.expectOne('/api/grocery-lists/cycle/cycle-1').flush({
      id: 'list-1',
      planningCycleId: 'cycle-1',
      planningMealGroceries: [],
      groceries: [],
    });
    http.expectOne('/api/planning/cycle/cycle-1').flush({
      id: 'planning-1',
      planningCycleId: 'cycle-1',
      meals: [],
      leftovers: [],
      notes: [],
    });
  });
});
