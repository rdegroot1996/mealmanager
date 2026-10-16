import { Component, input } from '@angular/core';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-brand',
  imports: [AppIcon],
  host: { class: 'inline-flex min-w-0' },
  template: `
    <span
      class="inline-flex items-center"
      [class.gap-2]="size() === 'compact'"
      [class.gap-3]="size() === 'large'"
    >
      <span
        class="flex shrink-0 items-center justify-center bg-secondary"
        [class]="size() === 'compact' ? 'size-8 rounded-[10px]' : 'size-12 rounded-[14px]'"
      >
        <app-icon
          name="restaurant"
          class="text-primary"
          [class]="size() === 'compact' ? 'size-5' : 'size-8'"
        />
      </span>
      <span
        class="font-display font-medium"
        [class]="size() === 'compact' ? 'text-base' : 'text-3xl'"
        >MealManager</span
      >
    </span>
  `,
})
export class AppBrand {
  size = input<'compact' | 'large'>('compact');
}
