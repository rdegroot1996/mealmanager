import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { AddNoteModal } from './add-note-modal';
import { MealPlanStore } from '../../state/meal-plan.store';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';

describe('AddNoteModal removal handoff', () => {
  const cycle = {
    id: 'cycle-1',
    startDate: '2026-10-08',
    endDate: '2026-10-14',
    previousPlanningCycleId: null,
    nextPlanningCycleId: null as string | null,
  };
  const note = { id: 'note-1', date: '2026-10-09', text: 'Dinner with friends' };
  async function setup() {
    const currentCycle = signal({ ...cycle });
    TestBed.configureTestingModule({
      providers: [
        { provide: MealPlanStore, useValue: {} },
        { provide: PlanningCycleStore, useValue: { currentCycle } },
      ],
    });
    const fixture = TestBed.createComponent(AddNoteModal);
    await fixture.whenStable();
    const component = fixture.componentInstance;
    vi.spyOn(component.modal()!, 'open').mockImplementation(() => undefined);
    const close = vi.spyOn(component.modal()!, 'close');
    const removed = vi.fn();
    component.removeRequested.subscribe(removed);
    return { component, currentCycle, close, removed };
  }
  it('closes the edit dialog and asks its parent to remove the existing note', async () => {
    const { component, close, removed } = await setup();
    component.open(note.date, note);
    component.remove();
    expect(close).toHaveBeenCalledOnce();
    expect(removed).toHaveBeenCalledWith(note.id);
  });

  it('focuses the title for edits and a control for creation', async () => {
    const { component } = await setup();
    component.open(note.date, note);
    expect(component.modal()!.open).toHaveBeenLastCalledWith('title');
    component.open(note.date);
    expect(component.modal()!.open).toHaveBeenLastCalledWith('control');
  });
  it('keeps edited note text until discard is confirmed and ignores equivalent whitespace', async () => {
    const { component } = await setup();
    const discard = vi.spyOn(component.discardModal(), 'confirmDiscard').mockResolvedValue(false);
    component.open(note.date, note);
    component.noteText.set(` ${note.text} `);
    expect(await component.beforeDismiss()).toBe(true);
    component.noteText.set('Different plans');
    expect(await component.beforeDismiss()).toBe(false);
    expect(component.noteText()).toBe('Different plans');
    discard.mockResolvedValue(true);
    expect(await component.beforeDismiss()).toBe(true);
  });
  it('blocks removal of a new note, pending save, changed cycle, or historical cycle', async () => {
    const { component, currentCycle, removed } = await setup();
    component.open(note.date);
    component.remove();
    component.open(note.date, note);
    component.saving.set(true);
    component.remove();
    component.saving.set(false);
    currentCycle.set({ ...cycle, id: 'cycle-2' });
    component.remove();
    currentCycle.set({ ...cycle, nextPlanningCycleId: 'cycle-2' });
    component.remove();
    expect(removed).not.toHaveBeenCalled();
  });
});
