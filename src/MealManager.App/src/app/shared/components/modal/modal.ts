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
  dismissOnBackdrop = input(true);
  busy = input(false);
  beforeDismiss = input<(() => boolean | Promise<boolean>) | null>(null);
  private dismissPending: number | null = null;
  private session = 0;
  private backdropPointer: number | null = null;
  private backdropClick = false;
  closed = output<void>();
  readonly titleId = `modal-title-${++Modal.nextId}`;
  private previouslyFocused: HTMLElement | null = null;

  dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  body = viewChild.required<ElementRef<HTMLElement>>('body');

  open(initialFocus: 'control' | 'title' = 'control') {
    const dialog = this.dialog().nativeElement;
    if (dialog.open) return;
    ++this.session;
    this.resetBackdrop();
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
    ++this.session;
    const dialog = this.dialog().nativeElement;
    if (dialog.open) dialog.close();
  }

  focusTitle() {
    this.dialog()
      .nativeElement.querySelector<HTMLElement>(`#${this.titleId}`)
      ?.focus({ preventScroll: true });
  }

  async cancel() {
    const session = this.session;
    if (this.busy() || this.dismissPending === session) return;
    this.dismissPending = session;
    try {
      const guard = this.beforeDismiss();
      const allowed = !guard || (await guard());
      if (allowed && !this.busy() && session === this.session) this.close();
    } finally {
      if (this.dismissPending === session) this.dismissPending = null;
    }
  }

  onCancel(event: Event) {
    event.preventDefault();
    void this.cancel();
  }

  onBackdropClick(event: MouseEvent) {
    const dismiss = this.backdropClick;
    this.resetBackdrop();
    if (dismiss && this.dismissOnBackdrop() && event.target === this.dialog().nativeElement)
      void this.cancel();
  }

  onPointerDown(event: PointerEvent) {
    this.resetBackdrop();
    if (event.button === 0 && event.target === this.dialog().nativeElement)
      this.backdropPointer = event.pointerId;
  }

  onPointerUp(event: PointerEvent) {
    this.backdropClick =
      this.backdropPointer === event.pointerId && event.target === this.dialog().nativeElement;
    this.backdropPointer = null;
  }

  resetBackdrop() {
    this.backdropPointer = null;
    this.backdropClick = false;
  }

  restoreFocus() {
    const topDialog = [...document.querySelectorAll('dialog[open]')].at(-1);
    if (!topDialog || this.previouslyFocused?.closest('dialog') === topDialog) {
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
