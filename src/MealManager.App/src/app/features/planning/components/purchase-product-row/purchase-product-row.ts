import { Component, input, output } from '@angular/core';
import { GrocerySelectItem } from '../../models/grocery-select-item';
import { selectItemLabel } from '../../../../core/i18n/labels';
import { GroceryItemDraft } from '../../../../shared/components/grocery-edit-modal/grocery-edit-modal';
import { ProductRow } from '../../../../shared/components/product-row/product-row';
@Component({
  selector: 'app-purchase-product-row',
  imports: [ProductRow],
  templateUrl: './purchase-product-row.html',
})
export class PurchaseProductRow {
  readonly selectItemLabel = selectItemLabel;
  item = input.required<GrocerySelectItem>();
  disabled = input(false);
  toggled = output<void>();
  removed = output<void>();
  changed = output<GroceryItemDraft>();
  moveRequested = output<-1 | 1>();
}
