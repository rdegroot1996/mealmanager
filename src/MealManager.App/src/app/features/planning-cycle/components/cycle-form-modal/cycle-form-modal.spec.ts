import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CycleFormModal } from './cycle-form-modal';
import { of } from 'rxjs';

describe('CycleFormModal', () => {
  let component: CycleFormModal;
  let fixture: ComponentFixture<CycleFormModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CycleFormModal],
    }).compileComponents();

    fixture = TestBed.createComponent(CycleFormModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('hands deletion to the parent only for the selected editable cycle', () => {
    const cycle = {
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-26',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    };
    const removed = vi.fn();
    component.removeRequested.subscribe(removed);
    component.editCycle.set(cycle);
    component.cycleStore.currentCycle.set(cycle);
    const close = vi.spyOn(component.modal()!, 'close');
    component.saving.set(true);
    component.remove();
    expect(removed).not.toHaveBeenCalled();
    component.saving.set(false);
    component.remove();
    expect(removed).toHaveBeenCalledWith(cycle.id);
    expect(close).toHaveBeenCalledOnce();
    removed.mockClear();
    component.cycleStore.currentCycle.set({ ...cycle, nextPlanningCycleId: 'newer' });
    component.remove();
    component.cycleStore.currentCycle.set({ ...cycle, id: 'another' });
    component.remove();
    expect(removed).not.toHaveBeenCalled();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('asks before discarding changed dates or duration, but not an untouched cycle', async () => {
    vi.spyOn(component.modal()!, 'open').mockImplementation(() => {});
    const discard = vi.spyOn(component.discardModal(), 'confirmDiscard').mockResolvedValue(false);
    component.open();
    expect(await component.beforeDismiss()).toBe(true);
    const days = component.days();
    component.days.set(days + 1);
    expect(await component.beforeDismiss()).toBe(false);
    component.days.set(days);
    expect(await component.beforeDismiss()).toBe(true);
    component.startDate.set('2030-01-01');
    expect(await component.beforeDismiss()).toBe(false);
    expect(discard).toHaveBeenCalledTimes(2);
  });

  it('rejects a cleared planning-day quantity without breaking the date preview', async () => {
    const input = fixture.nativeElement.querySelector('#cycle-planning-days') as HTMLInputElement;
    input.value = '';
    input.dispatchEvent(new Event('input'));
    await fixture.whenStable();
    expect(Number.isNaN(component.days())).toBe(true);
    expect(() => component.dateRange()).not.toThrow();
    component.save();
    expect(component.error()).toContain('positive whole number');
    expect(component.saving()).toBe(false);
  });

  it('rejects a new cycle that would not become the newest cycle', () => {
    component.cycleStore.currentCycle.set({
      id: 'cycle-1',
      startDate: '2026-08-20',
      endDate: '2026-08-26',
      previousPlanningCycleId: null,
      nextPlanningCycleId: null,
    });
    component.editCycle.set(null);
    component.startDate.set('2026-08-20');

    component.save();

    expect(component.error()).toContain('must start after');
    expect(component.saving()).toBe(false);
  });

  it('confirms a cycle save after the modal closes', () => {
    component.cycleStore.currentCycle.set(null);
    component.editCycle.set(null);
    component.startDate.set('2026-08-20');
    vi.spyOn(component.cycleStore, 'addCycle').mockReturnValue(
      of({
        id: 'cycle-1',
        startDate: '2026-08-20',
        endDate: '2026-08-26',
        previousPlanningCycleId: null,
        nextPlanningCycleId: null,
      }),
    );
    vi.spyOn(component.modal()!, 'close').mockImplementation(() => undefined);
    const success = vi.spyOn(component.toast, 'success');

    component.save();

    expect(success).toHaveBeenCalledWith('Planning cycle added.');
  });
});
