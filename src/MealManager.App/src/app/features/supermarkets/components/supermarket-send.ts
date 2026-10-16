import {
  afterNextRender,
  Component,
  computed,
  effect,
  inject,
  Injector,
  input,
  OnDestroy,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { CurrencyPipe, NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import {
  ApiSupermarketConnection,
  ApiSupermarketProduct,
  ApiSupermarketReview,
  SupermarketProviderId,
} from '../../../api/models/api-supermarkets';
import { Modal } from '../../../shared/components/modal/modal';
import { AppIcon } from '../../../shared/components/app-icon/app-icon';
import { SupermarketsStore } from '../state/supermarkets.store';
import { ReviewRow } from '../models/review-row';
import { outcomeLabel, outcomeReason, supermarketError } from '../models/supermarket-labels';
import { SupermarketProductPicker } from './supermarket-product-picker';
import { SupermarketProductImage } from './supermarket-product-image';
import { SupermarketProductSummary } from './supermarket-product-summary';
import { NumberInput } from '../../../shared/components/number-input/number-input';
import { FormField } from '../../../shared/components/form-field/form-field';
import { LoadingIndicator } from '../../../shared/components/loading-indicator/loading-indicator';
import { ConfirmationModal } from '../../../shared/components/confirmation-modal/confirmation-modal';

type ReviewView =
  'destination' | 'unavailable' | 'loading' | 'products' | 'sending' | 'results' | 'error';

@Component({
  selector: 'app-supermarket-send',
  imports: [
    NgTemplateOutlet,
    CurrencyPipe,
    FormsModule,
    Modal,
    AppIcon,
    SupermarketProductPicker,
    SupermarketProductImage,
    SupermarketProductSummary,
    NumberInput,
    FormField,
    LoadingIndicator,
    ConfirmationModal,
  ],
  templateUrl: './supermarket-send.html',
})
export class SupermarketSend implements OnDestroy {
  private savedDraft = '';
  readonly discardModal = viewChild.required<ConfirmationModal>('discardModal');
  readonly beforeDismiss = () =>
    this.view() !== 'products' ||
    this.draftSnapshot() === this.savedDraft ||
    this.discardModal().confirmDiscard();
  private draftSnapshot() {
    return JSON.stringify(
      this.rows().map((row) => ({
        id: row.shoppingListItemId,
        selected: row.selected,
        product: row.product?.id,
        quantity: row.buyQuantity,
        remember: row.remember,
      })),
    );
  }
  cycleId = input.required<string>();
  hasGroceries = input(true);
  disabled = input(false);
  changed = output<void>();
  readonly status = outcomeLabel;
  readonly reason = outcomeReason;
  readonly packsLabel = $localize`:@@design.exportPacks:Packs to buy`;
  private store = inject(SupermarketsStore);
  private injector = inject(Injector);
  private dialog = viewChild<Modal>('reviewDialog');
  private picker = viewChild<Modal>('pickerDialog');
  providers = signal<ApiSupermarketConnection[]>([]);
  connected = computed(() => this.providers().filter((x) => x.status === 'Connected'));
  provider = signal<SupermarketProviderId | null>(null);
  accountLabel = signal('');
  view = signal<ReviewView>('destination');
  loading = signal(true);
  error = signal('');
  review = signal<ApiSupermarketReview | null>(null);
  rows = signal<ReviewRow[]>([]);
  choosing = signal<string | null>(null);
  choosingRow = computed(() => this.rows().find((x) => x.shoppingListItemId === this.choosing()));
  uncheckedRows = computed(() => this.rows().filter((x) => !x.checked));
  checkedRows = computed(() => this.rows().filter((x) => x.checked));
  checkedExpanded = signal(false);
  totals = computed(() => {
    const groups = new Map<
      string,
      { product: ApiSupermarketProduct; quantity: number; sources: ReviewRow[] }
    >();
    for (const row of [...this.uncheckedRows(), ...this.checkedRows()].filter(
      (x) => x.selected && x.product,
    )) {
      const product = row.product!;
      const group = groups.get(product.id) ?? { product, quantity: 0, sources: [] };
      group.quantity += row.buyQuantity;
      group.sources.push(row);
      groups.set(product.id, group);
    }
    return [...groups.values()];
  });
  estimatedTotal = computed(() => {
    const totals = this.totals();
    if (
      !totals.length ||
      this.needed() ||
      totals.some(
        (line) =>
          line.product.priceCents === null || line.product.currency !== totals[0].product.currency,
      )
    )
      return null;
    return {
      cents: totals.reduce((sum, line) => sum + line.product.priceCents! * line.quantity, 0),
      currency: totals[0].product.currency,
    };
  });
  needed = computed(
    () => this.rows().filter((x) => x.selected && x.product?.availability !== 'Available').length,
  );
  mappingConflict = computed(() => {
    const choices = new Map<string, string>();
    for (const row of this.rows().filter(
      (x) =>
        x.selected &&
        x.product &&
        x.recipeProfileGroceryItemId &&
        (x.remember || !this.originalProductId(x)),
    )) {
      const key = row.recipeProfileGroceryItemId!;
      if (choices.has(key) && choices.get(key) !== row.product!.id) return true;
      choices.set(key, row.product!.id);
    }
    return false;
  });
  selectionValid = computed(
    () =>
      this.rows().some((x) => x.selected) &&
      !this.needed() &&
      !this.mappingConflict() &&
      this.rows()
        .filter((x) => x.selected)
        .every((x) => Number.isInteger(x.buyQuantity) && x.buyQuantity > 0),
  );
  readinessIssues = computed(() => {
    const selected = this.rows().filter((row) => row.selected);
    const issues = new Map<string, { row: ReviewRow; kind: 'product' | 'quantity' | 'mapping' }>();
    for (const row of selected) {
      if (!row.product || row.product.availability !== 'Available')
        issues.set(row.shoppingListItemId, { row, kind: 'product' });
      else if (this.quantityError(row.product, row.buyQuantity))
        issues.set(row.shoppingListItemId, { row, kind: 'quantity' });
    }
    for (const total of this.totals()) {
      if (total.quantity > this.maxQuantity(total.product)) {
        for (const row of total.sources)
          if (!issues.has(row.shoppingListItemId))
            issues.set(row.shoppingListItemId, { row, kind: 'quantity' });
      }
    }
    const remembered = selected.filter(
      (row) =>
        row.product &&
        row.recipeProfileGroceryItemId &&
        (row.remember || !this.originalProductId(row)),
    );
    for (const row of remembered) {
      if (
        remembered.some(
          (other) =>
            other.recipeProfileGroceryItemId === row.recipeProfileGroceryItemId &&
            other.product!.id !== row.product!.id,
        ) &&
        !issues.has(row.shoppingListItemId)
      )
        issues.set(row.shoppingListItemId, { row, kind: 'mapping' });
    }
    return [...issues.values()];
  });
  readinessLabel = computed(() => {
    const issues = this.readinessIssues();
    if (!this.rows().some((row) => row.selected))
      return $localize`:@@supermarkets.selectAnItem:Select at least one list item.`;
    if (!issues.length)
      return $localize`:@@supermarkets.readyToExport:Ready to add to your supermarket cart.`;
    const count = issues.length;
    return count === 1
      ? $localize`:@@supermarkets.oneItemNeedsAttention:1 item needs attention.`
      : $localize`:@@supermarkets.itemsNeedAttention:${count}:count: items need attention.`;
  });
  valid = computed(
    () =>
      this.selectionValid() &&
      this.totals().every(
        (x) =>
          Number.isInteger(x.quantity) &&
          x.quantity > 0 &&
          x.quantity <= this.maxQuantity(x.product),
      ),
  );
  send = computed(() => this.store.results()[this.cycleId()] ?? null);
  pending = computed(() => !!this.store.pending()[this.cycleId()]);
  failure = computed(() => this.store.failures()[this.cycleId()]);
  counts = computed(() => {
    const lines = this.send()?.lines ?? [];
    return {
      added: lines.filter((x) => x.outcome === 'Added').length,
      failed: lines.filter((x) => x.outcome !== 'Added').length,
    };
  });
  failedLines = computed(() => this.send()?.lines.filter((x) => x.outcome !== 'Added') ?? []);
  addedLines = computed(() => this.send()?.lines.filter((x) => x.outcome === 'Added') ?? []);
  destinationName = computed(() => {
    const id = this.provider();
    return this.providers().find((x) => x.provider === id)?.name ?? id ?? '';
  });
  title = computed(() =>
    this.destinationName()
      ? $localize`:@@supermarkets.reviewTitle:Export to ${this.destinationName()}:providerName:`
      : $localize`:@@supermarkets.destinationTitle:Export groceries`,
  );
  private previousCycle = '';
  private generation = 0;
  private requestId = 0;
  private requests = new Subscription();
  private reviewRequest?: Subscription;
  private providersFailed = false;
  private listScroll = 0;

  constructor() {
    effect(() => {
      const pending = this.pending();
      const view = this.view();
      const failure = this.failure();
      const result = this.send();
      if (view === 'sending' && !pending)
        untracked(() => {
          this.error.set(failure ? supermarketError(failure) : '');
          this.view.set(result || failure ? 'results' : 'error');
          this.focusView();
        });
    });
    effect(() => {
      const cycle = this.cycleId();
      untracked(() => {
        if (this.previousCycle) this.store.closeSession(this.previousCycle);
        this.picker()?.close();
        if (this.dialog()?.dialog().nativeElement.open) this.dialog()?.close();
        this.previousCycle = cycle;
        ++this.generation;
        ++this.requestId;
        this.requests.unsubscribe();
        this.requests = new Subscription();
        this.reviewRequest?.unsubscribe();
        this.review.set(null);
        this.rows.set([]);
        this.choosing.set(null);
        this.provider.set(null);
        this.accountLabel.set('');
        this.error.set('');
        this.loadProviders();
      });
    });
  }

  ngOnDestroy() {
    this.store.closeSession(this.previousCycle);
    ++this.generation;
    this.requests.unsubscribe();
    this.reviewRequest?.unsubscribe();
  }

  private loadProviders(onReady?: () => void) {
    const generation = this.generation;
    this.loading.set(true);
    this.providers.set([]);
    this.providersFailed = false;
    this.requests.add(
      this.store.providers().subscribe({
        next: (value) => {
          if (generation !== this.generation) return;
          this.providers.set(value);
          this.loading.set(false);
          onReady?.();
        },
        error: (error) => {
          if (generation !== this.generation) return;
          this.providersFailed = true;
          this.error.set(supermarketError(error));
          this.loading.set(false);
          if (onReady) this.show('error');
        },
      }),
    );
  }

  openReview() {
    if (this.loading() || this.disabled()) return;
    if (this.pending()) {
      this.viewResult();
      return;
    }
    if (this.providersFailed) {
      this.provider.set(null);
      this.show('error');
      return;
    }
    this.error.set('');
    if (!this.connected().length) {
      this.provider.set(null);
      this.show('unavailable');
      return;
    }
    if (this.connected().length > 1) {
      this.provider.set(null);
      this.show('destination');
      return;
    }
    this.loadReview(this.connected()[0].provider);
  }

  chooseProvider(provider: SupermarketProviderId) {
    if (!this.connected().some((x) => x.provider === provider) || this.pending()) return;
    this.loadReview(provider);
  }

  private loadReview(provider: SupermarketProviderId) {
    this.reviewRequest?.unsubscribe();
    const request = ++this.requestId;
    const generation = this.generation;
    this.provider.set(provider);
    this.accountLabel.set(
      this.providers().find((x) => x.provider === provider)?.accountLabel ?? '',
    );
    this.error.set('');
    this.show('loading');
    this.reviewRequest = this.store.review(this.cycleId(), provider).subscribe({
      next: (review) => {
        if (request !== this.requestId || generation !== this.generation) return;
        this.review.set(review);
        this.rows.set(
          review.items.map((item) => ({
            ...item,
            selected: !this.blocked(item.shoppingListItemId) && !item.checked,
            remember: !item.product,
            buyQuantity: item.quantity,
          })),
        );
        this.checkedExpanded.set(this.rows().some((x) => x.checked && x.selected));
        this.savedDraft = this.draftSnapshot();
        this.choosing.set(null);
        this.show('products');
      },
      error: (error) => {
        if (request === this.requestId && generation === this.generation) {
          this.error.set(supermarketError(error));
          this.show('error');
        }
      },
    });
  }

  startNewReview() {
    if (this.pending()) return;
    this.store.clearAttempt(this.cycleId());
    this.review.set(null);
    this.rows.set([]);
    this.error.set('');
    if (this.providersFailed) {
      this.show('loading');
      this.loadProviders(() => this.openReview());
    } else this.openReview();
  }

  backToDestination() {
    this.provider.set(null);
    this.review.set(null);
    this.rows.set([]);
    this.show('destination');
  }

  close() {
    this.onClosed();
    this.dialog()?.close();
  }
  onClosed() {
    ++this.requestId;
    this.reviewRequest?.unsubscribe();
    this.picker()?.close();
    this.store.closeSession(this.cycleId());
    this.review.set(null);
    this.rows.set([]);
    this.choosing.set(null);
    this.accountLabel.set('');
    this.provider.set(null);
    this.view.set('destination');
  }

  blocked(id: string) {
    return (this.store.completed()[this.cycleId()] ?? []).includes(id);
  }

  originalProductId(row: ReviewRow) {
    return this.originalProduct(row)?.id ?? null;
  }
  originalProduct(row: ReviewRow) {
    return this.review()?.items.find((x) => x.shoppingListItemId === row.shoppingListItemId)
      ?.product;
  }
  maxQuantity(product: ApiSupermarketProduct) {
    return Math.min(product.maxQuantity ?? 999, 999);
  }
  quantityError(product: ApiSupermarketProduct, quantity: number) {
    return Number.isInteger(quantity) && quantity > 0 && quantity <= this.maxQuantity(product)
      ? null
      : $localize`:@@supermarkets.quantityRange:Enter a whole number from 1 to ${this.maxQuantity(product)}:maximum:.`;
  }

  changeRow(id: string, patch: Partial<ReviewRow>) {
    if (this.blocked(id)) return;
    const old = this.rows().find((x) => x.shoppingListItemId === id);
    if (!old) return;
    this.rows.update((rows) =>
      rows.map((x) => (x.shoppingListItemId === id ? { ...x, ...patch } : x)),
    );
  }

  productChoiceLabel(row: ReviewRow) {
    return row.product
      ? $localize`:@@supermarkets.changeProductFor:Change supermarket product for ${row.name}:itemName:`
      : $localize`:@@supermarkets.chooseProductFor:Choose supermarket product for ${row.name}:itemName:`;
  }

  choose(id: string) {
    if (
      this.blocked(id) ||
      !this.rows().some((row) => row.shoppingListItemId === id && row.selected)
    )
      return;
    this.listScroll = this.dialog()?.body().nativeElement.scrollTop ?? 0;
    this.choosing.set(id);
    afterNextRender(
      () => {
        if (this.choosing() === id && this.dialog()?.dialog().nativeElement.open)
          this.picker()?.open();
      },
      { injector: this.injector },
    );
  }

  select(choice: { product: ApiSupermarketProduct; remember: boolean }) {
    const row = this.choosingRow();
    if (!row || choice.product.availability !== 'Available') return;
    this.changeRow(row.shoppingListItemId, { ...choice, selected: true });
    if (row.recipeProfileGroceryItemId && !this.originalProductId(row)) {
      for (const other of this.rows().filter(
        (x) => x.recipeProfileGroceryItemId === row.recipeProfileGroceryItemId && !x.product,
      ))
        this.changeRow(other.shoppingListItemId, { product: choice.product, remember: true });
    }
    this.backToProducts();
  }

  backToProducts() {
    const rowId = this.choosing();
    this.choosing.set(null);
    this.picker()?.close();
    this.view.set('products');
    afterNextRender(
      () => {
        const modal = this.dialog();
        if (!modal?.dialog().nativeElement.open || this.view() !== 'products') return;
        const button = [
          ...modal.body().nativeElement.querySelectorAll<HTMLButtonElement>('[data-grocery-id]'),
        ].find((x) => x.dataset['groceryId'] === rowId);
        if (rowId && button) {
          modal.body().nativeElement.scrollTop = this.listScroll;
          button.focus({ preventScroll: true });
        } else {
          modal.body().nativeElement.scrollTop = 0;
          modal.focusTitle();
        }
      },
      { injector: this.injector },
    );
  }

  onPickerClosed() {
    if (this.choosing()) this.backToProducts();
  }

  confirm() {
    const review = this.review();
    if (!review || this.view() !== 'products' || !this.valid() || this.pending()) return;
    const generation = this.generation;
    this.error.set('');
    this.show('sending');
    this.requests.add(
      this.store
        .confirm(
          this.cycleId(),
          review,
          this.rows(),
          this.totals().map((x) => ({ productId: x.product.id, quantity: x.quantity })),
          this.accountLabel(),
        )
        .subscribe({
          next: () => {
            if (generation === this.generation) {
              this.changed.emit();
              if (this.dialog()?.dialog().nativeElement.open) {
                this.view.set('results');
                this.focusView();
              }
            }
          },
          error: (error) => {
            if (generation === this.generation) {
              this.changed.emit();
              if (this.dialog()?.dialog().nativeElement.open) {
                this.error.set(supermarketError(error));
                this.view.set('results');
                this.focusView();
              }
            }
          },
        }),
    );
  }

  viewResult() {
    const attempt = this.store.attempt(this.cycleId());
    const currentRequest = this.pending() || this.failure();
    this.provider.set(
      currentRequest
        ? (attempt?.provider ?? this.send()?.provider ?? null)
        : (this.send()?.provider ?? null),
    );
    this.accountLabel.set(
      currentRequest ? (attempt?.accountLabel ?? '') : (this.send()?.accountLabel ?? ''),
    );
    this.error.set(this.failure() ? supermarketError(this.failure()) : '');
    this.show(this.pending() ? 'sending' : 'results');
  }

  private show(view: ReviewView) {
    this.view.set(view);
    this.store.openSession(this.cycleId());
    this.dialog()?.open();
    this.focusView();
  }

  private focusView() {
    const view = this.view();
    afterNextRender(
      () => {
        const modal = this.dialog();
        if (modal?.dialog().nativeElement.open && this.view() === view) {
          modal.body().nativeElement.scrollTop = 0;
          modal.focusTitle();
        }
      },
      { injector: this.injector },
    );
  }
}
