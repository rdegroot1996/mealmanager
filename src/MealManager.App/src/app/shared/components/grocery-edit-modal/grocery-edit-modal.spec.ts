import { TestBed } from '@angular/core/testing';
import { GroceryEditModal } from './grocery-edit-modal';

describe('GroceryEditModal', () => {
  it('protects a changed item draft and stops prompting when changes are reverted', async () => {
    const { editor } = await setup();
    const discard = vi.spyOn(editor.discardModal(), 'confirmDiscard').mockResolvedValue(false);
    editor.open({ name: 'Rice', quantity: 2 });
    expect(await editor.beforeDismiss()).toBe(true);
    editor.draftQuantity.set(3);
    expect(await editor.beforeDismiss()).toBe(false);
    expect(editor.draftQuantity()).toBe(3);
    editor.draftQuantity.set(2);
    editor.draftName.set(' Rice ');
    expect(await editor.beforeDismiss()).toBe(true);
    expect(discard).toHaveBeenCalledOnce();
    editor.openNew();
    expect(await editor.beforeDismiss()).toBe(true);
    editor.draftName.set('Milk');
    discard.mockResolvedValue(true);
    expect(await editor.beforeDismiss()).toBe(true);
  });
  async function setup() {
    const fixture = TestBed.createComponent(GroceryEditModal);
    fixture.detectChanges();
    const editor = fixture.componentInstance;
    vi.spyOn(editor.modal(), 'open').mockImplementation(() => {});
    const close = vi.spyOn(editor.modal(), 'close').mockImplementation(() => {});
    const saved = vi.fn();
    const removed = vi.fn();
    editor.saved.subscribe(saved);
    editor.removed.subscribe(removed);
    return { fixture, editor, close, saved, removed };
  }

  it('discards unsaved changes when reopened and saves a trimmed name', async () => {
    const { editor, saved, close } = await setup();
    editor.open({ name: 'Pasta', quantity: 2 });
    editor.draftName.set('Discarded');
    editor.open({ name: 'Rice', quantity: 3 });
    expect(editor.draftName()).toBe('Rice');
    editor.draftName.set(' Brown rice ');
    editor.save();
    expect(saved).toHaveBeenCalledWith({ name: 'Brown rice', quantity: 3 });
    expect(close).toHaveBeenCalledOnce();
  });

  it('focuses the title for edits and a control for creation', async () => {
    const { editor } = await setup();
    editor.open({ name: 'Rice', quantity: 1 });
    expect(editor.modal().open).toHaveBeenLastCalledWith('title');
    editor.openNew();
    expect(editor.modal().open).toHaveBeenLastCalledWith('control');
  });

  it.each([0, 1.5, NaN])('keeps the dialog open for invalid quantity %s', async (quantity) => {
    const { editor, saved, close } = await setup();
    editor.open({ name: 'Pasta', quantity });
    editor.save();
    expect(editor.error()).toContain('whole number');
    expect(saved).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
  });

  it('removes without requiring a valid draft and guards pending mutations', async () => {
    const { fixture, editor, removed, close } = await setup();
    editor.open({ name: '', quantity: 0 });
    fixture.componentRef.setInput('disabled', true);
    editor.remove();
    editor.save();
    expect(removed).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    fixture.componentRef.setInput('disabled', false);
    editor.remove();
    expect(removed).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
  it('starts an add draft without removal and emits a valid creation', async () => {
    const { fixture, editor, saved, removed } = await setup();
    editor.open({ name: 'Old draft', quantity: 7 });
    editor.openNew();
    fixture.detectChanges();
    expect(editor.draftName()).toBe('');
    expect(editor.draftQuantity()).toBe(1);
    expect(fixture.nativeElement.textContent).toContain('Add grocery item');
    expect(fixture.nativeElement.querySelector('[modal-secondary-actions]')).toBeNull();
    editor.remove();
    expect(removed).not.toHaveBeenCalled();
    editor.changeName(' Rice ');
    editor.save();
    expect(saved).toHaveBeenCalledWith({ name: 'Rice', quantity: 1 });
  });

  it('keeps the draft open for asynchronous saving and displays a save error', async () => {
    const { fixture, editor, close, saved } = await setup();
    fixture.componentRef.setInput('closeOnSave', false);
    editor.openNew();
    editor.changeName('Rice');
    editor.save();
    expect(saved).toHaveBeenCalledWith({ name: 'Rice', quantity: 1 });
    expect(close).not.toHaveBeenCalled();
    fixture.componentRef.setInput('saveError', 'Try again');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      'Try again',
    );
    expect(editor.draftName()).toBe('Rice');
  });

  it('submits the item form through the footer action or keyboard submission', async () => {
    const { fixture, editor, saved } = await setup();
    editor.open({ name: 'Rice', quantity: 2 });
    await fixture.whenStable();
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    const submit = fixture.nativeElement.querySelector('[modal-actions]') as HTMLButtonElement;
    expect(submit.form).toBe(form);
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    expect(saved).toHaveBeenCalledOnce();
    expect(saved).toHaveBeenCalledWith({ name: 'Rice', quantity: 2 });
  });

  it('selects a suggestion without changing quantity or saving', async () => {
    const { fixture, editor, saved } = await setup();
    fixture.componentRef.setInput('suggestionsEnabled', true);
    fixture.componentRef.setInput('suggestions', ['Oat milk']);
    editor.changeName('Oat');
    editor.draftQuantity.set(3);
    fixture.detectChanges();
    const suggestion = fixture.nativeElement.querySelector(
      '[aria-label="Item suggestions"] button',
    );
    suggestion.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    suggestion.click();
    expect(editor.draftName()).toBe('Oat milk');
    expect(editor.draftQuantity()).toBe(3);
    expect(saved).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(editor.nameInput().nativeElement);
  });

  it('supports arrow navigation and dismisses suggestions before the native dialog', async () => {
    const { fixture, editor } = await setup();
    fixture.componentRef.setInput('suggestionsEnabled', true);
    fixture.componentRef.setInput('suggestions', ['Milk', 'Oat milk']);
    editor.changeName('mi');
    fixture.detectChanges();
    const input = editor.nameInput().nativeElement;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const buttons = fixture.nativeElement.querySelectorAll(
      '[aria-label="Item suggestions"] button',
    );
    expect(document.activeElement).toBe(buttons[0]);
    buttons[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(document.activeElement).toBe(buttons[1]);
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    buttons[1].dispatchEvent(escape);
    expect(escape.defaultPrevented).toBe(true);
    expect(editor.suggestionsOpen()).toBe(false);
    expect(document.activeElement).toBe(input);
    const nativeEscape = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    });
    input.dispatchEvent(nativeEscape);
    expect(nativeEscape.defaultPrevented).toBe(false);
  });

  it('keeps loading suggestions stable and does not reopen them after Escape', async () => {
    const { fixture, editor } = await setup();
    fixture.componentRef.setInput('suggestionsEnabled', true);
    fixture.componentRef.setInput('suggestionsLoading', true);
    editor.changeName('mi');
    fixture.detectChanges();
    const panel = fixture.nativeElement.querySelector('[aria-label="Item suggestions"]');
    expect(panel.textContent).toContain('Searching');
    fixture.componentRef.setInput('suggestionsLoading', false);
    fixture.componentRef.setInput('suggestions', ['Milk']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Item suggestions"]')).toBe(panel);
    editor
      .nameInput()
      .nativeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.componentRef.setInput('suggestions', ['Oat milk']);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[aria-label="Item suggestions"]')).toBeNull();
  });

  it('rejects an item name that the API cannot subsequently edit', async () => {
    const { editor, saved, close } = await setup();
    editor.open({ name: 'a'.repeat(201), quantity: 1 });
    editor.save();
    expect(saved).not.toHaveBeenCalled();
    expect(close).not.toHaveBeenCalled();
    expect(editor.error()).toContain('200 characters');
    editor.draftName.set('a'.repeat(200));
    editor.save();
    expect(saved).toHaveBeenCalledWith({ name: 'a'.repeat(200), quantity: 1 });
  });
});
