import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { viewRecipeLabel } from '../../../../core/i18n/labels';
import { HttpErrorResponse } from '@angular/common/http';
import { PlanningCycleSwitcher } from '../../../planning-cycle/components/planning-cycle-switcher/planning-cycle-switcher';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { GroceriesStore } from '../../state/groceries.store';
import { catchError, finalize, of, switchMap, Subject, timer, Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import {
  GroceryItemRow,
  GroceryRowItem,
} from '../../../../shared/components/grocery-item-row/grocery-item-row';
import { ApiGroceryItem } from '../../../../api/models/api-groceries';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { ToastService } from '../../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  GroceryItemDraft,
  GroceryEditModal,
} from '../../../../shared/components/grocery-edit-modal/grocery-edit-modal';

import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { SupermarketSend } from '../../../supermarkets/components/supermarket-send';

@Component({
  selector: 'app-groceries-page',
  imports: [
    PlanningCycleSwitcher,
    RouterLink,
    GroceryItemRow,
    LoadingIndicator,
    RecipeSummary,
    CdkDrag,
    CdkDropList,
    GroceryEditModal,
    AppIcon,
    SupermarketSend,
    EmptyState,
  ],
  templateUrl: './groceries-page.html',
})
export class GroceriesPage implements OnInit {
  readonly title = $localize`:@@groceries.pageTitle:Groceries list`;
  readonly viewRecipeLabel = viewRecipeLabel;
  readonly otherItemsLabel = $localize`:@@groceries.groceriesPage.template.otherItems:Other items`;
  itemCountLabel(count: number): string {
    return count === 1
      ? $localize`:@@groceries.oneItem:1 item`
      : $localize`:@@groceries.itemCount:${count}:count: items`;
  }
  unconfirmedMealsMessage(count: number): string {
    return count === 1
      ? $localize`:@@groceries.oneUnconfirmedMeal:1 planned meal has not been added to the groceries list yet.`
      : $localize`:@@groceries.manyUnconfirmedMeals:${count}:count: planned meals have not been added to the groceries list yet.`;
  }
  cycleStore = inject(PlanningCycleStore);
  groceriesStore = inject(GroceriesStore);
  toast = inject(ToastService);

  loading = signal(false);
  loadError = signal<string | null>(null);
  noCycle = signal(false);
  itemSaveError = signal<string | null>(null);
  itemEditor = viewChild.required<GroceryEditModal>('itemEditor');
  addingItem = signal(false);
  addingToMealId = signal<string | null>(null);
  itemEditorContext = computed(() =>
    this.addingToMealId()
      ? (this.mealGroceries().find((group) => group.planningMeal.id === this.addingToMealId())
          ?.planningMeal.recipeName ?? '')
      : this.otherItemsLabel,
  );
  private itemEditorSession = 0;
  pendingItemIds = signal<Set<string>>(new Set());
  reordering = signal(false);
  reorderAnnouncement = signal('');

  mealGroceries = computed(() => this.groceriesStore.groceryList()?.planningMealGroceries ?? []);
  manualItems = computed(() => this.groceriesStore.groceryList()?.groceries ?? []);
  hasGroceries = computed(
    () =>
      this.manualItems().length > 0 ||
      this.mealGroceries().some((group) => group.groceries.length > 0),
  );
  itemCount = computed(
    () =>
      this.manualItems().length +
      this.mealGroceries().reduce((count, group) => count + group.groceries.length, 0),
  );
  collectedCount = computed(
    () =>
      [...this.manualItems(), ...this.mealGroceries().flatMap((group) => group.groceries)].filter(
        (item) => item.checked,
      ).length,
  );
  unconfirmedMealCount = computed(
    () =>
      this.groceriesStore
        .planning()
        ?.entries.filter((entry) => entry.kind === 'Meal' && !entry.hasGroceriesAdded).length ?? 0,
  );

