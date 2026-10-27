import { Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiUser } from '../../../../api/models/api-user';
import { Modal } from '../../../../shared/components/modal/modal';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { FormField } from '../../../../shared/components/form-field/form-field';
import { ToastService } from '../../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { UsersStore } from '../../state/users.store';
import { newPasswordError, passwordHint } from '../../../authentication/authentication-validation';

@Component({
  selector: 'app-reset-password-modal',
  imports: [FormsModule, Modal, ConfirmationModal, FormField],
  templateUrl: './reset-password-modal.html',
})
export class ResetPasswordModal {
  modal = viewChild.required<Modal>('modal');
  discard = viewChild.required<ConfirmationModal>('discard');
  readonly beforeDismiss = () => !this.password() || this.discard().confirmDiscard();
  readonly passwordHint = passwordHint;
  private store = inject(UsersStore);
  private toast = inject(ToastService);
  user = signal<ApiUser | null>(null);
  password = signal('');
  saving = signal(false);
  error = signal('');
  private session = 0;
  ngOnDestroy() {
    this.endSession();
  }
  endSession() {
    ++this.session;
    this.password.set('');
  }
  open(user: ApiUser) {
    ++this.session;
    this.user.set(user);
    this.password.set('');
    this.error.set('');
    this.saving.set(false);
    this.modal().open();
  }
  save() {
    const user = this.user();
    if (!user || this.saving()) return;
    const validation = newPasswordError(this.password());
    if (validation) {
      this.error.set(validation);
      return;
    }
    const session = this.session;
    this.saving.set(true);
    this.error.set('');
    this.store.resetPassword(user.id, this.password()).subscribe({
      next: () => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.modal().close();
        this.toast.success(
          $localize`:@@users.passwordReset:Password reset. Share the temporary password privately; it must be replaced at sign-in.`,
        );
      },
      error: (error) => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.error.set(
          apiErrorMessage(
            error,
            $localize`:@@users.passwordResetFailed:The password could not be reset. Try again.`,
          ),
        );
      },
    });
  }
}
