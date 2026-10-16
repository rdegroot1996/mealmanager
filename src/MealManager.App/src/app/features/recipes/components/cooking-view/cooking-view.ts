import { Component, inject, input, LOCALE_ID, output } from '@angular/core';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { DecimalPipe } from '@angular/common';
import { ApiRecipeIngredient, ApiRecipeProfile } from '../../../../api/models/api-recipe';
import { Recipe } from '../../models/recipe';
import { CookingScreenLock } from '../../services/cooking-screen-lock';
import { displayIngredientUnit } from '../../models/ingredient-unit';

@Component({
  selector: 'app-cooking-view',
  host: { class: 'block' },
  imports: [DecimalPipe, AppIcon],
  providers: [CookingScreenLock],
  templateUrl: './cooking-view.html',
})
export class CookingView {
  recipe = input.required<Recipe>();
  profile = input.required<ApiRecipeProfile>();
  ingredients = input.required<ApiRecipeIngredient[]>();
  closed = output<void>();
  screen = inject(CookingScreenLock);
  locale = inject(LOCALE_ID);
  unit = displayIngredientUnit;
  ngOnInit() {
    this.screen.setEnabled(true);
  }
  status() {
    switch (this.screen.state()) {
      case 'active':
        return $localize`:@@cooking.active:Your screen stays on while cooking mode is open.`;
      case 'requesting':
        return $localize`:@@cooking.requesting:Trying to keep your screen on while cooking mode is open…`;
      case 'paused':
        return $localize`:@@cooking.paused:Paused: the screen may turn off.`;
      case 'unavailable':
        return $localize`:@@cooking.unavailable:Unavailable: the screen may turn off.`;
      default:
        return $localize`:@@cooking.off:Screen uses your device settings`;
    }
  }
}
