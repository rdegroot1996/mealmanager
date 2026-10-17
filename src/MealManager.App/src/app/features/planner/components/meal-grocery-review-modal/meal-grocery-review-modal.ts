import { ApiRecipeProfile } from '../../../../api/models/api-recipe';
import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { dropGrocery, moveGrocery } from '../../../../shared/components/grocery-row/grocery-order';
import { Modal } from '../../../../shared/components/modal/modal';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { MealPlanStore } from '../../state/meal-plan.store';
import { RecipesStore } from '../../../recipes/state/recipes.store';
import { ApiPlannedEntry } from '../../../../api/models/api-meal-plan';
import { forkJoin, Observable, of, switchMap, tap } from 'rxjs';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import {
  GroceryDraft,
  GroceryEditModal,
} from '../../../../shared/components/grocery-edit-modal/grocery-edit-modal';
import { ToastService } from '../../../../shared/services/toast.service';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';

import { GrocerySelectItem } from '../../models/grocery-select-item';
import { PurchaseGroceryRow } from '../purchase-grocery-row/purchase-grocery-row';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

@Component({
  selector: 'app-meal-grocery-review-modal',
  imports: [
    ConfirmationModal,
    Modal,
    RecipeSummary,
    LoadingIndicator,
    CdkDrag,
    PurchaseGroceryRow,
    CdkDropList,
    GroceryEditModal,
    AppIcon,
  ],
  templateUrl: './meal-grocery-review-modal.html',
})
export class MealGroceryReviewModal {
  private savedDraft = '';
  readonly discardModal = viewChild.required<ConfirmationModal>('discardModal');
  readonly beforeDismiss = () =>
    !this.loaded() ||
    this.draftSnapshot() === this.savedDraft ||
    this.discardModal().confirmDiscard();
  private draftSnapshot() {
    return JSON.stringify({
      needed: this.neededItems(),
      atHome: this.atHomeItems(),
      updateProfile: this.updateReusableProfile(),
    });
  }

  modal = viewChild<Modal>('modal');
  itemEditor = viewChild.required<GroceryEditModal>('itemEditor');
  readonly neededLabel = $localize`:@@groceries.needed:Needed`;
  readonly atHomeLabel = $localize`:@@groceries.usuallyAtHome:Usually at home`;

  startAddItem(target: 'needed' | 'atHome') {
    if (this.saving() || !this.loaded()) return;
    this.addingItemTo.set(target);
    this.itemEditor().openNew();
  }
  mealPlanStore = inject(MealPlanStore);
  recipesStore = inject(RecipesStore);
  toast = inject(ToastService);
  private cycleStore = inject(PlanningCycleStore);
  ngOnDestroy() {
    this.endSession();
  }
  private session = 0;
  endSession() {
    ++this.session;
  }
  private cycleId: string | undefined;

  meal = signal<ApiPlannedEntry | null>(null);
  neededItems = signal<GrocerySelectItem[]>([]);
  atHomeItems = signal<GrocerySelectItem[]>([]);
  loading = signal(false);
  loaded = signal(false);
  saving = signal(false);
  error = signal('');
  reorderAnnouncement = signal('');
  loadedProfile = signal<ApiRecipeProfile | null>(null);
  addingItemTo = signal<'needed' | 'atHome' | null>(null);
  updateReusableProfile = signal(false);
  readonly selectedItemCount = computed(
    () => [...this.neededItems(), ...this.atHomeItems()].filter((item) => item.selected).length,
  );
  readonly confirmLabel = computed(() => {
    if (!this.loaded()) return $localize`:@@planner.confirmSelection:Confirm selection`;
    const count = this.selectedItemCount();
    if (!count) return $localize`:@@planner.confirmNothingToBuy:Confirm nothing to buy`;
    if (this.meal()?.hasReviewedGroceries)
      return $localize`:@@planner.updateShoppingList:Update shopping list`;
    return count === 1
      ? $localize`:@@planner.addOneItemToShoppingList:Add 1 item to shopping list`
      : $localize`:@@planner.addItemsToShoppingList:Add ${count}:itemCount: items to shopping list`;
  });
  readonly updateProfileLabel = computed(() => {
    const name = this.loadedProfile()?.name ?? '';
    return $localize`:@@planner.alsoUpdateNamedProfile:Also update profile “${name}:profileName:”`;
  });

