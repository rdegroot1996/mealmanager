import { Component, input, output } from '@angular/core';
import { GroceryDraft } from '../grocery-edit-modal/grocery-edit-modal';
import { GroceryRow, GroceryRowItem } from '../grocery-row/grocery-row';

export interface ShoppingListRowItem extends GroceryRowItem {
  checked: boolean;
}

@Component({
  selector: 'app-shopping-list-item-row',
  imports: [GroceryRow],
  templateUrl: './shopping-list-item-row.html',
})
export class ShoppingListItemRow {
  item = input.required<ShoppingListRowItem>();
  pending = input(false);
  toggled = output<ShoppingListRowItem>();
  updated = output<ShoppingListRowItem>();
  removed = output<string>();
  moveRequested = output<-1 | 1>();

  save(edit: GroceryDraft) {
    if (this.pending()) return;
    this.updated.emit({ ...this.item(), ...edit });
  }
}
