import {
  afterNextRender,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, map, of, Subject, switchMap, timer } from 'rxjs';
import { ApiSupermarketProduct, SupermarketProviderId } from '../../../api/models/api-supermarkets';
import { SearchField } from '../../../shared/components/search-field/search-field';
import { AppIcon } from '../../../shared/components/app-icon/app-icon';
import { SupermarketProductSummary } from './supermarket-product-summary';
import { SupermarketsStore } from '../state/supermarkets.store';
import { ReviewRow } from '../models/review-row';
import { supermarketError } from '../models/supermarket-labels';
import { LoadingIndicator } from '../../../shared/components/loading-indicator/loading-indicator';
import { Modal } from '../../../shared/components/modal/modal';

@Component({
  selector: 'app-supermarket-product-picker',
  imports: [SearchField, AppIcon, SupermarketProductSummary, LoadingIndicator, Modal],
  templateUrl: './supermarket-product-picker.html',
})
export class SupermarketProductPicker {
  row = input.required<ReviewRow>();
  provider = input.required<SupermarketProviderId>();
  originalProductId = input<string | null>(null);
  originalProductName = input('');
  selected = output<{ product: ApiSupermarketProduct; remember: boolean }>();
  readonly searchLabel = $localize`:@@supermarkets.searchProducts:Search products`;
  query = signal('');
  products = signal<ApiSupermarketProduct[]>([]);
  searching = signal(false);
  error = signal('');
  replacement = signal<ApiSupermarketProduct | null>(null);
  private replacementDialog = viewChild.required<Modal>('replacementDialog');
  private store = inject(SupermarketsStore);
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  private searches = new Subject<{
    query: string;
    provider: SupermarketProviderId;
    immediate: boolean;
  }>();

  constructor() {
    this.searches
      .pipe(
        switchMap((job) => {
          const query = job.query.trim();
          this.searching.set(!!query);
          this.error.set('');
          this.products.set([]);
          return (job.immediate || !query ? of(0) : timer(300)).pipe(
            switchMap(() => (query ? this.store.search(job.provider, query) : of([]))),
            map((products) => ({ products, error: '' })),
            catchError((error) => of({ products: [], error: supermarketError(error) })),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((result) => {
        this.products.set(result.products);
        this.error.set(result.error);
        this.searching.set(false);
      });
    effect(() => {
      const row = this.row();
      const provider = this.provider();
      untracked(() => {
        this.query.set(row.name);
        this.replacement.set(null);
        this.replacementDialog().close();
        this.searches.next({ query: row.name, provider, immediate: true });
      });
    });
    afterNextRender(() =>
      this.element.nativeElement.querySelector('input')?.focus({ preventScroll: true }),
    );
  }

  search(query = this.query(), immediate = true) {
    this.query.set(query);
    this.searches.next({ query, provider: this.provider(), immediate });
  }

  choose(product: ApiSupermarketProduct) {
    if (product.availability !== 'Available') return;
    if (
      this.row().recipeProfileGroceryItemId &&
      this.originalProductId() &&
      product.id !== this.originalProductId()
    ) {
      this.replacement.set(product);
      this.replacementDialog().open();
      return;
    }
    this.selected.emit({
      product,
      remember: !!this.row().recipeProfileGroceryItemId && !this.originalProductId(),
    });
  }

  confirmReplacement(remember: boolean) {
    const product = this.replacement();
    if (!product) return;
    this.replacement.set(null);
    this.replacementDialog().close();
    this.selected.emit({ product, remember });
  }
}
