import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { DashboardState } from './dashboard-state';
import { PlanningCycleStore } from '../planning-cycle/state/planning-cycle.store';

describe('DashboardState', () => {
  it('loads active data without changing historical browsing and clears stale data on failure', () => {
    TestBed.configureTestingModule({
      providers: [DashboardState, provideHttpClient(), provideHttpClientTesting()],
    });
    const state = TestBed.inject(DashboardState),
      cycles = TestBed.inject(PlanningCycleStore),
      http = TestBed.inject(HttpTestingController);
    cycles.currentCycle.set({
      id: 'old',
      startDate: '2026-01-01',
      endDate: '2026-01-07',
      previousPlanningCycleId: null,
      nextPlanningCycleId: 'active',
    });
    state.load();
    http
      .expectOne((request) => request.url === '/api/planning/upcoming')
      .flush({ fromDate: state.today(), entries: [], plannedDates: [] });
    http
      .expectOne('/api/planning-cycles/current')
      .flush({ id: 'active', startDate: '2026-09-08', endDate: '2026-09-14' });
    http
      .expectOne('/api/planning/cycle/active')
      .flush({ id: 'p', planningCycleId: 'active', entries: [], notes: [] });
    expect(cycles.currentCycle()?.id).toBe('old');
    expect(state.planning()?.id).toBe('p');
    state.load();
    http
      .expectOne((request) => request.url === '/api/planning/upcoming')
      .flush({ fromDate: state.today(), entries: [], plannedDates: [] });
    expect(state.planning()).toBeNull();
    http.expectOne('/api/planning-cycles/current').flush({}, { status: 500, statusText: 'Error' });
    expect(state.error()).toContain('retry');
    expect(state.loading()).toBe(false);
    http.verify();
  });

  it('keeps upcoming meals available when active planning fails and refreshes at midnight', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 2, 23, 59, 50));
    TestBed.configureTestingModule({
      providers: [DashboardState, provideHttpClient(), provideHttpClientTesting()],
    });
    const state = TestBed.inject(DashboardState);
    const http = TestBed.inject(HttpTestingController);
    state.load();
    http
      .expectOne(
        (request) =>
          request.url === '/api/planning/upcoming' &&
          request.params.get('fromDate') === '2026-10-02',
      )
      .flush({ fromDate: '2026-10-02', entries: [], plannedDates: ['2026-10-02'] });
    http.expectOne('/api/planning-cycles/current').flush({}, { status: 500, statusText: 'Error' });
    expect(state.upcoming()?.plannedDates).toEqual(['2026-10-02']);
    expect(state.upcomingError()).toBe('');
    vi.advanceTimersByTime(30_000);
    http
      .expectOne(
        (request) =>
          request.url === '/api/planning/upcoming' &&
          request.params.get('fromDate') === '2026-10-03',
      )
      .flush({ fromDate: '2026-10-03', entries: [], plannedDates: [] });
    expect(state.today()).toBe('2026-10-03');
    state.ngOnDestroy();
    vi.useRealTimers();
    http.verify();
  });

  it('cancels obsolete upcoming reads and reports errors independently', () => {
    TestBed.configureTestingModule({
      providers: [DashboardState, provideHttpClient(), provideHttpClientTesting()],
    });
    const state = TestBed.inject(DashboardState);
    const http = TestBed.inject(HttpTestingController);
    state.load();
    const obsolete = http.expectOne((request) => request.url === '/api/planning/upcoming');
    const oldActive = http.expectOne('/api/planning-cycles/current');
    state.load();
    expect(obsolete.cancelled).toBe(true);
    expect(oldActive.cancelled).toBe(true);
    http
      .expectOne((request) => request.url === '/api/planning/upcoming')
      .flush({}, { status: 500, statusText: 'Error' });
    http
      .expectOne('/api/planning-cycles/current')
      .flush({}, { status: 404, statusText: 'Not found' });
    expect(state.upcoming()).toBeNull();
    expect(state.upcomingError()).toContain('retry');
    expect(state.noCycle()).toBe(true);
    expect(state.upcomingLoading()).toBe(false);
    state.ngOnDestroy();
    http.verify();
  });
});
