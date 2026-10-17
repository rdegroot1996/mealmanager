import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiShoppingListItem, ApiShoppingList } from '../../../api/models/api-shopping-list';
import { ApiMealPlan } from '../../../api/models/api-meal-plan';
import { PlanningCycleStore } from '../../planning-cycle/state/planning-cycle.store';
import { forkJoin, map, Observable, of, switchMap, tap } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ShoppingListStore {
  private http = inject(HttpClient);

  private cycles = inject(PlanningCycleStore);
  private loadRequest = 0;
  shoppingList = signal<ApiShoppingList | null>(null);
  mealPlan = signal<ApiMealPlan | null>(null);

  suggestNames(search: string) {
    return this.http.get<string[]>('/api/shopping-lists/suggestions', { params: { search } });
  }

  private reloadIfSelected(cycleId: string) {
    return !this.cycles.currentCycle() || this.cycles.currentCycle()?.id === cycleId
      ? this.loadForCycle(cycleId)
      : of(null);
  }

  loadForCycle(cycleId: string) {
    const request = ++this.loadRequest;
    return forkJoin({
      groceries: this.http.get<ApiShoppingList>(`/api/shopping-lists/cycle/${cycleId}`),
      mealPlan: this.http.get<ApiMealPlan>(`/api/meal-plans/cycle/${cycleId}`),
    }).pipe(
      tap(({ groceries, mealPlan }) => {
        if (
          request !== this.loadRequest ||
          (this.cycles.currentCycle() && this.cycles.currentCycle()?.id !== cycleId)
        )
          return;
        this.shoppingList.set(groceries);
        this.mealPlan.set(mealPlan);
      }),
      map(({ groceries }) => groceries),
    );
  }

  addManualItem(cycleId: string, name: string, quantity: number) {
    return this.http
      .post<ApiShoppingListItem>(`/api/shopping-lists/cycle/${cycleId}/items`, { name, quantity })
      .pipe(switchMap(() => this.reloadIfSelected(cycleId)));
  }

  updateItem(item: ApiShoppingListItem) {
    const cycleId = this.shoppingList()?.planningCycleId;
    return this.http
      .put<ApiShoppingListItem>(`/api/shopping-lists/${item.id}`, {
        name: item.name,
        quantity: item.quantity,
        checked: item.checked,
      })
      .pipe(switchMap(() => (cycleId ? this.reloadIfSelected(cycleId) : of(null))));
  }

  reorderItems(
    plannedMealId: string | null,
    itemIds: string[],
  ): Observable<ApiShoppingList | null> {
    const list = this.shoppingList();
    if (!list) return of(null);
    return this.http
      .put<ApiShoppingListItem[]>(`/api/shopping-lists/${list.id}/items/order`, {
        plannedMealId,
        itemIds,
      })
      .pipe(switchMap(() => this.reloadIfSelected(list.planningCycleId)));
  }

  addMealItem(cycleId: string, mealId: string, name: string, quantity: number) {
    return this.http
      .post<ApiShoppingListItem>(`/api/planned-meals/${mealId}/groceries/items`, {
        name,
        quantity,
      })
      .pipe(switchMap(() => this.reloadIfSelected(cycleId)));
  }

  removeItem(itemId: string) {
    const cycleId = this.shoppingList()?.planningCycleId;
    return this.http
      .delete(`/api/shopping-lists/${itemId}`)
      .pipe(switchMap(() => (cycleId ? this.reloadIfSelected(cycleId) : of(null))));
  }
}
