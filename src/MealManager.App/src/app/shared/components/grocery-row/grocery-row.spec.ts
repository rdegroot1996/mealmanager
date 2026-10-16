import { TestBed } from '@angular/core/testing';
import { GroceryRow } from './grocery-row';

describe('GroceryRow', () => {
  function setup() {
    const fixture = TestBed.createComponent(GroceryRow);
    fixture.componentRef.setInput('item', { id: 'rice', name: 'Rice', quantity: 2 });
    fixture.detectChanges();
    const row = fixture.componentInstance;
    const open = vi.spyOn(row.editor().modal(), 'open').mockImplementation(() => {});
    const close = vi.spyOn(row.editor().modal(), 'close').mockImplementation(() => {});
    return { fixture, row, open, close };
  }

  it('edits the current grocery through the shared form and emits only its draft', () => {
    const { fixture, row, open, close } = setup();
    const saved = vi.fn();
    row.saved.subscribe(saved);
    fixture.nativeElement.querySelector('button[aria-label="Edit Rice"]').click();
    expect(open).toHaveBeenCalledOnce();
    expect(row.editor().draftName()).toBe('Rice');
    expect(row.editor().draftQuantity()).toBe(2);
    row.editor().changeName(' Brown rice ');
    row.editor().save();
    expect(saved).toHaveBeenCalledWith({ name: 'Brown rice', quantity: 2 });
    expect(close).toHaveBeenCalledOnce();
  });

  it('emits keyboard moves and removal while preventing the page from scrolling', () => {
    const { fixture, row } = setup();
    const moved = vi.fn();
    const removed = vi.fn();
    row.moveRequested.subscribe(moved);
    row.removed.subscribe(removed);
    const handle = fixture.nativeElement.querySelector('[data-item-handle="rice"]');
    for (const key of ['ArrowUp', 'ArrowDown']) {
      const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      handle.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
    expect(moved.mock.calls).toEqual([[-1], [1]]);
    row.startEditing();
    row.editor().remove();
    expect(removed).toHaveBeenCalledOnce();
  });

  it('blocks edits, late form events and keyboard moves while disabled', () => {
    const { fixture, row, open } = setup();
    const saved = vi.fn();
    const removed = vi.fn();
    const moved = vi.fn();
    row.saved.subscribe(saved);
    row.removed.subscribe(removed);
    row.moveRequested.subscribe(moved);
    fixture.componentRef.setInput('disabled', true);
    fixture.detectChanges();
    row.startEditing();
    row.editor().saved.emit({ name: 'Rice', quantity: 3 });
    row.editor().removed.emit();
    fixture.nativeElement
      .querySelector('[data-item-handle="rice"]')
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(open).not.toHaveBeenCalled();
    expect(saved).not.toHaveBeenCalled();
    expect(removed).not.toHaveBeenCalled();
    expect(moved).not.toHaveBeenCalled();
  });
});
