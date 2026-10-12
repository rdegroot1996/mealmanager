import { Component, input, output } from '@angular/core';
import { ApiPlanningEntry } from '../../../../api/models/api-planning';
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
  selector: 'app-planning-meal-row',
  imports: [RecipeSummary, ActionDialog, AppIcon, LeftoverBadge],
  host: { class: 'block min-w-0 flex-1' },
  templateUrl: './planning-meal-row.html',
})
export class PlanningMealRow {
  readonly addGroceriesForMealLabel = addGroceriesForMealLabel;
  readonly editGroceriesForMealLabel = editGroceriesForMealLabel;
  readonly moreActionsForItemLabel = moreActionsForItemLabel;
  originalWeekday = input<string | null>(null);
  meal = input.required<ApiPlanningEntry>();
  disabled = input(false);
  readOnly = input(false);
  groceriesRequested = output<void>();
  profileRequested = output<void>();
  leftoversRequested = output<void>();
  moveRequested = output<void>();
  removeRequested = output<void>();
}
