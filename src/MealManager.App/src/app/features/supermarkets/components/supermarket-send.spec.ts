import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SupermarketSend } from './supermarket-send';
import { SupermarketsStore } from '../state/supermarkets.store';
import {
  ApiSupermarketConnection,
  ApiSupermarketReview,
  ApiSupermarketSend,
  SupermarketProviderId,
} from '../../../api/models/api-supermarkets';
import { ExportAttempt } from '../models/export-attempt';
import { mockSupermarketProducts } from '../../../../mocks/supermarkets';

const otherProvider = 'other' as SupermarketProviderId;
const review: ApiSupermarketReview = {
  provider: 'picnic',
  accountId: 'account',
  connectionGeneration: 'generation',
  revision: 'version',
  unreviewedMeals: 0,
  items: [
    {
      groceryItemId: 'a',
      profileProductId: 'slot',
      name: 'Noodles',
      quantity: 2,
      checked: false,
      group: 'Meals',
      product: mockSupermarketProducts[0],
    },
    {
      groceryItemId: 'b',
      profileProductId: null,
      name: 'Already bought',
      quantity: 1,
      checked: true,
      group: 'Other items',
      product: mockSupermarketProducts[0],
    },
  ],
};
const result: ApiSupermarketSend = {
  planningCycleId: 'cycle',
  provider: 'picnic',
  accountId: 'account',
  accountLabel: 'Account',
  connectionGeneration: 'generation',
  lines: [
    {
      productId: 's1001',
      productName: 'Noodles',
      pack: '250 g',
      quantity: 2,
      outcome: 'Added',
      reason: null,
      localWarning: null,
      groceryItemIds: ['a'],
    },
  ],
};
function mockStore() {
  const attempts = new Map<string, ExportAttempt>();
  return {
    providers: vi.fn(() =>
      of<ApiSupermarketConnection[]>([
        { provider: 'picnic', name: 'Picnic', status: 'Connected', accountLabel: 'Account' },
      ]),
    ),
    results: signal<Record<string, ApiSupermarketSend | undefined>>({}),
    pending: signal<Record<string, boolean>>({}),
    completed: signal<Record<string, string[]>>({}),
    failures: signal<Record<string, unknown>>({}),
    attempt: vi.fn((cycle: string) => attempts.get(cycle)),
    saveAttempt: vi.fn((cycle: string, attempt: ExportAttempt) =>
      attempts.set(cycle, structuredClone(attempt)),
    ),
    clearAttempt: vi.fn((cycle: string) => attempts.delete(cycle)),
    openSession: vi.fn(),
    closeSession: vi.fn(),
    review: vi.fn(() => of(structuredClone(review))),
    search: vi.fn(() => of(mockSupermarketProducts)),
    confirm: vi.fn(() => of(result)),
  };
}

