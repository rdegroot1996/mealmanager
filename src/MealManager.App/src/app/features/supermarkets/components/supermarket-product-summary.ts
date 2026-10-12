import { CurrencyPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { ApiSupermarketProduct } from '../../../api/models/api-supermarkets';
import { availability } from '../models/supermarket-labels';
import { SupermarketProductImage } from './supermarket-product-image';

@Component({
  selector: 'app-supermarket-product-summary',
  imports: [CurrencyPipe, SupermarketProductImage],
  host: { class: 'block min-w-0' },
  template: `
    <div class="flex min-w-0 items-center gap-3">
      <app-supermarket-product-image
        [product]="product()"
        size="large"
        [placeholderSurface]="placeholderSurface()"
      />
      <span class="min-w-0">
        <span class="block break-words text-sm font-medium leading-5">{{ product().name }}</span>
        <span class="mt-1 block text-xs font-normal leading-5 text-base-content/75">
          {{ product().pack }}
          @if (product().priceCents !== null) {
            &middot; {{ product().priceCents! / 100 | currency: product().currency }}
          }
        </span>
        @if (product().availability !== 'Available') {
          <span class="mt-1 block text-xs font-normal leading-5 text-error-content">{{
            availability(product().availability)
          }}</span>
        }
      </span>
    </div>
  `,
})
export class SupermarketProductSummary {
  product = input.required<ApiSupermarketProduct>();
  placeholderSurface = input<'default' | 'inset'>('default');
  readonly availability = availability;
}
