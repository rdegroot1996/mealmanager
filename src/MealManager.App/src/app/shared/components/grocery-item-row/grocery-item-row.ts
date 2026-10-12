import { Component, input, output } from '@angular/core';
import { GroceryItemDraft } from '../grocery-edit-modal/grocery-edit-modal';
import { ProductRow, ProductRowItem } from '../product-row/product-row';

export interface GroceryRowItem extends ProductRowItem {
  checked: boolean;
}

@Component({
  selector: 'app-grocery-item-row',
  imports: [ProductRow],
  templateUrl: './grocery-item-row.html',
})
export class GroceryItemRow {
  item = input.required<GroceryRowItem>();
  pending = input(false);
  toggled = output<GroceryRowItem>();
  updated = output<GroceryRowItem>();
  removed = output<string>();
  moveRequested = output<-1 | 1>();

  save(edit: GroceryItemDraft) {
    if (this.pending()) return;
    this.updated.emit({ ...this.item(), ...edit });
  }
}
