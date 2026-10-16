import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { SupermarketsStore } from './supermarkets.store';
import {
  ApiSupermarketReview,
  ApiSupermarketSend,
  SupermarketProviderId,
} from '../../../api/models/api-supermarkets';
import { mockSupermarketProducts } from '../../../../mocks/supermarkets';
import { ReviewRow } from '../models/review-row';

describe('supermarket session ownership', () => {
  let store: SupermarketsStore;
  let http: HttpTestingController;
  const review: ApiSupermarketReview = {
    provider: 'picnic',
    accountId: 'account',
    connectionGeneration: 'generation',
    revision: 'revision',
    unreviewedMeals: 0,
    items: [],
  };
  const rows: ReviewRow[] = [
    {
      shoppingListItemId: 'source',
      recipeProfileGroceryItemId: null,
      name: 'Noodles',
      quantity: 1,
      checked: false,
      group: 'Other',
      product: mockSupermarketProducts[0],
      selected: true,
      remember: false,
      buyQuantity: 1,
    },
  ];
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
        quantity: 1,
        outcome: 'Added',
        reason: null,
        shoppingListItemIds: ['source'],
        localWarning: null,
      },
    ],
  };
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(SupermarketsStore);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('keeps a single mutation running after its component unsubscribes', () => {
    const request = store.confirm('cycle', review, rows, [{ productId: 's1001', quantity: 1 }]);
    const subscription = request.subscribe();
    subscription.unsubscribe();
    expect(store.confirm('cycle', review, rows, [])).toBe(request);
    const pending = http.expectOne('/api/supermarkets/cycles/cycle/send');
    expect(pending.cancelled).toBe(false);
    expect(pending.request.body.connectionGeneration).toBe('generation');
    pending.flush(result);
    expect(store.pending()['cycle']).toBe(false);
    expect(store.completed()['cycle']).toEqual(['source']);
    expect(store.results()['cycle']).toEqual(result);
  });
  it('reports a lost response as a failure and never automatically retries', () => {
    store.confirm('cycle', review, rows, [{ productId: 's1001', quantity: 1 }]);
    http.expectOne('/api/supermarkets/cycles/cycle/send').error(new ProgressEvent('error'));
    expect(store.failures()['cycle']).toBeTruthy();
    expect(store.completed()['cycle']).toBeUndefined();
    http.expectNone('/api/supermarkets/cycles/cycle/send');
  });
  it('discards completed results and captured selections on close', () => {
    store.confirm('cycle', review, rows, [{ productId: 's1001', quantity: 1 }]);
    http.expectOne('/api/supermarkets/cycles/cycle/send').flush(result);
    store.closeSession('cycle');
    expect(store.results()['cycle']).toBeUndefined();
    expect(store.attempt('cycle')).toBeUndefined();
    expect(store.completed()['cycle']).toEqual(['source']);
  });
  it('finishes a closed export without retaining its result', () => {
    store.confirm('cycle', review, rows, [{ productId: 's1001', quantity: 1 }]);
    store.closeSession('cycle');
    const request = http.expectOne('/api/supermarkets/cycles/cycle/send');
    expect(request.cancelled).toBe(false);
    request.flush(result);
    expect(store.results()['cycle']).toBeUndefined();
    expect(store.attempt('cycle')).toBeUndefined();
    expect(store.pending()['cycle']).toBe(false);
  });
  it('discards unconfirmed results on close so another round can begin', () => {
    store.confirm('cycle', review, rows, [{ productId: 's1001', quantity: 1 }]);
    store.closeSession('cycle');
    http
      .expectOne('/api/supermarkets/cycles/cycle/send')
      .flush({ ...result, lines: [{ ...result.lines[0], outcome: 'Unknown' }] });
    expect(store.results()['cycle']).toBeUndefined();
    expect(store.attempt('cycle')).toBeUndefined();
    expect(store.completed()['cycle']).toEqual([]);
  });
  it('uses the edited combined quantity when a source exceeds the API metadata bound', () => {
    store.confirm(
      'cycle',
      review,
      [{ ...rows[0], buyQuantity: 1000 }],
      [{ productId: 's1001', quantity: 2 }],
    );
    const request = http.expectOne('/api/supermarkets/cycles/cycle/send');
    expect(request.request.body.items[0].quantity).toBe(999);
    expect(request.request.body.totals).toEqual([{ productId: 's1001', quantity: 2 }]);
    request.flush(result);
  });
  it('shows only the current round and only excludes acknowledged additions', () => {
    store.results.set({ cycle: result });
    store.confirm('cycle', review, rows, [{ productId: 's1001', quantity: 1 }]);
    const failed = { ...result, lines: [{ ...result.lines[0], outcome: 'Unknown' as const }] };
    http.expectOne('/api/supermarkets/cycles/cycle/send').flush(failed);
    expect(store.results()['cycle']).toEqual(failed);
    expect(store.completed()['cycle']).toEqual([]);
  });
  it('clears a failed request on close and allows a fresh manual export', () => {
    store.confirm('cycle', review, rows, [{ productId: 's1001', quantity: 1 }]);
    http.expectOne('/api/supermarkets/cycles/cycle/send').error(new ProgressEvent('error'));
    store.closeSession('cycle');
    expect(store.failures()['cycle']).toBeUndefined();
    store.openSession('cycle');
    store.confirm('cycle', review, rows, [{ productId: 's1001', quantity: 1 }]);
    http.expectOne('/api/supermarkets/cycles/cycle/send').flush(result);
    expect(store.results()['cycle']).toEqual(result);
  });
  it('replaces results when the provider changes, even when product IDs collide', () => {
    store.results.set({
      cycle: {
        ...result,
        lines: [{ ...result.lines[0], shoppingListItemIds: ['old'], outcome: 'Failed' }],
      },
    });
    store.completed.set({ cycle: ['previous-addition'] });
    const provider = 'other' as SupermarketProviderId;
    store.confirm('cycle', { ...review, provider }, rows, [{ productId: 's1001', quantity: 1 }]);
    http.expectOne('/api/supermarkets/cycles/cycle/send').flush({ ...result, provider });
    expect(store.results()['cycle']!.lines).toHaveLength(1);
    expect(store.results()['cycle']!.provider).toBe(provider);
    expect(store.completed()['cycle']).toEqual(['previous-addition', 'source']);
  });
  it('does not merge results from a replaced connection or account', () => {
    store.results.set({
      cycle: { ...result, lines: [{ ...result.lines[0], shoppingListItemIds: ['old'] }] },
    });
    store.confirm('cycle', { ...review, connectionGeneration: 'new-generation' }, rows, [
      { productId: 's1001', quantity: 1 },
    ]);
    http
      .expectOne('/api/supermarkets/cycles/cycle/send')
      .flush({ ...result, connectionGeneration: 'new-generation' });
    expect(store.results()['cycle']!.lines).toHaveLength(1);
  });
  it('stores an immutable destination and reports request failures', () => {
    store.confirm('cycle', review, rows, [{ productId: 's1001', quantity: 2 }], 'Account');
    const copy = store.attempt('cycle')!;
    expect(copy.provider).toBe(review.provider);
    http
      .expectOne('/api/supermarkets/cycles/cycle/send')
      .flush({ code: 'SupermarketReviewChanged' }, { status: 400, statusText: 'Bad Request' });
    expect(store.failures()['cycle']).toBeTruthy();
    expect(store.attempt('cycle')!.accountLabel).toBe('Account');
  });
});
