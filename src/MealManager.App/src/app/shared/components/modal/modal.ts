import { Component, ElementRef, input, output, viewChild } from '@angular/core';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-modal',
  templateUrl: './modal.html',
  imports: [AppIcon],
})
export class Modal {
  private static nextId = 0;

  size = input<'standard' | 'wide'>('standard');
  showClose = input(true);
  labelledBy = input<string | null>(null);
  dismissOnBackdrop = input(false);
  closed = output<void>();
  readonly titleId = `modal-title-${++Modal.nextId}`;
  private previouslyFocused: HTMLElement | null = null;

  dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  body = viewChild.required<ElementRef<HTMLElement>>('body');

  open(initialFocus: 'control' | 'title' = 'control') {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    this.previouslyFocused = document.activeElement as HTMLElement | null;
    const title = dialog.querySelector<HTMLElement>(`#${this.titleId}`);
    // Set native initial focus before showModal so editing never summons a keyboard.
    if (initialFocus === 'title') title?.setAttribute('autofocus', '');
    try {
      dialog.showModal();
    } finally {
      if (initialFocus === 'title') title?.removeAttribute('autofocus');
    }
    queueMicrotask(() => {
      if (!dialog.open) return;
      if (initialFocus === 'title') this.focusTitle();
      else this.focusFirstControl();
    });
  }

  focusFirstControl() {
    const dialog = this.dialog().nativeElement;
    if (!dialog.open) return;
    const controls = dialog.querySelectorAll<HTMLElement>(
      '[autofocus], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])',
    );
    const target =
      Array.from(controls).find((control) => control.closest('dialog') === dialog) ??
      dialog.querySelector<HTMLElement>('button:not([disabled])') ??
      dialog.querySelector<HTMLElement>(`#${this.titleId}`);
    target?.focus({ preventScroll: true });
  }

  close() {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
  }

  focusTitle() {
    this.dialog()
      .nativeElement.querySelector<HTMLElement>(`#${this.titleId}`)
      ?.focus({ preventScroll: true });
  }

  cancel() {
    this.close();
  }

  onBackdropClick(event: MouseEvent) {
    if (this.dismissOnBackdrop() && event.target === this.dialog().nativeElement) this.cancel();
  }

  restoreFocus() {
    if (!document.querySelector('dialog[open]')) {
      this.previouslyFocused?.focus({ preventScroll: true });
    }
    this.previouslyFocused = null;
  }

  onClosed() {
    // A native close event may arrive after a new opening in the same turn.
    if (this.dialog().nativeElement.open) return;
    this.restoreFocus();
    this.closed.emit();
  }
}
