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

  it('optionally closes when its backdrop is clicked', () => {
    fixture.componentRef.setInput('dismissOnBackdrop', true);
    const close = vi.spyOn(component, 'close').mockImplementation(() => undefined);
    const dialog = component.dialog().nativeElement;

    component.onBackdropClick(new MouseEvent('click'));
    expect(close).not.toHaveBeenCalled();

    component.onBackdropClick({ target: dialog } as unknown as MouseEvent);
    expect(close).toHaveBeenCalledOnce();
  });
});