  open(meal: ApiPlannedEntry) {
    if (meal.kind !== 'Meal' || this.cycleStore.currentCycle()?.nextPlanningCycleId) return;
    const session = ++this.session;
    this.cycleId = this.cycleStore.currentCycle()?.id;
    this.meal.set(meal);
    this.loading.set(true);
    this.loaded.set(false);
    this.saving.set(false);
    this.error.set('');
    this.neededItems.set([]);
    this.atHomeItems.set([]);
    this.loadedProfile.set(null);
    this.addingItemTo.set(null);
    this.updateReusableProfile.set(false);
    forkJoin({
      profile: this.recipesStore.loadProfile(meal.recipeProfile.id),
      groceries: this.mealPlanStore.loadMealGroceries(meal.id),
    }).subscribe({
      next: ({ profile, groceries }) => {
        if (session !== this.session) return;
        this.loadedProfile.set(profile);
        const currentByGroceryItemId = new Map(
          groceries.items
            .filter((item) => item.recipeProfileGroceryItemId)
            .map((item) => [item.recipeProfileGroceryItemId!, item]),
        );
        const matchedGroceryItemIds = new Set<string>();

        const needed: GrocerySelectItem[] = [];
        const atHome: GrocerySelectItem[] = [];

        for (const profileItem of profile.groceries) {
          const existing = currentByGroceryItemId.get(profileItem.id);
          if (existing) matchedGroceryItemIds.add(profileItem.id);
          const item: GrocerySelectItem = {
            id: profileItem.id,
            recipeProfileGroceryItemId: profileItem.id,
            name: existing?.name ?? profileItem.name,
            quantity: existing?.quantity ?? profileItem.quantity,
            selected: !!existing || (!meal.hasReviewedGroceries && !profileItem.atHome),
            atHome: !!profileItem.atHome,
            purchaseOrder: existing?.order ?? null,
          };
          if (item.atHome) {
            atHome.push(item);
          } else {
            needed.push(item);
          }
        }

        // Preserve previously substituted groceries when reopening the dialog.
        for (const existing of groceries.items) {
          if (
            existing.recipeProfileGroceryItemId &&
            matchedGroceryItemIds.has(existing.recipeProfileGroceryItemId)
          )
            continue;
          needed.push({
            id: existing.id,
            recipeProfileGroceryItemId: existing.recipeProfileGroceryItemId ?? null,
            name: existing.name,
            quantity: existing.quantity,
            selected: true,
            atHome: false,
            purchaseOrder: existing.order,
          });
        }

        const byPurchaseOrder = (a: GrocerySelectItem, b: GrocerySelectItem) => {
          if (a.purchaseOrder === null && b.purchaseOrder === null) return 0;
          if (a.purchaseOrder === null) return 1;
          if (b.purchaseOrder === null) return -1;
          return a.purchaseOrder - b.purchaseOrder;
        };
        this.neededItems.set(needed.sort(byPurchaseOrder));
        this.atHomeItems.set(atHome.sort(byPurchaseOrder));
        this.loading.set(false);
        this.savedDraft = this.draftSnapshot();
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        if (session !== this.session) return;
        this.loading.set(false);
        this.error.set(
          apiErrorMessage(
            error,
            $localize`:@@planner.mealGroceryReviewModal.theMealGroceriesCouldNotBeLoaded:The meal groceries could not be loaded. Please try again.`,
          ),
        );
      },
    });
    this.modal()!.open();
  }

  addManualItem(edit: GroceryDraft, atHome: boolean) {
    if (this.saving()) return;
    const item: GrocerySelectItem = {
      id: crypto.randomUUID(),
      recipeProfileGroceryItemId: null,
      name: edit.name,
      quantity: edit.quantity,
      selected: true,
      atHome,
      purchaseOrder: null,
    };
    if (atHome) this.atHomeItems.update((items) => [...items, item]);
    else this.neededItems.update((items) => [...items, item]);
    this.addingItemTo.set(null);
    this.error.set('');
  }

  removeItem(item: GrocerySelectItem) {
    if (this.saving()) return;
    this.neededItems.update((items) => items.filter((current) => current.id !== item.id));
    this.atHomeItems.update((items) => items.filter((current) => current.id !== item.id));
  }

  toggleItem(item: GrocerySelectItem) {
    this.updateItem(item, { selected: !item.selected });
  }

