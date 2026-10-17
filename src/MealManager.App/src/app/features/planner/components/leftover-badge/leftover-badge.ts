import { Component, computed, input } from '@angular/core';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

@Component({
  selector: 'app-leftover-badge',
  imports: [AppIcon],
  template: `<span
    class="inline-flex max-w-full items-center gap-1.5 rounded-md bg-accent px-2 py-1 text-xs text-accent-content"
    data-testid="recipe-status"
  >
    <app-icon name="corner_down_right" class="size-3.5 shrink-0" />{{ label() }}
  </span>`,
})
export class LeftoverBadge {
  originalWeekday = input<string | null>(null);
  readonly label = computed(() =>
    this.originalWeekday()
      ? $localize`:@@planner.leftoversFrom:Leftovers from ${this.originalWeekday()}:weekday:`
      : $localize`:@@planner.leftovers:Leftovers`,
  );
}
