import { ApiRecipeProfile } from '../../../../api/models/api-recipe';
import { Component, inject, signal, viewChild } from '@angular/core';
import { moveProduct } from '../../../../shared/components/product-row/product-order';
import { Modal } from '../../../../shared/components/modal/modal';
import { PlanningStore } from '../../state/planning.store';
import { RecipesStore } from '../../../recipes/state/recipes.store';
import { ApiPlanningEntry } from '../../../../api/models/api-planning';
import { forkJoin, Observable, of, switchMap, tap } from 'rxjs';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { RouterLink } from '@angular/router';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import {
  GroceryItemDraft,
  GroceryEditModal,
} from '../../../../shared/components/grocery-edit-modal/grocery-edit-modal';
import { ToastService } from '../../../../shared/services/toast.service';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';

import { GrocerySelectItem } from '../../models/grocery-select-item';
import { PurchaseProductRow } from '../purchase-product-row/purchase-product-row';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

@Component({
  selector: 'app-meal-groceries-form-modal',
  imports: [
    Modal,
    RecipeSummary,
    RouterLink,
    LoadingIndicator,
    CdkDrag,
    PurchaseProductRow,
    CdkDropList,
    GroceryEditModal,
    AppIcon,
  ],
  templateUrl: './meal-groceries-form-modal.html',
})
export class MealGroceriesFormModal {
  modal = viewChild<Modal>('modal');
  itemEditor = viewChild.required<GroceryEditModal>('itemEditor');
  readonly neededLabel = $localize`:@@groceries.needed:Needed`;
  readonly atHomeLabel = $localize`:@@groceries.usuallyAtHome:Usually at home`;

  startAddItem(target: 'needed' | 'atHome') {
    if (this.saving() || !this.loaded()) return;
    this.addingItemTo.set(target);
    this.itemEditor().openNew();
  }
  planningStore = inject(PlanningStore);
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

  meal = signal<ApiPlanningEntry | null>(null);
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

  open(meal: ApiPlanningEntry) {
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
      groceries: this.planningStore.loadMealGroceries(meal.id),
    }).subscribe({
      next: ({ profile, groceries }) => {
        if (session !== this.session) return;
        this.loadedProfile.set(profile);
        const currentByProductId = new Map(
          groceries.groceries
            .filter((item) => item.recipeProfileProductId)
            .map((item) => [item.recipeProfileProductId!, item]),
        );
        const matchedProductIds = new Set<string>();

        const needed: GrocerySelectItem[] = [];
        const atHome: GrocerySelectItem[] = [];

        for (const product of profile.products) {
          const existing = currentByProductId.get(product.id);
          if (existing) matchedProductIds.add(product.id);
          const item: GrocerySelectItem = {
            id: product.id,
            recipeProfileProductId: product.id,
            name: existing?.name ?? product.name,
            quantity: existing?.quantity ?? product.quantity,
            selected: !!existing || (!meal.hasGroceriesAdded && !product.atHome),
            atHome: !!product.atHome,
            purchaseOrder: existing?.order ?? null,
          };
          if (product.atHome) {
            atHome.push(item);
          } else {
            needed.push(item);
          }
        }

        // Preserve previously substituted products when reopening the dialog.
        for (const existing of groceries.groceries) {
          if (
            existing.recipeProfileProductId &&
            matchedProductIds.has(existing.recipeProfileProductId)
          )
            continue;
          needed.push({
            id: existing.id,
            recipeProfileProductId: existing.recipeProfileProductId ?? null,
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
        this.loaded.set(true);
      },
      error: (error: unknown) => {
        if (session !== this.session) return;
        this.loading.set(false);
        this.error.set(
          apiErrorMessage(
            error,
            $localize`:@@planning.mealGroceriesFormModal.theMealGroceriesCouldNotBeLoaded:The meal groceries could not be loaded. Please try again.`,
          ),
        );
      },
    });
    this.modal()!.open();
  }

  addManualItem(edit: GroceryItemDraft, atHome: boolean) {
    if (this.saving()) return;
    const item: GrocerySelectItem = {
      id: crypto.randomUUID(),
      recipeProfileProductId: null,
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

  saveEditing(item: GrocerySelectItem, edit: GroceryItemDraft) {
    this.updateItem(item, edit);
  }

  dropItem(event: CdkDragDrop<GrocerySelectItem[]>, atHome: boolean) {
    const needed = [...this.neededItems()];
    const atHomeItems = [...this.atHomeItems()];
    const target = atHome ? atHomeItems : needed;
    if (event.previousContainer === event.container) {
      moveItemInArray(target, event.previousIndex, event.currentIndex);
    } else {
      const source = atHome ? needed : atHomeItems;
      transferArrayItem(source, target, event.previousIndex, event.currentIndex);
    }
    this.neededItems.set(needed.map((item) => ({ ...item, atHome: false })));
    this.atHomeItems.set(atHomeItems.map((item) => ({ ...item, atHome: true })));
  }

  moveItemWithKeyboard(item: GrocerySelectItem, direction: -1 | 1) {
    if (this.saving()) return;
    const moved = moveProduct(this.neededItems(), this.atHomeItems(), item, direction);
    if (!moved) {
      this.reorderAnnouncement.set(
        $localize`:@@groceries.productCannotMoveFurther:${item.name}:itemName: cannot be moved further in that direction.`,
      );
      return;
    }

    this.neededItems.set(moved.needed);
    this.atHomeItems.set(moved.atHome);
    this.reorderAnnouncement.set(
      $localize`:@@groceries.productMoved:${item.name}:itemName: moved to position ${moved.position + 1}:position:.`,
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
          recipeProfileProductId: item.recipeProfileProductId ?? crypto.randomUUID(),
        }))
      : allItems;
    const selectedItems = itemsToSave
      .filter((i) => i.selected)
      .map((i) => ({
        name: i.name,
        quantity: i.quantity,
        recipeProfileProductId: i.recipeProfileProductId,
      }));

    this.saving.set(true);
    this.error.set('');
    const saveProfile: Observable<ApiRecipeProfile | null> = updateProfile
      ? this.recipesStore.saveProfile({
          ...profile!,
          products: itemsToSave.map((item, order) => ({
            id: item.recipeProfileProductId!,
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
        switchMap(() => this.planningStore.addMealGroceries(meal.id, selectedItems)),
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
            $localize`:@@planning.mealGroceriesFormModal.theMealGroceriesCouldNotBeSaved:The meal groceries could not be saved. Please try again.`,
          );
          this.error.set(
            profileWasSaved
              ? $localize`:@@planning.profileSavedBeforeGroceriesFailed:The profile was updated. ${message}:errorMessage:`
              : message,
          );
        },
      });
  }
}
