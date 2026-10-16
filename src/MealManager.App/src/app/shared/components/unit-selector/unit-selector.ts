import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IngredientUnit } from '../../../features/recipes/models/ingredient-unit';
import { displayIngredientUnit } from '../../../features/recipes/models/ingredient-unit';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-unit-selector',
  imports: [FormsModule, AppIcon],
  templateUrl: './unit-selector.html',
})
export class UnitSelector {
  controlId = input<string>();
  invalid = input(false);
  required = input(false);
  describedBy = input<string | null>(null);
  unit = model.required<IngredientUnit | string>();
  readonly units: IngredientUnit[] = ['g', 'kg', 'ml', 'l', 'tsp', 'tbsp', 'pcs'];

  selectUnit(unit: IngredientUnit) {
    this.unit.set(unit);
  }

  displayUnit(unit: string): string {
    return displayIngredientUnit(unit);
  }
}
