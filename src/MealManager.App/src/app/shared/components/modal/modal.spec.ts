import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Modal } from './modal';

describe('Modal', () => {
  let component: Modal;
  let fixture: ComponentFixture<Modal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Modal],
    }).compileComponents();

    fixture = TestBed.createComponent(Modal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('guards Escape and close clicks without duplicating a pending discard decision', async () => {
    let resolve!: (allowed: boolean) => void;
    const guard = vi.fn(() => new Promise<boolean>((decision) => (resolve = decision)));
    fixture.componentRef.setInput('beforeDismiss', guard);
    fixture.detectChanges();
    const close = vi.spyOn(component, 'close').mockImplementation(() => {});
    const cancel = new Event('cancel', { cancelable: true });
    component.onCancel(cancel);
    fixture.nativeElement.querySelector('button[aria-label="Close"]').click();
    expect(cancel.defaultPrevented).toBe(true);
    expect(guard).toHaveBeenCalledOnce();
    resolve(false);
    await Promise.resolve();
    expect(close).not.toHaveBeenCalled();
    const pending = component.cancel();
    resolve(true);
    await pending;
    expect(close).toHaveBeenCalledOnce();
  });

  it('focuses the title during native opening and keeps editing controls unfocused', async () => {
    const dialog = component.dialog().nativeElement;
    const title = dialog.querySelector<HTMLElement>(`#${component.titleId}`)!;
    const input = document.createElement('input');
    component.body().nativeElement.prepend(input);
    dialog.showModal = vi.fn(() => {
      expect(title.hasAttribute('autofocus')).toBe(true);
      dialog.open = true;
      title.focus();
    });
    component.open('title');
    await Promise.resolve();
    expect(document.activeElement).toBe(title);
    expect(title.hasAttribute('autofocus')).toBe(false);
    input.remove();
  });

  it('focuses its first control and restores the opening control on close', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const focus = vi.spyOn(opener, 'focus');
    const dialog = component.dialog().nativeElement;
    dialog.showModal = vi.fn(() => {
      dialog.open = true;
    });
    component.open();
    await Promise.resolve();
    expect(document.activeElement).toBe(dialog.querySelector('button'));
    dialog.open = false;
    component.onClosed();
    expect(document.activeElement).toBe(opener);
    expect(focus).toHaveBeenLastCalledWith({ preventScroll: true });
    opener.remove();
  });

  it('does not restore focus underneath a newly opened dialog', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const dialog = component.dialog().nativeElement;
    dialog.showModal = vi.fn(() => {
      dialog.open = true;
    });
    component.open();
    dialog.open = false;
    const nextDialog = document.createElement('dialog');
    nextDialog.open = true;
    document.body.append(nextDialog);
    const nextButton = document.createElement('button');
    nextDialog.append(nextButton);
    nextButton.focus();
    component.onClosed();
    expect(document.activeElement).toBe(nextButton);
    nextDialog.remove();
    opener.remove();
  });

  it('does not focus controls belonging to a nested closed dialog', () => {
    const dialog = component.dialog().nativeElement;
    dialog.open = true;
    const nested = document.createElement('dialog');
    nested.append(document.createElement('input'));
    component.body().nativeElement.prepend(nested);
    component.focusFirstControl();
    expect(document.activeElement).toBe(dialog.querySelector('button'));
    nested.remove();
  });

  it('supports bottom placement', () => {
    fixture.detectChanges();

    expect(component.dialog().nativeElement.classList).toContain('modal-bottom');
    expect(fixture.nativeElement.querySelector('.app-dialog-footer')).not.toBeNull();
  });
  it('supports a wide dialog with a scrolling body and small phone gutters', () => {
    fixture.componentRef.setInput('size', 'wide');
    fixture.detectChanges();
    const box = fixture.nativeElement.querySelector('.modal-box') as HTMLElement;
    expect(box.classList).toContain('min-[600px]:max-w-[1100px]');
    expect(component.body().nativeElement.classList).toContain('overflow-y-auto');
  });
  it('provides a header close action and allows opting out', () => {
    fixture.detectChanges();
    const close = vi.spyOn(component, 'close').mockImplementation(() => undefined);
    fixture.nativeElement.querySelector('button[aria-label="Close"]').click();
    expect(close).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('showClose', false);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('button[aria-label="Close"]')).toBeNull();
  });

  it('does not replace the original opening control when an open dialog changes view', async () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const dialog = component.dialog().nativeElement;
    dialog.showModal = vi.fn(() => {
      dialog.open = true;
    });
    component.open();
    await Promise.resolve();
    component.open();
    expect(dialog.showModal).toHaveBeenCalledOnce();
    dialog.open = false;
    component.onClosed();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  function backdropGesture(start: EventTarget, end: EventTarget) {
    component.onPointerDown({ target: start, pointerId: 1, button: 0 } as unknown as PointerEvent);
    component.onPointerUp({ target: end, pointerId: 1 } as unknown as PointerEvent);
    component.onBackdropClick({ target: end } as unknown as MouseEvent);
  }

  it('closes on a complete backdrop gesture, but not a click inside or a drag from inside', () => {
    const close = vi.spyOn(component, 'close').mockImplementation(() => undefined);
    const dialog = component.dialog().nativeElement;
    const body = component.body().nativeElement;
    backdropGesture(body, body);
    backdropGesture(body, dialog);
    backdropGesture(dialog, body);
    component.onBackdropClick({ target: dialog } as unknown as MouseEvent);
    expect(close).not.toHaveBeenCalled();
    backdropGesture(dialog, dialog);
    expect(close).toHaveBeenCalledOnce();
  });

  it('allows opting out and ignores pointer cancellation and mismatched pointers', () => {
    const close = vi.spyOn(component, 'close').mockImplementation(() => undefined);
    const dialog = component.dialog().nativeElement;
    fixture.componentRef.setInput('dismissOnBackdrop', false);
    backdropGesture(dialog, dialog);
    fixture.componentRef.setInput('dismissOnBackdrop', true);
    component.onPointerDown({ target: dialog, pointerId: 1, button: 0 } as unknown as PointerEvent);
    component.resetBackdrop();
    component.onPointerUp({ target: dialog, pointerId: 1 } as unknown as PointerEvent);
    component.onBackdropClick({ target: dialog } as unknown as MouseEvent);
    component.onPointerDown({ target: dialog, pointerId: 1, button: 0 } as unknown as PointerEvent);
    component.onPointerUp({ target: dialog, pointerId: 2 } as unknown as PointerEvent);
    component.onBackdropClick({ target: dialog } as unknown as MouseEvent);
    expect(close).not.toHaveBeenCalled();
  });

  it('guards backdrop dismissal and blocks all ordinary exits while busy', async () => {
    const guard = vi.fn().mockResolvedValue(false);
    fixture.componentRef.setInput('beforeDismiss', guard);
    const close = vi.spyOn(component, 'close').mockImplementation(() => undefined);
    const dialog = component.dialog().nativeElement;
    backdropGesture(dialog, dialog);
    await Promise.resolve();
    expect(guard).toHaveBeenCalledOnce();
    fixture.componentRef.setInput('busy', true);
    fixture.detectChanges();
    component.onCancel(new Event('cancel'));
    backdropGesture(dialog, dialog);
    expect(fixture.nativeElement.querySelector('button[aria-label="Close"]').disabled).toBe(true);
    expect(guard).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
  });

  it('does not close a newly opened session after an older discard decision resolves', async () => {
    let resolve!: (allowed: boolean) => void;
    fixture.componentRef.setInput(
      'beforeDismiss',
      () => new Promise<boolean>((r) => (resolve = r)),
    );
    const dialog = component.dialog().nativeElement;
    dialog.showModal = vi.fn(() => (dialog.open = true));
    dialog.close = vi.fn(() => (dialog.open = false));
    component.open();
    const decision = component.cancel();
    component.close();
    component.open();
    resolve(true);
    await decision;
    expect(dialog.open).toBe(true);
    component.close();
  });

  it('restores focus to the opener inside a still-open parent dialog', () => {
    const parent = document.createElement('dialog');
    parent.open = true;
    const opener = document.createElement('button');
    parent.append(opener);
    document.body.append(parent);
    opener.focus();
    const dialog = component.dialog().nativeElement;
    dialog.showModal = vi.fn(() => (dialog.open = true));
    component.open();
    dialog.open = false;
    component.onClosed();
    expect(document.activeElement).toBe(opener);
    parent.remove();
  });
});
