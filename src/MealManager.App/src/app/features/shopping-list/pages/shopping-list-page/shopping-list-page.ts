import { RecipeReturnContext } from '../../../../core/layout/recipe-return-context';
import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { viewRecipeLabel } from '../../../../core/i18n/labels';
import { HttpErrorResponse } from '@angular/common/http';
import { PlanningCycleSwitcher } from '../../../planning-cycle/components/planning-cycle-switcher/planning-cycle-switcher';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { ShoppingListStore } from '../../state/shopping-list.store';
import { catchError, finalize, of, switchMap, Subject, timer, Subscription } from 'rxjs';
import { RouterLink } from '@angular/router';
import {
  ShoppingListItemRow,
  ShoppingListRowItem,
} from '../../../../shared/components/shopping-list-item-row/shopping-list-item-row';
import { ApiShoppingListItem } from '../../../../api/models/api-shopping-list';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { ToastService } from '../../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { CdkDrag, CdkDragDrop, CdkDropList, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  GroceryDraft,
  GroceryEditModal,
} from '../../../../shared/components/grocery-edit-modal/grocery-edit-modal';

import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { SupermarketSend } from '../../../supermarkets/components/supermarket-send';

@Component({
  selector: 'app-shopping-list-page',
  imports: [
    PlanningCycleSwitcher,
    RouterLink,
    ShoppingListItemRow,
    LoadingIndicator,
    RecipeSummary,
    CdkDrag,
    CdkDropList,
    GroceryEditModal,
    AppIcon,
    SupermarketSend,
    EmptyState,
  ],
  templateUrl: './shopping-list-page.html',
})
export class ShoppingListPage implements OnInit {
  readonly title = $localize`:@@groceries.pageTitle:Shopping list`;
  readonly viewRecipeLabel = viewRecipeLabel;
  readonly otherItemsLabel = $localize`:@@shoppingList.page.template.otherItems:Other items`;
  itemCountLabel(count: number): string {
    return count === 1
      ? $localize`:@@groceries.oneItem:1 item`
      : $localize`:@@groceries.itemCount:${count}:count: items`;
  }
  unconfirmedMealsMessage(count: number): string {
    if (this.cycleStore.currentCycle()?.nextPlanningCycleId) {
      return count === 1
        ? $localize`:@@groceries.oneMealWasNotReviewed:Groceries for 1 meal were not reviewed.`
        : $localize`:@@groceries.mealsWereNotReviewed:Groceries for ${count}:count: meals were not reviewed.`;
    }
    return count === 1
      ? $localize`:@@groceries.oneMealNeedsReview:Groceries for 1 meal haven't been reviewed yet.`
      : $localize`:@@groceries.mealsNeedReview:Groceries for ${count}:count: meals haven't been reviewed yet.`;
  }
  cycleStore = inject(PlanningCycleStore);
  shoppingListStore = inject(ShoppingListStore);
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
      ? (this.mealGroceries().find((group) => group.meal.id === this.addingToMealId())?.meal
          .recipeName ?? '')
      : this.otherItemsLabel,
  );
  private itemEditorSession = 0;
  pendingItemIds = signal<Set<string>>(new Set());
  reordering = signal(false);
  reorderAnnouncement = signal('');

  mealGroceries = computed(() => this.shoppingListStore.shoppingList()?.mealGroups ?? []);
  manualItems = computed(() => this.shoppingListStore.shoppingList()?.items ?? []);
  hasGroceries = computed(
    () =>
      this.manualItems().length > 0 || this.mealGroceries().some((group) => group.items.length > 0),
  );
  itemCount = computed(
    () =>
      this.manualItems().length +
      this.mealGroceries().reduce((count, group) => count + group.items.length, 0),
  );
  collectedCount = computed(
    () =>
      [...this.manualItems(), ...this.mealGroceries().flatMap((group) => group.items)].filter(
        (item) => item.checked,
      ).length,
  );
  unconfirmedMealCount = computed(
    () =>
      this.shoppingListStore
        .mealPlan()
        ?.entries.filter((entry) => entry.kind === 'Meal' && !entry.hasReviewedGroceries).length ??
      0,
  );

  private returnContext = inject(RecipeReturnContext);
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
                switchMap(() => this.shoppingListStore.suggestNames(search)),
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
        switchMap((cycle) => this.shoppingListStore.loadForCycle(cycle.id)),
        catchError((error: HttpErrorResponse) => {
          this.shoppingListStore.shoppingList.set(null);
          this.shoppingListStore.mealPlan.set(null);
          if (error.status === 404) this.noCycle.set(true);
          else
            this.loadError.set(
              $localize`:@@shoppingList.page.theGroceriesListCouldNotBeLoaded:The shopping list could not be loaded. Please try again.`,
            );
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe(() => this.returnContext.restore('/shopping-list'));
  }

  onCycleChanged(cycleId: string) {
    this.itemEditor().close();
    this.endItemEditor();
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.loadRequest = this.shoppingListStore
      .loadForCycle(cycleId)
      .pipe(
        catchError(() => {
          this.shoppingListStore.shoppingList.set(null);
          this.shoppingListStore.mealPlan.set(null);
          this.loadError.set(
            $localize`:@@shoppingList.page.theGroceriesListCouldNotBeLoaded:The shopping list could not be loaded. Please try again.`,
          );
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  toggleChecked(item: ShoppingListRowItem) {
    this.updateItem({ ...item, checked: !item.checked } as ApiShoppingListItem);
  }

  updateItem(item: ShoppingListRowItem) {
    if (this.pendingItemIds().has(item.id)) return;
    this.setItemPending(item.id, true);
    this.shoppingListStore
      .updateItem(item as ApiShoppingListItem)
      .pipe(finalize(() => this.setItemPending(item.id, false)))
      .subscribe({
        error: (error: unknown) => {
          this.refreshVisibleItems();
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@shoppingList.page.theItemCouldNotBeUpdated:The item could not be updated.`,
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
    this.shoppingListStore
      .removeItem(itemId)
      .pipe(finalize(() => this.setItemPending(itemId, false)))
      .subscribe({
        error: (error: unknown) =>
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@shoppingList.page.theItemCouldNotBeRemoved:The item could not be removed.`,
            ),
          ),
      });
  }

  reorderItems(event: CdkDragDrop<ApiShoppingListItem[]>, plannedMealId: string | null) {
    if (this.reordering() || event.previousIndex === event.currentIndex) return;
    const originalItems = [...event.container.data];
    const items = [...originalItems];
    moveItemInArray(items, event.previousIndex, event.currentIndex);
    const ordered = items.map((item, order) => ({ ...item, order }));
    this.saveItemOrder(plannedMealId, originalItems, ordered);
  }

  moveItemWithKeyboard(item: ShoppingListRowItem, direction: -1 | 1, plannedMealId: string | null) {
    if (this.reordering()) return;
    const sourceItems =
      plannedMealId === null
        ? this.manualItems()
        : (this.mealGroceries().find((group) => group.meal.id === plannedMealId)?.items ?? []);
    const currentIndex = sourceItems.findIndex((candidate) => candidate.id === item.id);
    const targetIndex = currentIndex + direction;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= sourceItems.length) {
      this.reorderAnnouncement.set(
        $localize`:@@common.itemCannotMoveFurther:${item.name}:itemName: cannot be moved further in that direction.`,
      );
      return;
    }

    const originalItems = [...sourceItems];
    const movedItems = [...sourceItems];
    moveItemInArray(movedItems, currentIndex, targetIndex);
    const ordered = movedItems.map((candidate, order) => ({ ...candidate, order }));
    this.saveItemOrder(plannedMealId, originalItems, ordered, item, targetIndex);
  }

  private saveItemOrder(
    plannedMealId: string | null,
    originalItems: ApiShoppingListItem[],
    ordered: ApiShoppingListItem[],
    keyboardItem?: ShoppingListRowItem,
    keyboardTargetIndex?: number,
  ) {
    this.updateVisibleOrder(plannedMealId, ordered);
    this.reordering.set(true);
    this.shoppingListStore
      .reorderItems(
        plannedMealId,
        ordered.map((item) => item.id),
      )
      .pipe(finalize(() => this.reordering.set(false)))
      .subscribe({
        next: () => {
          if (!keyboardItem || keyboardTargetIndex === undefined) return;
          this.reorderAnnouncement.set(
            $localize`:@@common.itemMoved:${keyboardItem.name}:itemName: moved to position ${keyboardTargetIndex + 1}:position:.`,
          );
          setTimeout(() => this.focusItemHandle(keyboardItem.id));
        },
        error: (error: unknown) => {
          this.updateVisibleOrder(plannedMealId, originalItems);
          const message = apiErrorMessage(
            error,
            $localize`:@@shoppingList.page.theGroceryOrderCouldNotBeSaved:The grocery order could not be saved.`,
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

  addItem(edit: GroceryDraft) {
    const cycleId = this.cycleStore.currentCycle()?.id;
    const mealId = this.addingToMealId();
    if (!cycleId || this.addingItem()) return;
    const session = this.itemEditorSession;
    this.itemSaveError.set(null);
    this.addingItem.set(true);
    const request = mealId
      ? this.shoppingListStore.addMealItem(cycleId, mealId, edit.name, edit.quantity)
      : this.shoppingListStore.addManualItem(cycleId, edit.name, edit.quantity);
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
            $localize`:@@shoppingList.page.theItemCouldNotBeAddedPlease:The item could not be added. Please try again.`,
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
    this.shoppingListStore.shoppingList.update((list) => (list ? structuredClone(list) : list));
  }

  private updateVisibleOrder(plannedMealId: string | null, items: ApiShoppingListItem[]) {
    this.shoppingListStore.shoppingList.update((list) => {
      if (!list) return list;
      if (plannedMealId === null) return { ...list, items: items };
      return {
        ...list,
        mealGroups: list.mealGroups.map((group) =>
          group.meal.id === plannedMealId ? { ...group, items: items } : group,
        ),
      };
    });
  }

  private focusItemHandle(itemId: string) {
    document.querySelector<HTMLElement>(`[data-item-handle="${itemId}"]`)?.focus();
  }
}
