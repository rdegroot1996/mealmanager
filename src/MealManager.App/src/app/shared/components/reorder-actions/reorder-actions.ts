import { Component, input, output } from '@angular/core';
import { reorderItemLabel } from '../../../core/i18n/labels';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-reorder-actions',
  imports: [AppIcon],
  host: {
    '(keydown.arrowup)': 'moveWithKeyboard($event, -1)',
    '(keydown.arrowdown)': 'moveWithKeyboard($event, 1)',
  },
  template: `
    <div
      class="flex h-full items-center"
      [class.flex-col]="stacked()"
      [class.justify-between]="stacked()"
      role="group"
      [attr.aria-label]="reorderItemLabel(name())"
    >
      <button
        type="button"
        class="btn btn-ghost btn-square size-10 min-h-10 enabled:text-neutral-content"
        [disabled]="disabled() || !canMoveUp()"
        [attr.aria-label]="moveLabel(-1)"
        [attr.title]="moveLabel(-1)"
        (click)="moved.emit(-1)"
      >
        <app-icon name="arrow_up" class="size-5" />
      </button>
      <button
        type="button"
        class="btn btn-ghost btn-square size-10 min-h-10 enabled:text-neutral-content"
        [disabled]="disabled() || !canMoveDown()"
        [attr.aria-label]="moveLabel(1)"
        [attr.title]="moveLabel(1)"
        (click)="moved.emit(1)"
      >
        <app-icon name="arrow_down" class="size-5" />
      </button>
    </div>
  `,
})
export class ReorderActions {
  readonly reorderItemLabel = reorderItemLabel;
  name = input.required<string>();
  stacked = input(false);
  disabled = input(false);
  canMoveUp = input(true);
  canMoveDown = input(true);
  moved = output<-1 | 1>();

  moveLabel(direction: -1 | 1) {
    return direction < 0
      ? $localize`:@@common.moveItemUp:Move ${this.name()}:itemName: up`
      : $localize`:@@common.moveItemDown:Move ${this.name()}:itemName: down`;
  }

  moveWithKeyboard(event: Event, direction: -1 | 1) {
    event.preventDefault();
    if (!this.disabled() && (direction < 0 ? this.canMoveUp() : this.canMoveDown())) {
      this.moved.emit(direction);
    }
  }
}
