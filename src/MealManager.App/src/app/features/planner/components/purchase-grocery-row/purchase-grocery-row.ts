import { Component, input, output } from '@angular/core';
import { GrocerySelectItem } from '../../models/grocery-select-item';
import { selectItemLabel } from '../../../../core/i18n/labels';
import { GroceryDraft } from '../../../../shared/components/grocery-edit-modal/grocery-edit-modal';
import { GroceryRow } from '../../../../shared/components/grocery-row/grocery-row';
@Component({
  selector: 'app-purchase-grocery-row',
  imports: [GroceryRow],
  templateUrl: './purchase-grocery-row.html',
})
export class PurchaseGroceryRow {
  readonly selectItemLabel = selectItemLabel;
  item = input.required<GrocerySelectItem>();
  disabled = input(false);
  toggled = output<void>();
  removed = output<void>();
  changed = output<GroceryDraft>();
  moveRequested = output<-1 | 1>();
}
