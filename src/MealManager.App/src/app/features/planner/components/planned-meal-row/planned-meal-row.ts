import { Component, input, output } from '@angular/core';
import { ApiPlannedEntry } from '../../../../api/models/api-meal-plan';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { ActionDialog } from '../../../../shared/components/action-dialog/action-dialog';
import {
  addGroceriesForMealLabel,
  editGroceriesForMealLabel,
  moreActionsForItemLabel,
} from '../../../../core/i18n/labels';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { LeftoverBadge } from '../leftover-badge/leftover-badge';
@Component({
  selector: 'app-planned-meal-row',
  imports: [RecipeSummary, ActionDialog, AppIcon, LeftoverBadge],
  host: { class: 'block min-w-0 flex-1' },
  templateUrl: './planned-meal-row.html',
})
export class PlannedMealRow {
  readonly addGroceriesForMealLabel = addGroceriesForMealLabel;
  readonly editGroceriesForMealLabel = editGroceriesForMealLabel;
  readonly moreActionsForItemLabel = moreActionsForItemLabel;
  originalWeekday = input<string | null>(null);
  meal = input.required<ApiPlannedEntry>();
  disabled = input(false);
  groceriesRequested = output<void>();
  profileRequested = output<void>();
  leftoversRequested = output<void>();
  moveRequested = output<void>();
  removeRequested = output<void>();
}
