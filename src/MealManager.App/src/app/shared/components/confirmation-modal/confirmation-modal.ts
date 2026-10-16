import { AppIcon } from '../app-icon/app-icon';
import { Component, signal, viewChild } from '@angular/core';
import { Modal } from '../modal/modal';

export interface ConfirmationOptions {
  title: string;
  message: string;
  confirmLabel: string;
  destructive?: boolean;
  cancelLabel?: string;
}

@Component({
  selector: 'app-confirmation-modal',
  imports: [AppIcon, Modal],
  templateUrl: './confirmation-modal.html',
})
export class ConfirmationModal {
  modal = viewChild.required<Modal>('modal');
  title = signal('');
  message = signal('');
  confirmLabel = signal($localize`:@@common.confirm:Confirm`);
  cancelLabel = signal($localize`:@@common.cancel:Cancel`);
  destructive = signal(false);

  private resolver: ((confirmed: boolean) => void) | null = null;
  private pending: Promise<boolean> | null = null;

  confirmDiscard(): Promise<boolean> {
    return this.open({
      title: $localize`:@@recipes.editRecipePage.discardUnsavedChanges:Discard unsaved changes?`,
      message: $localize`:@@common.unsavedDialogChanges:Your changes have not been saved. If you close now, they will be lost.`,
      cancelLabel: $localize`:@@recipes.keepEditing:Keep editing`,
      confirmLabel: $localize`:@@recipes.discardChanges:Discard changes`,
      destructive: true,
    });
  }

  open(options: ConfirmationOptions): Promise<boolean> {
    if (this.pending) return this.pending;

    this.title.set(options.title);
    this.message.set(options.message);
    this.confirmLabel.set(options.confirmLabel);
    this.cancelLabel.set(options.cancelLabel ?? $localize`:@@common.cancel:Cancel`);
    this.destructive.set(options.destructive ?? false);
    this.pending = new Promise<boolean>((resolve) => (this.resolver = resolve));
    this.modal().open();
    return this.pending;
  }

  decide(confirmed: boolean) {
    const resolver = this.resolver;
    this.resolver = null;
    this.pending = null;
    resolver?.(confirmed);
    this.modal().close();
  }

  onClosed() {
    if (!this.resolver) return;
    const resolver = this.resolver;
    this.resolver = null;
    this.pending = null;
    resolver(false);
  }
}