describe('supermarket handoff dialog', () => {
  let fixture: ComponentFixture<SupermarketSend>;
  let store: ReturnType<typeof mockStore>;
  let component: SupermarketSend;
  beforeEach(async () => {
    store = mockStore();
    await TestBed.configureTestingModule({
      imports: [SupermarketSend],
      providers: [{ provide: SupermarketsStore, useValue: store }],
    }).compileComponents();
    fixture = TestBed.createComponent(SupermarketSend);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('cycleId', 'cycle');
    await fixture.whenStable();
    for (const dialog of fixture.nativeElement.querySelectorAll(
      'dialog',
    ) as NodeListOf<HTMLDialogElement>) {
      dialog.showModal = vi.fn(() => {
        dialog.open = true;
      });
      dialog.close = vi.fn(() => {
        dialog.open = false;
        dialog.dispatchEvent(new Event('close'));
      });
    }
  });

  it('uses a quiet action and shows no connection message or Settings link until requested', async () => {
    store.providers.mockReturnValue(of([]));
    fixture.componentRef.setInput('cycleId', 'unconnected');
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(false);
    fixture.nativeElement.querySelector('section button').click();
    await fixture.whenStable();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('No supermarket is connected.');
    expect(dialog.querySelector('a')).toBeNull();
    expect(dialog.textContent).not.toContain('Settings');
    expect(store.review).not.toHaveBeenCalled();
  });

  it('shows a spinner during initial review and renders remembered product images on completion', async () => {
    const response = new Subject<ApiSupermarketReview>();
    store.review.mockReturnValueOnce(response);
    component.openReview();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog.querySelector('[role="status"] .loading-spinner')).not.toBeNull();
    expect(dialog.textContent).toContain('Loading groceries and product choices…');
    response.next(structuredClone(review));
    await fixture.whenStable();
    expect(dialog.querySelector('.loading-spinner')).toBeNull();
    expect(dialog.querySelector('[data-review-row="a"] img')?.getAttribute('src')).toBe(
      mockSupermarketProducts[0].imageUrl,
    );
  });

  it('estimates grouped product totals and hides incomplete prices', () => {
    component.openReview();
    component.changeRow('b', { selected: true });
    const product = mockSupermarketProducts[0];
    component.changeRow('a', { buyQuantity: 3 });
    expect(component.estimatedTotal()).toEqual({
      cents: product.priceCents! * 4,
      currency: product.currency,
    });
    component.changeRow('a', { product: { ...product, priceCents: null } });
    expect(component.estimatedTotal()).toBeNull();
  });

  it('requires an explicit single destination when several are connected', async () => {
    store.providers.mockReturnValue(
      of([
        { provider: 'picnic', name: 'Picnic', status: 'Connected', accountLabel: 'Account' },
        { provider: otherProvider, name: 'Other shop', status: 'Connected', accountLabel: 'Other' },
      ]),
    );
    fixture.componentRef.setInput('cycleId', 'multiple');
    await fixture.whenStable();
    component.openReview();
    expect(component.view()).toBe('destination');
    expect(component.provider()).toBeNull();
    expect(store.review).not.toHaveBeenCalled();
    store.review.mockReturnValue(of({ ...review, provider: otherProvider }));
    component.chooseProvider(otherProvider);
    expect(store.review).toHaveBeenCalledWith('multiple', otherProvider);
    expect(component.provider()).toBe(otherProvider);
    expect(component.title()).toBe('Export to Other shop');
  });

  it('does not let an earlier result override the selected destination or carry its draft', async () => {
    store.results.set({ cycle: result });
    store.providers.mockReturnValue(
      of([
        { provider: 'picnic', name: 'Picnic', status: 'Connected', accountLabel: 'Account' },
        { provider: otherProvider, name: 'Other shop', status: 'Connected', accountLabel: 'Other' },
      ]),
    );
    fixture.componentRef.setInput('cycleId', 'multiple');
    await fixture.whenStable();
    store.results.set({ multiple: { ...result, planningCycleId: 'multiple' } });
    component.openReview();
    component.chooseProvider('picnic');
    component.changeRow('a', { buyQuantity: 4 });
    component.backToDestination();
    store.review.mockReturnValue(
      of({
        ...review,
        provider: otherProvider,
        accountId: 'other-account',
        items: review.items.map((x) => ({ ...x, product: null })),
      }),
    );
    component.chooseProvider(otherProvider);
    expect(store.review).toHaveBeenLastCalledWith('multiple', otherProvider);
    expect(component.rows()[0].product).toBeNull();
    expect(component.rows()[0].buyQuantity).toBe(2);
  });

  it('skips unavailable connections rather than selecting them', async () => {
    store.providers.mockReturnValue(
      of([
        { provider: 'picnic', name: 'Picnic', status: 'Connected', accountLabel: 'Account' },
        {
          provider: otherProvider,
          name: 'Other shop',
          status: 'ReconnectRequired',
          accountLabel: 'Other',
        },
      ]),
    );
    fixture.componentRef.setInput('cycleId', 'one-ready');
    await fixture.whenStable();
    component.openReview();
    expect(store.review).toHaveBeenCalledWith('one-ready', 'picnic');
    component.chooseProvider(otherProvider);
    expect(store.review).toHaveBeenCalledTimes(1);
  });

  it('retries a failed connection lookup without claiming there are no connections', async () => {
    store.providers.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 503 })));
    fixture.componentRef.setInput('cycleId', 'lookup-failed');
    await fixture.whenStable();
    component.openReview();
    expect(component.view()).toBe('error');
    store.providers.mockReturnValue(
      of([{ provider: 'picnic', name: 'Picnic', status: 'Connected', accountLabel: 'Account' }]),
    );
    component.startNewReview();
    expect(component.view()).toBe('products');
    expect(store.review).toHaveBeenCalledWith('lookup-failed', 'picnic');
  });

  it('uses a separate smaller picker and restores the originating row focus', async () => {
    component.openReview();
    await fixture.whenStable();
    const main = fixture.nativeElement.querySelectorAll('dialog')[0] as HTMLDialogElement;
    const picker = fixture.nativeElement.querySelectorAll('dialog')[1] as HTMLDialogElement;
    const button = main.querySelector('[data-grocery-id="a"]') as HTMLButtonElement;
    const body = main.querySelector('.overflow-y-auto') as HTMLElement;
    body.scrollTop = 120;
    const focus = vi.spyOn(button, 'focus');
    button.focus();
    button.click();
    await fixture.whenStable();
    expect(main.open).toBe(true);
    expect(picker.open).toBe(true);
    expect(picker.querySelector('.modal-box')?.classList.contains('max-w-3xl')).toBe(false);
    component.select({ product: mockSupermarketProducts[1], remember: false });
    await fixture.whenStable();
    expect(picker.open).toBe(false);
    expect(document.activeElement).toBe(main.querySelector('[data-grocery-id="a"]'));
    expect(component.view()).toBe('products');
    expect(body.scrollTop).toBe(120);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
  });

  it('keeps results inside the dialog and has no cycle range or new-review action', async () => {
    store.results.set({ cycle: result });
    component.viewResult();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('section').textContent.trim()).toBe('Export');
    const main = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(main.textContent).not.toContain('Open a new review');
    expect(main.querySelector('time')).toBeNull();
  });

  it('allows reducing an oversized source suggestion before exporting', () => {
    store.review.mockReturnValue(
      of({ ...review, items: [{ ...review.items[0], quantity: 1000 }] }),
    );
    component.openReview();
    expect(component.selectionValid()).toBe(true);
    expect(component.valid()).toBe(false);
    component.changeRow('a', { buyQuantity: 2 });
    expect(component.valid()).toBe(true);
    component.confirm();
    expect(store.confirm).toHaveBeenCalledWith(
      'cycle',
      expect.anything(),
      expect.anything(),
      [{ productId: 's1001', quantity: 2 }],
      'Account',
    );
  });

  it('excludes checked items and edits each row quantity alongside product selection', async () => {
    component.openReview();
    await fixture.whenStable();
    expect(component.rows().map((x) => x.selected)).toEqual([true, false]);
    expect(
      fixture.nativeElement.querySelectorAll('dialog input[type=number]:not(:disabled)'),
    ).toHaveLength(1);
    component.changeRow('b', { selected: true });
    expect(component.totals()[0].quantity).toBe(3);
    await fixture.whenStable();
    expect(
      fixture.nativeElement.querySelectorAll('dialog input[type=number]:not(:disabled)'),
    ).toHaveLength(2);
    component.changeRow('a', { buyQuantity: 1 });
    component.backToProducts();
    expect(component.totals()[0].quantity).toBe(2);
  });

  it('disables excluded-row editing while allowing inclusion to be restored', async () => {
    component.openReview();
    await fixture.whenStable();
    const row = fixture.nativeElement.querySelector('[data-review-row="a"]') as HTMLElement;
    const checkbox = row.querySelector('input[type=checkbox]') as HTMLInputElement;
    const product = row.querySelector('[data-grocery-id="a"]') as HTMLButtonElement;
    const quantity = row.querySelector('input[type=number]') as HTMLInputElement;
    checkbox.click();
    await fixture.whenStable();
    expect(checkbox.disabled).toBe(false);
    expect(product.disabled).toBe(true);
    expect(quantity.disabled).toBe(true);
    expect(row.querySelector('.line-through')).not.toBeNull();
    product.click();
    component.choose('a');
    expect(component.choosing()).toBeNull();
    expect(component.totals()).toHaveLength(0);
    checkbox.click();
    await fixture.whenStable();
    expect(product.disabled).toBe(false);
    expect(quantity.disabled).toBe(false);
    expect(component.totals()[0].quantity).toBe(2);
    product.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('dialog')[1].open).toBe(true);
  });

  it('keeps the cart explanation in the footer and the unreviewed warning before the products', async () => {
    store.review.mockReturnValue(of({ ...review, unreviewedMeals: 1 }));
    component.openReview();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const warning = dialog.querySelector('[data-testid="export-unreviewed-meals"]')!;
    expect(warning.textContent).toContain('1 meal has not been reviewed');
    const row = dialog.querySelector('[data-review-row="a"]')!;
    expect(warning.compareDocumentPosition(row) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    const footer = dialog.querySelector('.app-dialog-footer')!;
    expect(footer.textContent).toContain('This does not place an order.');
    expect(footer.querySelector('[data-testid="export-unreviewed-meals"]')).toBeNull();
    const note = footer.querySelector('[modal-note]')!;
    expect(
      note.compareDocumentPosition(footer.querySelector('button')!) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).not.toBe(0);
  });

  it('keeps each product summary, mapping action and order quantity in its list-item row', async () => {
    component.openReview();
    await fixture.whenStable();
    const row = fixture.nativeElement.querySelector('[data-review-row="a"]') as HTMLElement;
    expect(row.querySelector('input[type=number]')).not.toBeNull();
    const card = row.querySelector<HTMLButtonElement>('[data-grocery-id="a"]')!;
    expect(row.textContent).toContain(mockSupermarketProducts[0].name);
    expect(row.textContent).toContain(mockSupermarketProducts[0].pack);
    expect(row.querySelector('app-supermarket-product-image .size-16')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('dialog').textContent).not.toContain(
      'Quantities to export',
    );
    card.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('dialog')[1].open).toBe(true);
  });

  it('offers product selection when no match is selected', async () => {
    store.review.mockReturnValue(of({ ...review, items: [{ ...review.items[0], product: null }] }));
    component.openReview();
    await fixture.whenStable();
    const card = fixture.nativeElement.querySelector('[data-grocery-id="a"]') as HTMLButtonElement;
    expect(card.textContent).toContain('No product selected');
    expect(card.querySelector('app-supermarket-product-image app-icon')).not.toBeNull();
    expect(card.getAttribute('aria-label')).toBe('Choose supermarket product for Noodles');
    expect(fixture.nativeElement.textContent).not.toContain('Select at least one list item');
    expect(fixture.nativeElement.textContent).not.toContain('list items will not be exported');
    card.click();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelectorAll('dialog')[1].open).toBe(true);
  });

  it('keeps duplicate products as independent rows and exports their summed packs', async () => {
    component.openReview();
    component.changeRow('b', { selected: true });
    component.changeRow('a', { buyQuantity: 4 });
    component.changeRow('b', { buyQuantity: 3 });
    await fixture.whenStable();
    const main = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(main.querySelectorAll('input[type=number]:not(:disabled)')).toHaveLength(2);
    expect((main.querySelector('#packs-a') as HTMLInputElement).value).toBe('4');
    expect((main.querySelector('#packs-b') as HTMLInputElement).value).toBe('3');
    expect(main.textContent).not.toContain('Shared with');
    component.confirm();
    expect(store.confirm).toHaveBeenCalledWith(
      'cycle',
      expect.anything(),
      expect.anything(),
      [{ productId: 's1001', quantity: 7 }],
      'Account',
    );
  });

  it('disables unavailable quantities but keeps replacement usable', async () => {
    store.review.mockReturnValue(
      of({ ...review, items: [{ ...review.items[0], product: mockSupermarketProducts[3] }] }),
    );
    component.openReview();
    await fixture.whenStable();
    const row = fixture.nativeElement.querySelector('[data-review-row="a"]') as HTMLElement;
    expect(row.textContent).toContain('Unavailable');
    expect(row.querySelector<HTMLInputElement>('input[type=number]')!.disabled).toBe(true);
    expect(row.querySelector<HTMLButtonElement>('[data-grocery-id="a"]')!.disabled).toBe(false);
    expect(component.valid()).toBe(false);
  });

  it('does not send an empty typed quantity or fall back to the source suggestion', async () => {
    component.openReview();
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('#packs-a') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(Number.isNaN(component.totals()[0].quantity)).toBe(true);
    expect(component.valid()).toBe(false);
    component.confirm();
    expect(store.confirm).not.toHaveBeenCalled();
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('renders normal result separators without corrupted text', async () => {
    store.results.set({ cycle: result });
    component.viewResult();
    await fixture.whenStable();
    const main = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    const row = main.querySelector('details li')!;
    expect(row.textContent).toContain('Noodles');
    expect(row.textContent).toContain('250 g');
    expect(row.textContent).toContain('2×');
    expect(main.textContent).not.toMatch(/Â|Ã|ï¿½|�/);
  });

  it('keeps per-row quantities when inclusion or matching changes', () => {
    store.review.mockReturnValue(
      of({
        ...review,
        items: [
          review.items[0],
          { ...review.items[1], product: mockSupermarketProducts[2], checked: false },
        ],
      }),
    );
    component.openReview();
    component.changeRow('a', { buyQuantity: 4 });
    component.changeRow('b', { buyQuantity: 5 });
    component.changeRow('a', { selected: false });
    expect(component.rows().map((x) => x.buyQuantity)).toEqual([4, 5]);
    component.changeRow('a', { selected: true, product: mockSupermarketProducts[2] });
    expect(component.totals()[0].quantity).toBe(9);
  });

  it('blocks empty selections, unavailable matches, non-integer packs and provider limits', () => {
    component.openReview();
    component.changeRow('a', { selected: false });
    expect(component.valid()).toBe(false);
    component.changeRow('a', {
      selected: true,
      product: { ...mockSupermarketProducts[0], availability: 'Unknown' },
    });
    expect(component.selectionValid()).toBe(false);
    component.changeRow('a', { product: mockSupermarketProducts[3] });
    expect(component.valid()).toBe(false);
    component.changeRow('a', { product: mockSupermarketProducts[0] });
    for (const quantity of [0, -1, 1.5, 21]) {
      component.changeRow('a', { buyQuantity: quantity });
      expect(component.valid()).toBe(false);
    }
  });

  it('discards a closed review and reloads fresh groceries and quantities on reopening', async () => {
    component.openReview();
    component.changeRow('a', { buyQuantity: 4 });
    component.close();
    expect(component.review()).toBeNull();
    expect(store.closeSession).toHaveBeenCalledWith('cycle');
    store.review.mockReturnValue(
      of({ ...review, revision: 'changed', items: [{ ...review.items[0], quantity: 3 }] }),
    );
    component.openReview();
    expect(component.view()).toBe('products');
    expect(component.totals()[0].quantity).toBe(3);
    await fixture.whenStable();
  });

  it('ignores a late review after close or a cycle change', async () => {
    const response = new Subject<ApiSupermarketReview>();
    store.review.mockReturnValue(response);
    component.openReview();
    component.close();
    response.next(review);
    expect(component.review()).toBeNull();
    component.openReview();
    fixture.componentRef.setInput('cycleId', 'new-cycle');
    await fixture.whenStable();
    response.next(review);
    expect(component.rows()).toEqual([]);
  });

  it('remembers replacement intent against the original mapping after multiple choices', () => {
    component.openReview();
    component.choose('a');
    component.select({ product: mockSupermarketProducts[1], remember: true });
    expect(component.originalProductId(component.rows()[0])).toBe('s1001');
    component.choose('a');
    component.select({ product: mockSupermarketProducts[2], remember: false });
    expect(component.rows()[0].remember).toBe(false);
  });

  it('fills repeated unmapped profile products without including excluded groceries', () => {
    store.review.mockReturnValue(
      of({
        ...review,
        items: [
          { ...review.items[0], product: null },
          { ...review.items[1], profileProductId: 'slot', product: null },
        ],
      }),
    );
    component.openReview();
    component.choose('a');
    component.select({ product: mockSupermarketProducts[0], remember: true });
    expect(component.rows().map((x) => x.product?.id)).toEqual(['s1001', 's1001']);
    expect(component.rows()[1].selected).toBe(false);
    component.changeRow('b', { selected: true, product: mockSupermarketProducts[1] });
    expect(component.mappingConflict()).toBe(true);
    expect(component.selectionValid()).toBe(false);
  });

  it('warns about unreviewed meals only when there are any', async () => {
    component.openReview();
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.alert-warning')).toBeNull();
    component.review.set({ ...review, unreviewedMeals: 2 });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.alert-warning').textContent).toContain('2 meals');
  });

  it('keeps a pending export alive on close and follows its results when reopened', async () => {
    const response = new Subject<ApiSupermarketSend>();
    store.confirm.mockImplementation(() => {
      store.pending.set({ cycle: true });
      store.saveAttempt('cycle', { provider: review.provider, accountLabel: 'Account' });
      return response;
    });
    component.openReview();
    component.confirm();
    component.confirm();
    expect(store.confirm).toHaveBeenCalledTimes(1);
    await fixture.whenStable();
    const sending = fixture.nativeElement.querySelector('dialog app-loading-indicator');
    expect(sending.querySelector('.loading-spinner')).not.toBeNull();
    expect(sending.textContent).toContain('Exporting products…');
    expect(sending.textContent).toContain('You can close this window. Adding continues.');
    component.close();
    expect(store.pending()['cycle']).toBe(true);
    component.viewResult();
    expect(component.view()).toBe('sending');
    store.results.set({ cycle: result });
    response.next(result);
    store.pending.set({ cycle: false });
    await fixture.whenStable();
    expect(component.view()).toBe('results');
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('1 product added.');
  });

  it('follows a send started by a previous component when returning to the page', async () => {
    store.pending.set({ cycle: true });
    store.saveAttempt('cycle', {
      provider: review.provider,
      accountLabel: 'Account',
    });
    component.viewResult();
    store.results.set({ cycle: result });
    store.pending.set({ cycle: false });
    await fixture.whenStable();
    expect(component.view()).toBe('results');
  });

  it('shows only added or failed states, with no retry or uncertainty actions', async () => {
    store.results.set({
      cycle: {
        ...result,
        lines: [
          result.lines[0],
          {
            ...result.lines[0],
            productName: 'Rejected',
            groceryItemIds: ['b'],
            outcome: 'Failed',
            reason: 'Rejected',
          },
          {
            ...result.lines[0],
            productName: 'Unconfirmed',
            groceryItemIds: ['c'],
            outcome: 'Unknown',
            reason: 'Uncertain',
          },
          {
            ...result.lines[0],
            productName: 'Skipped',
            groceryItemIds: ['d'],
            outcome: 'NotAttempted',
            reason: 'Uncertain',
          },
        ],
      },
    });
    store.completed.set({ cycle: ['a'] });
    component.viewResult();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog');
    expect(dialog.textContent).toContain('1 added; 3 failed.');
    expect([...dialog.querySelectorAll('.badge')].map((x: any) => x.textContent.trim())).toEqual([
      'Could not add',
      'Could not add',
      'Could not add',
    ]);
    expect(dialog.textContent).not.toMatch(/unknown|not attempted|It was added|Review failed/);
    expect(component.failedLines()[0].productName).toBe('Rejected');
    const details = dialog.querySelector('details') as HTMLDetailsElement;
    expect(details.open).toBe(false);
    expect(details.querySelector('app-icon')?.getAttribute('name')).toBe('check');
    expect(
      details.compareDocumentPosition(dialog.querySelector('ul')) &
        Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    component.close();
    component.openReview();
    expect(component.rows().map((x) => x.selected)).toEqual([false, false]);
    component.changeRow('a', { selected: true });
    expect(component.rows()[0].selected).toBe(false);
  });

  it('keeps local-save warnings above collapsed successes and does not claim skipped products were added', async () => {
    store.results.set({
      cycle: {
        ...result,
        lines: [
          { ...result.lines[0], localWarning: 'LocalPersistence' },
          {
            ...result.lines[0],
            productName: 'Skipped',
            groceryItemIds: ['b'],
            outcome: 'NotAttempted',
            reason: 'LocalPersistence',
          },
        ],
      },
    });
    component.viewResult();
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.querySelector('ul')!.textContent).toContain('The export failed.');
    expect(dialog.querySelector('ul')!.textContent).not.toContain('addition was confirmed');
    const warning = dialog.querySelector('[role="alert"]')!;
    expect(warning.textContent).toContain('The cart addition was confirmed');
    const details = dialog.querySelector('details')!;
    expect(details.open).toBe(false);
    expect(
      details.compareDocumentPosition(warning) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(component.counts()).toEqual({ added: 1, failed: 1 });
  });

  it('loads current quantities and selects unchecked failures in a fresh round', () => {
    store.results.set({
      cycle: { ...result, lines: [{ ...result.lines[0], outcome: 'Unknown', quantity: 5 }] },
    });
    store.review.mockReturnValue(of({ ...review, items: [{ ...review.items[0], quantity: 3 }] }));
    component.openReview();
    expect(component.rows()[0].selected).toBe(true);
    expect(component.blocked('a')).toBe(false);
    expect(component.totals()[0].quantity).toBe(3);
  });

  it('reports a lost response as failed, refreshes the list, and permits another round', async () => {
    store.confirm.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 0 })));
    const changed = vi.spyOn(component.changed, 'emit');
    component.openReview();
    component.confirm();
    await fixture.whenStable();
    expect(component.view()).toBe('results');
    expect(changed).toHaveBeenCalledOnce();
    store.failures.set({ cycle: new HttpErrorResponse({ status: 0 }) });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('dialog').textContent).toContain('Export failed.');
    component.close();
    component.openReview();
    expect(component.view()).toBe('products');
    expect(component.rows()[0].selected).toBe(true);
    expect(store.confirm).toHaveBeenCalledOnce();
  });

  it('keeps connection errors actionable without mentioning Settings', () => {
    store.review.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 400,
            error: { code: 'SupermarketConnectionRequired', detail: 'Reconnect in Settings.' },
          }),
      ),
    );
    component.openReview();
    expect(component.error()).toContain('connection is unavailable');
    expect(component.error()).not.toContain('Settings');
  });

  it('does not update the selected cycle from a late send response', async () => {
    const response = new Subject<ApiSupermarketSend>();
    store.confirm.mockReturnValue(response);
    component.openReview();
    component.confirm();
    fixture.componentRef.setInput('cycleId', 'new-cycle');
    await fixture.whenStable();
    response.next(result);
    expect(component.review()).toBeNull();
    expect(component.send()).toBeNull();
  });
});
