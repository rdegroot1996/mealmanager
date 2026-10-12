import { Component, input, output } from '@angular/core';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-number-input',
  imports: [AppIcon],
  templateUrl: './number-input.html',
  host: {
    class: 'block shrink-0',
    '[class.w-32]': '!fullWidth()',
    '[class.w-full]': 'fullWidth()',
  },
})
export class NumberInput {
  private static nextId = 0;
  controlId = input(`number-input-${++NumberInput.nextId}`);
  label = input.required<string>();
  fullWidth = input(false);
  value = input.required<number>();
  minimum = input(1);
  maximum = input<number | null>(null);
  disabled = input(false);
  invalid = input(false);
  describedBy = input<string | null>(null);
  valueChange = output<number>();

  whole() {
    return Number.isInteger(this.value());
  }
  displayValue() {
    return Number.isFinite(this.value()) ? this.value() : '';
  }
  change(event: Event) {
    this.valueChange.emit((event.target as HTMLInputElement).valueAsNumber);
  }
  decreaseLabel() {
    return $localize`:@@shared.numberInput.decrease:Decrease ${this.label()}:quantityLabel:`;
  }
  increaseLabel() {
    return $localize`:@@shared.numberInput.increase:Increase ${this.label()}:quantityLabel:`;
  }
}
