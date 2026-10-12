import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { finalize, Observable, shareReplay, tap } from 'rxjs';
import {
  ApiSupermarketConnection,
  SupermarketProviderId,
  ApiSupermarketProduct,
  ApiSupermarketReview,
  ApiSupermarketSend,
} from '../../../api/models/api-supermarkets';
import { ReviewRow } from '../models/review-row';
import { ExportAttempt } from '../models/export-attempt';

@Injectable({ providedIn: 'root' })
export class SupermarketsStore {
  private http = inject(HttpClient);
  readonly results = signal<Record<string, ApiSupermarketSend | undefined>>({});
  readonly pending = signal<Record<string, boolean>>({});
  readonly completed = signal<Record<string, string[]>>({});
  readonly failures = signal<Record<string, unknown>>({});
  private active = new Map<string, Observable<ApiSupermarketSend>>();
  private attempts = new Map<string, ExportAttempt>();
  private closed = new Set<string>();
  providers() {
    return this.http.get<ApiSupermarketConnection[]>('/api/supermarkets');
  }
  search(provider: SupermarketProviderId, query: string) {
    return this.http.get<ApiSupermarketProduct[]>(`/api/supermarkets/${provider}/products`, {
      params: { query },
    });
  }
  review(cycleId: string, provider: SupermarketProviderId) {
    return this.http.get<ApiSupermarketReview>(`/api/supermarkets/cycles/${cycleId}/review`, {
      params: { provider },
    });
  }
  attempt(cycleId: string) {
    return this.attempts.get(cycleId);
  }
  private saveAttempt(cycleId: string, attempt: ExportAttempt) {
    this.attempts.set(cycleId, { ...attempt });
  }
  clearAttempt(cycleId: string) {
    this.attempts.delete(cycleId);
  }
  openSession(cycleId: string) {
    this.closed.delete(cycleId);
  }
  closeSession(cycleId: string) {
    this.closed.add(cycleId);
    this.discardClosedResult(cycleId);
  }
  private discardClosedResult(cycleId: string) {
    if (!this.closed.has(cycleId) || this.pending()[cycleId]) return;
    this.results.update(({ [cycleId]: _result, ...rest }) => rest);
    this.failures.update(({ [cycleId]: _failure, ...rest }) => rest);
    this.clearAttempt(cycleId);
    this.closed.delete(cycleId);
  }
  confirm(
    cycleId: string,
    review: ApiSupermarketReview,
    rows: ReviewRow[],
    totals: { productId: string; quantity: number }[],
    accountLabel = '',
  ) {
    const existing = this.active.get(cycleId);
    if (existing) return existing;
    this.failures.update((x) => ({ ...x, [cycleId]: undefined }));
    this.saveAttempt(cycleId, {
      provider: review.provider,
      accountLabel,
    });
    this.pending.update((x) => ({ ...x, [cycleId]: true }));
    const request = this.http
      .post<ApiSupermarketSend>(`/api/supermarkets/cycles/${cycleId}/send`, {
        provider: review.provider,
        accountId: review.accountId,
        connectionGeneration: review.connectionGeneration,
        revision: review.revision,
        items: rows
          .filter((x) => x.selected)
          .map((x) => ({
            groceryItemId: x.groceryItemId,
            productId: x.product!.id,
            // Keep source metadata within API bounds; combined totals determine cart additions.
            quantity: Math.min(x.buyQuantity, 999),
            remember: x.remember,
          })),
        totals,
      })
      .pipe(
        tap({
          next: (result) => {
            this.results.update((x) => ({ ...x, [cycleId]: result }));
            this.excludeAdded(cycleId, result);
          },
          error: (error: HttpErrorResponse) => {
            this.failures.update((x) => ({ ...x, [cycleId]: error }));
          },
        }),
        finalize(() => {
          this.pending.update((x) => ({ ...x, [cycleId]: false }));
          this.active.delete(cycleId);
          this.discardClosedResult(cycleId);
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    this.active.set(cycleId, request);
    // The review session owns the mutation even when its component/cycle is no longer visible.
    request.subscribe({ error: () => {} });
    return request;
  }
  private excludeAdded(cycleId: string, result: ApiSupermarketSend) {
    this.completed.update((x) => ({
      ...x,
      [cycleId]: [
        ...new Set([
          ...(x[cycleId] ?? []),
          ...result.lines
            .filter((line) => line.outcome === 'Added')
            .flatMap((line) => line.groceryItemIds),
        ]),
      ],
    }));
  }
}