  private loadRequest?: Subscription;
  nameSuggestions = signal<string[]>([]);
  nameSuggestionsLoading = signal(false);
  nameSuggestionsError = signal(false);
  private nameQueries = new Subject<string>();
  private suggestionsRequest?: Subscription;
  suggestNames(search: string) {
    this.nameSuggestions.set([]);
    this.nameSuggestionsLoading.set(!!search.trim());
    this.nameSuggestionsError.set(false);
    this.nameQueries.next(search.trim());
  }
  ngOnDestroy() {
    this.loadRequest?.unsubscribe();
    this.suggestionsRequest?.unsubscribe();
  }
  ngOnInit() {
    this.suggestionsRequest = this.nameQueries
      .pipe(
        switchMap((search) =>
          search
            ? timer(150).pipe(
                switchMap(() => this.groceriesStore.suggestNames(search)),
                catchError(() => {
                  this.nameSuggestionsError.set(true);
                  return of([]);
                }),
              )
            : of([]),
        ),
      )
      .subscribe((names) => {
        this.nameSuggestions.set(names);
        this.nameSuggestionsLoading.set(false);
      });
    this.loadCurrentGroceries();
  }

  loadCurrentGroceries() {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.noCycle.set(false);
    this.loadRequest = this.cycleStore
      .loadSelectedCycle()
      .pipe(
        switchMap((cycle) => this.groceriesStore.loadForCycle(cycle.id)),
        catchError((error: HttpErrorResponse) => {
          this.groceriesStore.groceryList.set(null);
          this.groceriesStore.planning.set(null);
          if (error.status === 404) this.noCycle.set(true);
          else
            this.loadError.set(
              $localize`:@@groceries.groceriesPage.theGroceriesListCouldNotBeLoaded:The groceries list could not be loaded. Please try again.`,
            );
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  onCycleChanged(cycleId: string) {
    this.itemEditor().close();
    this.endItemEditor();
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.loadRequest = this.groceriesStore
      .loadForCycle(cycleId)
      .pipe(
        catchError(() => {
          this.groceriesStore.groceryList.set(null);
          this.groceriesStore.planning.set(null);
          this.loadError.set(
            $localize`:@@groceries.groceriesPage.theGroceriesListCouldNotBeLoaded:The groceries list could not be loaded. Please try again.`,
          );
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  toggleChecked(item: GroceryRowItem) {
    this.updateItem({ ...item, checked: !item.checked } as ApiGroceryItem);
  }

  updateItem(item: GroceryRowItem) {
    if (this.pendingItemIds().has(item.id)) return;
    this.setItemPending(item.id, true);
    this.groceriesStore
      .updateItem(item as ApiGroceryItem)
      .pipe(finalize(() => this.setItemPending(item.id, false)))
      .subscribe({
        error: (error: unknown) => {
          this.refreshVisibleItems();
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@groceries.groceriesPage.theItemCouldNotBeUpdated:The item could not be updated.`,
            ),
          );
        },
      });
  }

  startAddMealItem(mealId: string) {
    if (this.addingItem()) return;
    ++this.itemEditorSession;
    this.itemSaveError.set(null);
    this.addingToMealId.set(mealId);
    this.itemEditor().openNew();
  }

  removeItem(itemId: string) {
    if (this.pendingItemIds().has(itemId)) return;
    this.setItemPending(itemId, true);
    this.groceriesStore
      .removeItem(itemId)
      .pipe(finalize(() => this.setItemPending(itemId, false)))
      .subscribe({
        error: (error: unknown) =>
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@groceries.groceriesPage.theItemCouldNotBeRemoved:The item could not be removed.`,
            ),
          ),
      });
  }

  reorderItems(event: CdkDragDrop<ApiGroceryItem[]>, planningMealId: string | null) {
    if (this.reordering() || event.previousIndex === event.currentIndex) return;
    const originalItems = [...event.container.data];
    const items = [...originalItems];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    const ordered = items.map((item, order) => ({ ...item, order }));
    this.saveItemOrder(planningMealId, originalItems, ordered);
  }

  moveItemWithKeyboard(item: GroceryRowItem, direction: -1 | 1, planningMealId: string | null) {
    if (this.reordering()) return;
    const sourceItems =
      planningMealId === null
        ? this.manualItems()
        : (this.mealGroceries().find((group) => group.planningMeal.id === planningMealId)
            ?.groceries ?? []);
    const currentIndex = sourceItems.findIndex((candidate) => candidate.id === item.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sourceItems.length) {
      this.reorderAnnouncement.set(
        $localize`:@@groceries.groceriesPage.itemCannotMoveFurther:${item.name}:itemName: cannot be moved further in that direction.`,
      );
      return;
    }

    const originalItems = [...sourceItems];
    const movedItems = [...sourceItems];
    moveItemInArray(movedItems, currentIndex, targetIndex);
    const ordered = movedItems.map((candidate, order) => ({ ...candidate, order }));
    this.saveItemOrder(planningMealId, originalItems, ordered, item, targetIndex);
  }

  private saveItemOrder(
    planningMealId: string | null,
    originalItems: ApiGroceryItem[],
    ordered: ApiGroceryItem[],
    keyboardItem?: GroceryRowItem,
    keyboardTargetIndex?: number,
  ) {
    this.updateVisibleOrder(planningMealId, ordered);
    this.reordering.set(true);
    this.groceriesStore
      .reorderItems(
        planningMealId,
        ordered.map((item) => item.id),
      )
      .pipe(finalize(() => this.reordering.set(false)))
      .subscribe({
        next: () => {
          if (!keyboardItem || keyboardTargetIndex === undefined) return;
          this.reorderAnnouncement.set(
            $localize`:@@groceries.groceriesPage.itemMoved:${keyboardItem.name}:itemName: moved to position ${keyboardTargetIndex + 1}:position:.`,
          );
          setTimeout(() => this.focusItemHandle(keyboardItem.id));
        },
        error: (error: unknown) => {
          this.updateVisibleOrder(planningMealId, originalItems);
          const message = apiErrorMessage(
            error,
            $localize`:@@groceries.groceriesPage.theGroceryOrderCouldNotBeSaved:The grocery order could not be saved.`,
          );
          this.toast.error(message);
          if (keyboardItem) this.reorderAnnouncement.set(message);
        },
      });
  }

  startAddManualItem() {
    if (this.addingItem()) return;
    ++this.itemEditorSession;
    this.itemSaveError.set(null);
    this.addingToMealId.set(null);
    this.itemEditor().openNew();
  }

  endItemEditor() {
    ++this.itemEditorSession;
    this.addingToMealId.set(null);
    this.itemSaveError.set(null);
    this.suggestNames('');
  }

  addItem(edit: GroceryItemDraft) {
    const cycleId = this.cycleStore.currentCycle()?.id;
    const mealId = this.addingToMealId();
    if (!cycleId || this.addingItem()) return;
    const session = this.itemEditorSession;
    this.itemSaveError.set(null);
    this.addingItem.set(true);
    const request = mealId
      ? this.groceriesStore.addMealItem(cycleId, mealId, edit.name, edit.quantity)
      : this.groceriesStore.addManualItem(cycleId, edit.name, edit.quantity);
    request.pipe(finalize(() => this.addingItem.set(false))).subscribe({
      next: () => {
        if (session !== this.itemEditorSession) return;
        this.itemEditor().close();
        this.addingToMealId.set(null);
      },
      error: (error: unknown) => {
        if (session !== this.itemEditorSession) return;
        this.itemSaveError.set(
          apiErrorMessage(
            error,
            $localize`:@@groceries.groceriesPage.theItemCouldNotBeAddedPlease:The item could not be added. Please try again.`,
          ),
        );
      },
    });
  }

  private setItemPending(itemId: string, pending: boolean) {
    this.pendingItemIds.update((ids) => {
      const updated = new Set(ids);
      if (pending) updated.add(itemId);
      else updated.delete(itemId);
      return updated;
    });
  }

  private refreshVisibleItems() {
    this.groceriesStore.groceryList.update((list) => (list ? structuredClone(list) : list));
  }

  private updateVisibleOrder(planningMealId: string | null, items: ApiGroceryItem[]) {
    this.groceriesStore.groceryList.update((list) => {
      if (!list) return list;
      if (planningMealId === null) return { ...list, groceries: items };
      return {
        ...list,
        planningMealGroceries: list.planningMealGroceries.map((group) =>
          group.planningMeal.id === planningMealId ? { ...group, groceries: items } : group,
        ),
      };
    });
  }

  private focusItemHandle(itemId: string) {
    document.querySelector<HTMLElement>(`[data-item-handle="${itemId}"]`)?.focus();
  }
}
