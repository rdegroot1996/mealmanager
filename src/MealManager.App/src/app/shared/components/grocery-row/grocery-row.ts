import { Component, input, output, viewChild } from '@angular/core';
import { CdkDragHandle } from '@angular/cdk/drag-drop';
import { editItemLabel, reorderItemLabel } from '../../../core/i18n/labels';
import { AppIcon } from '../app-icon/app-icon';
import { GroceryEditModal, GroceryDraft } from '../grocery-edit-modal/grocery-edit-modal';

export interface GroceryRowItem {
  id: string;
  name: string;
  quantity: number;
}

@Component({
  selector: 'app-grocery-row',
  imports: [CdkDragHandle, AppIcon, GroceryEditModal],
  host: { class: 'flex min-w-0 items-center gap-1 py-2' },
  templateUrl: './grocery-row.html',
})
export class GroceryRow {
  readonly editItemLabel = editItemLabel;
  readonly reorderItemLabel = reorderItemLabel;
  item = input.required<GroceryRowItem>();
  disabled = input(false);
  saved = output<GroceryDraft>();
  removed = output<void>();
  moveRequested = output<-1 | 1>();
  editor = viewChild.required<GroceryEditModal>('editor');

  startEditing() {
    if (!this.disabled()) this.editor().open(this.item());
  }

  save(edit: GroceryDraft) {
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
