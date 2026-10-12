import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { PlanningCycleStore } from './planning-cycle.store';

describe('PlanningCycleStore', () => {
  let store: PlanningCycleStore;
  let http: HttpTestingController;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(PlanningCycleStore);
    http = TestBed.inject(HttpTestingController);
  });

  it('restores the selected cycle across feature navigation', () => {
    localStorage.setItem('mealmanager.selected-planning-cycle', 'saved-cycle');

    store.loadSelectedCycle().subscribe();

    http.expectOne('/api/planning-cycles/saved-cycle').flush({
      id: 'saved-cycle',
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      previousPlanningCycleId: null,
      nextPlanningCycleId: 'current',
    });
    expect(store.currentCycle()?.id).toBe('saved-cycle');
  });

  it('persists cycle changes for the next Planner or Shopping page', () => {
    store.loadCycle('previous').subscribe();
    http.expectOne('/api/planning-cycles/previous').flush({
      id: 'previous',
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      previousPlanningCycleId: null,
      nextPlanningCycleId: 'current',
    });

    expect(localStorage.getItem('mealmanager.selected-planning-cycle')).toBe('previous');
  });

  afterEach(() => http.verify());

  it('loads the previous cycle linked from the active cycle', () => {
    store.currentCycle.set({
      id: 'current',
      startDate: '2026-08-10',
      endDate: '2026-08-16',
      previousPlanningCycleId: 'previous',
      nextPlanningCycleId: null,
    });

    store.loadCycle(store.currentCycle()!.previousPlanningCycleId!).subscribe();

    http.expectOne('/api/planning-cycles/previous').flush({
      id: 'previous',
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      previousPlanningCycleId: null,
      nextPlanningCycleId: 'current',
    });

    expect(store.currentCycle()?.id).toBe('previous');
  });

  it('deletes the selected cycle and selects the newest remaining cycle', () => {
    localStorage.setItem('mealmanager.selected-planning-cycle', 'deleted-cycle');

    store.deleteCycle('deleted-cycle').subscribe();

    http.expectOne('/api/planning-cycles/deleted-cycle').flush(null);
    http.expectOne('/api/planning-cycles/current').flush({
      id: 'newest-cycle',
      startDate: '2026-08-10',
      endDate: '2026-08-16',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });

    expect(store.currentCycle()?.id).toBe('newest-cycle');
    expect(localStorage.getItem('mealmanager.selected-planning-cycle')).toBe('newest-cycle');
  });

  it('clears the selected cycle when deletion leaves no cycles', () => {
    localStorage.setItem('mealmanager.selected-planning-cycle', 'only-cycle');

    store.deleteCycle('only-cycle').subscribe();

    http.expectOne('/api/planning-cycles/only-cycle').flush(null);
    http
      .expectOne('/api/planning-cycles/current')
      .flush(null, { status: 404, statusText: 'Not Found' });

    expect(store.currentCycle()).toBeNull();
    expect(localStorage.getItem('mealmanager.selected-planning-cycle')).toBeNull();
  });

  it('preserves the cycle selected while an earlier deletion was pending', () => {
    store.deleteCycle('deleted').subscribe();
    const deletion = http.expectOne('/api/planning-cycles/deleted');
    store.loadCycle('selected').subscribe();
    http.expectOne('/api/planning-cycles/selected').flush({
      id: 'selected',
      startDate: '2026-08-03',
      endDate: '2026-08-09',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    deletion.flush(null);
    expect(store.currentCycle()?.id).toBe('selected');
    expect(localStorage.getItem('mealmanager.selected-planning-cycle')).toBe('selected');
    http.expectNone('/api/planning-cycles/current');
  });
});
