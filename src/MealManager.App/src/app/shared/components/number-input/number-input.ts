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
  value = input.required<number | null>();
  allowText = input(false);
  textValue = input('');
  minimum = input(1);
  maximum = input<number | null>(null);
  disabled = input(false);
  required = input(false);
  invalid = input(false);
  describedBy = input<string | null>(null);
  valueChange = output<number>();
  textValueChange = output<string>();

  steppedValue(direction: -1 | 1): number | null {
    const value = this.value();
    if (this.allowText() && value === null && !this.textValue().trim()) {
      const initial = Math.max(1, this.minimum());
      return direction > 0 && (this.maximum() === null || initial <= this.maximum()!)
        ? initial
        : null;
    }
    if (value === null || !Number.isFinite(value)) return null;
    if (this.allowText() ? value <= 0 : !Number.isInteger(value)) return null;
    const next = this.allowText()
      ? Math.round((value + direction) * 1000) / 1000
      : value + direction;
    if (direction < 0 && next < this.minimum()) return null;
    if (direction > 0 && this.maximum() !== null && next > this.maximum()!) return null;
    return next;
  }
  adjust(direction: -1 | 1) {
    const next = this.steppedValue(direction);
    if (!this.disabled() && next !== null) this.valueChange.emit(next);
  }
  displayValue() {
    if (this.allowText()) return this.textValue();
    return this.value() !== null && Number.isFinite(this.value()) ? this.value() : '';
  }
  change(event: Event) {
    const input = event.target as HTMLInputElement;
    if (this.allowText()) this.textValueChange.emit(input.value);
    else this.valueChange.emit(input.valueAsNumber);
  }
  decreaseLabel() {
    return $localize`:@@shared.numberInput.decrease:Decrease ${this.label()}:quantityLabel:`;
  }
  increaseLabel() {
    return $localize`:@@shared.numberInput.increase:Increase ${this.label()}:quantityLabel:`;
  }
}
