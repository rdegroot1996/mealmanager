import { Component, input, output, viewChild } from '@angular/core';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { editItemLabel, reorderItemLabel } from '../../../core/i18n/labels';
import { AppIcon } from '../app-icon/app-icon';
import { GroceryEditModal, GroceryItemDraft } from '../grocery-edit-modal/grocery-edit-modal';

export interface ProductRowItem {
  id: string;
  name: string;
  quantity: number;
}

@Component({
  selector: 'app-product-row',
  imports: [CdkDragHandle, AppIcon, GroceryEditModal],
  host: { class: 'flex min-w-0 items-center gap-2 py-2' },
  templateUrl: './product-row.html',
})
export class ProductRow {
  readonly editItemLabel = editItemLabel;
  readonly reorderItemLabel = reorderItemLabel;
  item = input.required<ProductRowItem>();
  disabled = input(false);
  saved = output<GroceryItemDraft>();
  removed = output<void>();
  moveRequested = output<-1 | 1>();
  editor = viewChild.required<GroceryEditModal>('editor');

  startEditing() {
    if (!this.disabled()) this.editor().open(this.item());
  }

  save(edit: GroceryItemDraft) {
    if (!this.disabled()) this.saved.emit(edit);
  }

  remove() {
    if (!this.disabled()) this.removed.emit();
  }

  move(event: Event, direction: -1 | 1) {
    event.preventDefault();
    if (!this.disabled()) this.moveRequested.emit(direction);
  }
}
