import { TestBed } from '@angular/core/testing';
import { of, Subject, tap } from 'rxjs';
import { signal } from '@angular/core';
import { PlanningCycleSwitcher } from './planning-cycle-switcher';
import { ApiPlanningCycle } from '../../../../api/models/api-planning-cycle';
import { PlanningCycleStore } from '../../state/planning-cycle.store';

describe('PlanningCycleSwitcher', () => {
  const cycles: ApiPlanningCycle[] = [
    {
      id: 'oldest',
      startDate: '2025-12-25',
      endDate: '2025-12-31',
      previousPlanningCycleId: null,
      nextPlanningCycleId: 'older',
    },
    {
      id: 'older',
      startDate: '2026-10-01',
      endDate: '2026-10-07',
      previousPlanningCycleId: 'oldest',
      nextPlanningCycleId: 'current',
    },
    {
      id: 'current',
      startDate: '2026-10-08',
      endDate: '2026-10-14',
      previousPlanningCycleId: 'older',
      nextPlanningCycleId: null,
    },
  ];
  async function setup() {
    const selected = signal(cycles[2]);
    const store = {
      currentCycle: selected,
      loadCurrentCycle: vi.fn(() => of(cycles[2]).pipe(tap((cycle) => selected.set(cycle)))),
      loadCycle: vi.fn((id: string) =>
        of(cycles.find((cycle) => cycle.id === id)!).pipe(tap((cycle) => selected.set(cycle))),
      ),
    };
    TestBed.configureTestingModule({
      providers: [{ provide: PlanningCycleStore, useValue: store }],
    });
    const fixture = TestBed.createComponent(PlanningCycleSwitcher);
    await fixture.whenStable();
    return { fixture, component: fixture.componentInstance, store };
  }
  it('follows previous and next links through the complete history with one request per step', async () => {
    const { component, store, fixture } = await setup();
    const changed = vi.fn();
    component.cycleChanged.subscribe(changed);
    component.previous();
    component.previous();
    expect(store.currentCycle().id).toBe('oldest');
    expect(component.range()).toContain('2025');
    component.previous();
    expect(store.loadCycle).toHaveBeenCalledTimes(2);
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Previous cycle"]').disabled,
    ).toBe(true);
    component.next();
    component.next();
    component.next();
    expect(store.loadCycle.mock.calls.map((call) => call[0])).toEqual([
      'older',
      'oldest',
      'older',
      'current',
    ]);
    expect(changed.mock.calls.map((call) => call[0])).toEqual([
      'older',
      'oldest',
      'older',
      'current',
    ]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[aria-label="Next cycle"]').disabled).toBe(
      true,
    );
  });
  it('keeps the current range while pending, blocks repeated navigation and retries the failed step', async () => {
    const { component, store } = await setup();
    const response = new Subject<ApiPlanningCycle>();
    store.loadCycle.mockReturnValue(response);
    component.previous();
    component.previous();
    component.next();
    expect(store.loadCycle).toHaveBeenCalledOnce();
    expect(store.currentCycle().id).toBe('current');
    response.error(new Error('offline'));
    expect(component.pending()).toBe(false);
    expect(component.error()).toContain('retry');
    const changed = vi.fn();
    component.cycleChanged.subscribe(changed);
    store.loadCycle.mockReturnValue(of(cycles[1]));
    component.retry();
    expect(store.loadCycle).toHaveBeenLastCalledWith('older');
    expect(changed).toHaveBeenCalledWith('older');
    expect(component.error()).toBe('');
  });
  it('ignores disabled navigation and cancels a request when destroyed', async () => {
    const { component, store, fixture } = await setup();
    fixture.componentRef.setInput('disabled', true);
    component.previous();
    expect(store.loadCycle).not.toHaveBeenCalled();
    fixture.componentRef.setInput('disabled', false);
    const response = new Subject<ApiPlanningCycle>();
    store.loadCycle.mockReturnValue(response);
    const changed = vi.fn();
    component.cycleChanged.subscribe(changed);
    component.previous();
    fixture.destroy();
    response.next(cycles[1]);
    response.complete();
    expect(changed).not.toHaveBeenCalled();
    expect(component.pending()).toBe(false);
  });
  it('includes both years when a cycle crosses New Year', async () => {
    const { component, store } = await setup();
    store.currentCycle.set({ ...cycles[0], endDate: '2026-01-02' });
    expect(component.range()).toContain('2025');
    expect(component.range()).toContain('2026');
  });
  it('returns directly to the active cycle after browsing history', async () => {
    const { component, store, fixture } = await setup();
    component.previous();
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Return to active cycle');
    const changed = vi.fn();
    component.cycleChanged.subscribe(changed);
    component.returnToActive();
    await fixture.whenStable();
    expect(store.loadCurrentCycle).toHaveBeenCalledOnce();
    expect(changed).toHaveBeenCalledWith('current');
    expect(store.currentCycle().id).toBe('current');
    expect(fixture.nativeElement.textContent).not.toContain('Return to active cycle');
  });
});
