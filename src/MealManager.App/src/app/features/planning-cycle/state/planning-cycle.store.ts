import { inject, Injectable, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { ApiPlanningCycle } from '../../../api/models/api-planning-cycle';
import { catchError, filter, of, switchMap, tap, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class PlanningCycleStore {
  private http = inject(HttpClient);
  private readonly selectedCycleKey = 'mealmanager.selected-planning-cycle';

  private selectionRequest = 0;
  currentCycle = signal<ApiPlanningCycle | null>(null);

  fetchActiveCycle() {
    return this.http.get<ApiPlanningCycle>('/api/planning-cycles/current');
  }

  loadCurrentCycle() {
    const request = ++this.selectionRequest;
    return this.http.get<ApiPlanningCycle>('/api/planning-cycles/current').pipe(
      filter(() => request === this.selectionRequest),
      tap((data) => this.selectCycle(data)),
    );
  }

  loadSelectedCycle() {
    const request = this.selectionRequest + 1;
    const selectedId = this.readSelectedCycleId();
    return selectedId
      ? this.loadCycle(selectedId).pipe(
          catchError((error: HttpErrorResponse) => {
            if (request !== this.selectionRequest || error.status !== 404)
              return throwError(() => error);
            this.clearSelection();
            return this.loadCurrentCycle();
          }),
        )
      : this.loadCurrentCycle();
  }

  loadCycle(id: string) {
    const request = ++this.selectionRequest;
    return this.http.get<ApiPlanningCycle>(`/api/planning-cycles/${id}`).pipe(
      filter(() => request === this.selectionRequest),
      tap((data) => this.selectCycle(data)),
    );
  }

  addCycle(startDate: string, endDate: string) {
    const request = ++this.selectionRequest;
    return this.http.post<ApiPlanningCycle>('/api/planning-cycles', { startDate, endDate }).pipe(
      tap((data) => {
        if (request === this.selectionRequest) this.selectCycle(data);
      }),
    );
  }

  updateCycle(id: string, startDate: string, endDate: string) {
    const request = ++this.selectionRequest;
    return this.http
      .put<ApiPlanningCycle>(`/api/planning-cycles/${id}`, { startDate, endDate })
      .pipe(
        tap((data) => {
          if (request === this.selectionRequest) this.selectCycle(data);
        }),
      );
  }

  deleteCycle(id: string) {
    const request = this.selectionRequest;
    return this.http.delete(`/api/planning-cycles/${id}`).pipe(
      switchMap(() => {
        if (request !== this.selectionRequest) return of(null);
        this.clearSelection();
        return this.loadCurrentCycle().pipe(
          catchError((error: HttpErrorResponse) => {
            if (error.status !== 404) return throwError(() => error);
            this.currentCycle.set(null);
            return of(null);
          }),
        );
      }),
    );
  }

  private selectCycle(cycle: ApiPlanningCycle) {
    this.currentCycle.set(cycle);
    try {
      localStorage.setItem(this.selectedCycleKey, cycle.id);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }

  private readSelectedCycleId() {
    try {
      return localStorage.getItem(this.selectedCycleKey);
    } catch {
      return null;
    }
  }

  private clearSelection() {
    this.currentCycle.set(null);
    try {
      localStorage.removeItem(this.selectedCycleKey);
    } catch {
      // Storage can be unavailable in privacy-restricted browser contexts.
    }
  }
}
