import { Component, input, signal } from '@angular/core';
import { ApiSupermarketProduct } from '../../../api/models/api-supermarkets';
import { AppIcon } from '../../../shared/components/app-icon/app-icon';

@Component({
  selector: 'app-supermarket-product-image',
  imports: [AppIcon],
  host: { class: 'block shrink-0' },
  template: `
    <div
      class="flex size-16 items-center justify-center rounded-lg"
      [class.bg-base-200]="placeholderSurface() === 'default'"
      [class.bg-base-100]="placeholderSurface() === 'inset'"
      [class.sm:size-20]="size() === 'large'"
      aria-hidden="true"
    >
      @if (product()?.imageUrl && product()?.imageUrl !== failedUrl()) {
        <img
          class="size-full rounded-lg object-contain"
          [src]="product()!.imageUrl"
          alt=""
          (error)="failedUrl.set(product()!.imageUrl)"
        />
      } @else {
        <app-icon
          name="restaurant"
          class="text-base-content/40"
          [class.size-6]="size() === 'small'"
          [class.size-8]="size() === 'large'"
        />
      }
    </div>
  `,
})
export class SupermarketProductImage {
  product = input<ApiSupermarketProduct | null>(null);
  size = input<'small' | 'large'>('small');
  placeholderSurface = input<'default' | 'inset'>('default');
  failedUrl = signal<string | null>(null);
}