  saveEditing(item: GrocerySelectItem, edit: GroceryDraft) {
    this.updateItem(item, edit);
  }

  dropItem(event: CdkDragDrop<GrocerySelectItem[]>, atHome: boolean) {
    if (this.saving()) return;
    const moved = dropGrocery(
      this.neededItems(),
      this.atHomeItems(),
      event.previousContainer === event.container,
      atHome,
      event.previousIndex,
      event.currentIndex,
    );
    this.neededItems.set(moved.needed);
    this.atHomeItems.set(moved.atHome);
  }

  moveItemWithKeyboard(item: GrocerySelectItem, direction: -1 | 1) {
    if (this.saving()) return;
    const moved = moveGrocery(this.neededItems(), this.atHomeItems(), item, direction);
    if (!moved) {
      this.reorderAnnouncement.set(
        $localize`:@@common.itemCannotMoveFurther:${item.name}:itemName: cannot be moved further in that direction.`,
      );
      return;
    }

    this.neededItems.set(moved.needed);
    this.atHomeItems.set(moved.atHome);
    this.reorderAnnouncement.set(
      $localize`:@@common.itemMoved:${item.name}:itemName: moved to position ${moved.position + 1}:position:.`,
    );
    setTimeout(() =>
      this.modal()!
        .dialog()
        .nativeElement.querySelector<HTMLElement>(`[data-item-handle="${item.id}"]`)
        ?.focus(),
    );
  }

  private updateItem(item: GrocerySelectItem, changes: Partial<GrocerySelectItem>) {
    const update = (items: GrocerySelectItem[]) =>
      items.map((current) => (current === item ? { ...current, ...changes } : current));
    this.neededItems.update(update);
    this.atHomeItems.update(update);
  }

  confirm() {
    const meal = this.meal();
    if (
      !meal ||
      this.saving() ||
      !this.loaded() ||
      this.cycleStore.currentCycle()?.nextPlanningCycleId ||
      this.cycleStore.currentCycle()?.id !== this.cycleId
    )
      return;
    const session = this.session;

    const allItems = [...this.neededItems(), ...this.atHomeItems()];
    const profile = this.loadedProfile();
    const updateProfile = !!(this.updateReusableProfile() && profile);
    const itemsToSave = updateProfile
      ? allItems.map((item) => ({
          ...item,
          recipeProfileGroceryItemId: item.recipeProfileGroceryItemId ?? crypto.randomUUID(),
        }))
      : allItems;
    const selectedItems = itemsToSave
      .filter((i) => i.selected)
      .map((i) => ({
        name: i.name,
        quantity: i.quantity,
        recipeProfileGroceryItemId: i.recipeProfileGroceryItemId,
      }));

    this.saving.set(true);
    this.error.set('');
    const saveProfile: Observable<ApiRecipeProfile | null> = updateProfile
      ? this.recipesStore.saveProfile({
          ...profile!,
          groceries: itemsToSave.map((item, order) => ({
            id: item.recipeProfileGroceryItemId!,
            name: item.name,
            quantity: item.quantity,
            atHome: item.atHome,
            order,
          })),
        })
      : of(null);
    let profileWasSaved = false;
    saveProfile
      .pipe(
        tap((saved) => {
          if (!saved || session !== this.session) return;
          profileWasSaved = true;
          this.loadedProfile.set(saved);
          this.neededItems.set(itemsToSave.filter((item) => !item.atHome));
          this.atHomeItems.set(itemsToSave.filter((item) => item.atHome));
        }),
        switchMap(() => this.mealPlanStore.reviewMealGroceries(meal.id, selectedItems)),
      )
      .subscribe({
        next: () => {
          if (session !== this.session) return;
          this.saving.set(false);
          this.modal()?.close();
          if (updateProfile)
            this.toast.success(
              $localize`:@@recipes.profileUpdated:Profile "${profile!.name}:profileName:" updated.`,
            );
        },
        error: (error: unknown) => {
          if (session !== this.session) return;
          this.saving.set(false);
          const message = apiErrorMessage(
            error,
            $localize`:@@planner.mealGroceryReviewModal.theMealGroceriesCouldNotBeSaved:The meal groceries could not be saved. Please try again.`,
          );
          this.error.set(
            profileWasSaved
              ? $localize`:@@planner.profileSavedBeforeGroceriesFailed:The profile was updated. ${message}:errorMessage:`
              : message,
          );
        },
      });
  }
}
