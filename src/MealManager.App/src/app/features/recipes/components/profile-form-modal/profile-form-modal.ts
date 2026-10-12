import { Component, computed, signal, viewChild } from '@angular/core';
import { moveProduct } from '../../../../shared/components/product-row/product-order';
import { Modal } from '../../../../shared/components/modal/modal';
import {
  ApiRecipeProduct,
  ApiRecipeProfile,
  ApiRecipeIngredient,
} from '../../../../api/models/api-recipe';
import { ProductRow } from '../../../../shared/components/product-row/product-row';
import { Observable } from 'rxjs';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
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
import { FormsModule } from '@angular/forms';
import { NumberInput } from '../../../../shared/components/number-input/number-input';
import { FormField } from '../../../../shared/components/form-field/form-field';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

@Component({
  selector: 'app-profile-form-modal',
  imports: [
    Modal,
    FormsModule,
    FormField,
    NumberInput,
    ProductRow,
    CdkDrag,
    CdkDropList,
    GroceryEditModal,
    AppIcon,
  ],
  templateUrl: './profile-form-modal.html',
})
export class ProfileFormModal {
  ngOnDestroy() {
    this.endSession();
  }
  private session = 0;
  endSession() {
    ++this.session;
  }
  modal = viewChild<Modal>('modal');
  itemEditor = viewChild.required<GroceryEditModal>('itemEditor');
  readonly neededLabel = $localize`:@@groceries.needed:Needed`;
  readonly atHomeLabel = $localize`:@@groceries.usuallyAtHome:Usually at home`;

  startAddItem(target: 'needed' | 'atHome') {
    if (this.saving() || !this.profile()) return;
    this.addingItemTo.set(target);
    this.itemEditor().openNew();
  }

  profile = signal<ApiRecipeProfile | null>(null);
  editingProfile = computed(() => (this.profile()?.id ? this.profile() : null));
  profileName = signal('');
  profileServings = signal(4);
  neededItems = signal<ApiRecipeProduct[]>([]);
  atHomeItems = signal<ApiRecipeProduct[]>([]);
  addingItemTo = signal<'needed' | 'atHome' | null>(null);
  saving = signal(false);
  error = signal('');
  reorderAnnouncement = signal('');
  onSave: ((profile: ApiRecipeProfile) => Observable<ApiRecipeProfile>) | null = null;
  ingredients = signal<ApiRecipeIngredient[]>([]);

  open(
    profile?: ApiRecipeProfile,
    saveFn?: (profile: ApiRecipeProfile) => Observable<ApiRecipeProfile>,
    ingredients: ApiRecipeIngredient[] = [],
    baseServings = 4,
  ) {
    ++this.session;
    this.onSave = saveFn ?? null;
    this.saving.set(false);
    this.error.set('');
    this.profile.set(profile ?? { id: '', name: '', servings: baseServings, products: [] });
    this.profileName.set(profile?.name ?? '');
    this.profileServings.set(profile?.servings ?? baseServings);
    this.setProducts(profile?.products ?? []);
    this.addingItemTo.set(null);
    this.ingredients.set(ingredients);
    this.modal()!.open();
  }

  addItem(edit: GroceryItemDraft, atHome: boolean) {
    if (this.saving()) return;
    const item: ApiRecipeProduct = {
      id: crypto.randomUUID(),
      name: edit.name,
      quantity: edit.quantity,
      atHome,
      order: this.neededItems().length + this.atHomeItems().length,
    };
    if (item.atHome) {
      this.atHomeItems.update((items) => [...items, item]);
    } else {
      this.neededItems.update((items) => [...items, item]);
    }
    this.addingItemTo.set(null);
    this.error.set('');
  }

  initializeFromIngredients() {
    if (this.saving() || this.neededItems().length || this.atHomeItems().length) return;
    this.neededItems.set(
      this.ingredients().map((ingredient, order) => ({
        id: crypto.randomUUID(),
        name: ingredient.name,
        quantity: 1,
        atHome: false,
        order,
      })),
    );
  }

  updateNeededItem(index: number, item: { name: string; quantity: number }) {
    if (this.saving()) return;
    this.neededItems.update((items) =>
      items.map((current, currentIndex) =>
        currentIndex === index ? { ...current, name: item.name, quantity: item.quantity } : current,
      ),
    );
  }

  updateAtHomeItem(index: number, item: { name: string; quantity: number }) {
    if (this.saving()) return;
    this.atHomeItems.update((items) =>
      items.map((current, currentIndex) =>
        currentIndex === index ? { ...current, name: item.name, quantity: item.quantity } : current,
      ),
    );
  }

  dropItem(event: CdkDragDrop<ApiRecipeProduct[]>, atHome: boolean) {
    if (this.saving()) return;
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

  moveItemWithKeyboard(item: ApiRecipeProduct, direction: -1 | 1) {
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

  removeNeededItem(index: number) {
    if (this.saving()) return;
    this.neededItems.update((items) => items.filter((_, i) => i !== index));
  }

  removeAtHomeItem(index: number) {
    if (this.saving()) return;
    this.atHomeItems.update((items) => items.filter((_, i) => i !== index));
  }

  confirm() {
    const session = this.session;
    if (this.saving() || !this.profile()) return;
    const name = this.profileName().trim();
    if (!name) {
      this.error.set(
        $localize`:@@recipes.profileFormModal.profileNameIsRequired:Profile name is required.`,
      );
      return;
    }
    if (!Number.isInteger(this.profileServings()) || this.profileServings() <= 0) {
      this.error.set(
        $localize`:@@recipes.profileFormModal.servingsMustBeAPositiveWholeNumber:Servings must be a positive whole number.`,
      );
      return;
    }
    const allProducts: ApiRecipeProduct[] = [
      ...this.neededItems().map((p) => ({ ...p, atHome: false })),
      ...this.atHomeItems().map((p) => ({ ...p, atHome: true })),
    ].map((product, order) => ({ ...product, order }));
    if (!this.onSave) return;
    this.saving.set(true);
    this.error.set('');
    this.onSave({
      id: this.profile()?.id ?? '',
      name,
      servings: this.profileServings(),
      products: allProducts,
    }).subscribe({
      next: () => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.modal()?.close();
      },
      error: (response: unknown) => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.error.set(
          apiErrorMessage(
            response,
            $localize`:@@recipes.profileFormModal.theProfileCouldNotBeSaved:The profile could not be saved.`,
          ),
        );
      },
    });
  }

  private setProducts(products: ApiRecipeProduct[]) {
    const ordered = [...products].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    this.neededItems.set(structuredClone(ordered.filter((product) => !product.atHome)));
    this.atHomeItems.set(structuredClone(ordered.filter((product) => product.atHome)));
  }
}
