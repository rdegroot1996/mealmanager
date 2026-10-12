import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiGroceryItem, ApiGroceryList } from '../../../api/models/api-groceries';
import { ApiPlanning } from '../../../api/models/api-planning';
import { PlanningCycleStore } from '../../planning-cycle/state/planning-cycle.store';
import { forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class GroceriesStore {
  private http = inject(HttpClient);

  private cycles = inject(PlanningCycleStore);
  private loadRequest = 0;
  groceryList = signal<ApiGroceryList | null>(null);
  planning = signal<ApiPlanning | null>(null);

  suggestNames(search: string) {
    return this.http.get<string[]>('/api/grocery-lists/suggestions', { params: { search } });
  }

  private reloadIfSelected(cycleId: string) {
    return !this.cycles.currentCycle() || this.cycles.currentCycle()?.id === cycleId
      ? this.loadForCycle(cycleId)
      : of(null);
  }

  loadForCycle(cycleId: string) {
    const request = ++this.loadRequest;
    return forkJoin({
      groceries: this.http.get<ApiGroceryList>(`/api/grocery-lists/cycle/${cycleId}`),
      planning: this.http.get<ApiPlanning>(`/api/planning/cycle/${cycleId}`),
    }).pipe(
      tap(({ groceries, planning }) => {
        if (
          request !== this.loadRequest ||
          (this.cycles.currentCycle() && this.cycles.currentCycle()?.id !== cycleId)
        )
          return;
        this.groceryList.set(groceries);
        this.planning.set(planning);
      }),
      map(({ groceries }) => groceries),
    );
  }

  addManualItem(cycleId: string, name: string, quantity: number) {
    return this.http
      .post<ApiGroceryItem>(`/api/grocery-lists/cycle/${cycleId}/items`, { name, quantity })
      .pipe(switchMap(() => this.reloadIfSelected(cycleId)));
  }

  updateItem(item: ApiGroceryItem) {
    const cycleId = this.groceryList()?.planningCycleId;
    return this.http
      .put<ApiGroceryItem>(`/api/grocery-lists/${item.id}`, {
        name: item.name,
        quantity: item.quantity,
        checked: item.checked,
      })
      .pipe(switchMap(() => (cycleId ? this.reloadIfSelected(cycleId) : of(null))));
  }

  reorderItems(
    planningMealId: string | null,
    itemIds: string[],
  ): Observable<ApiGroceryList | null> {
    const list = this.groceryList();
    if (!list) return of(null);
    return this.http
      .put<ApiGroceryItem[]>(`/api/grocery-lists/${list.id}/items/order`, {
        planningMealId,
        itemIds,
      })
      .pipe(switchMap(() => this.reloadIfSelected(list.planningCycleId)));
  }

  addMealItem(cycleId: string, mealId: string, name: string, quantity: number) {
    return this.http
      .post<ApiGroceryItem>(`/api/planning-meals/${mealId}/groceries/items`, {
        name,
        quantity,
      })
      .pipe(switchMap(() => this.reloadIfSelected(cycleId)));
  }

  removeItem(itemId: string) {
    const cycleId = this.groceryList()?.planningCycleId;
    return this.http
      .delete(`/api/grocery-lists/${itemId}`)
      .pipe(switchMap(() => (cycleId ? this.reloadIfSelected(cycleId) : of(null))));
  }
}
