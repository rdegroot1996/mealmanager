import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { Component, computed, inject, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ApiUser } from '../../../../api/models/api-user';
import { AuthService } from '../../../../core/auth/auth.service';
import { FormField } from '../../../../shared/components/form-field/form-field';
import { Modal } from '../../../../shared/components/modal/modal';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { ToastService } from '../../../../shared/services/toast.service';
import { UsersStore } from '../../state/users.store';

@Component({
  selector: 'app-user-form-modal',
  imports: [AppIcon, FormsModule, Modal, FormField],
  templateUrl: './user-form-modal.html',
})
export class UserFormModal {
  readonly emailCannotChange = $localize`:@@users.emailCannotChange:Email addresses cannot be changed.`;
  ngOnDestroy() {
    this.endSession();
  }
  private session = 0;
  endSession() {
    ++this.session;
  }
  private readonly store = inject(UsersStore);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  modal = viewChild.required<Modal>('modal');
  saved = output<ApiUser>();
  removed = output<ApiUser>();

  user = signal<ApiUser | null>(null);
  displayName = signal('');
  email = signal('');
  password = signal('');
  isAdmin = signal(false);
  saving = signal(false);
  error = signal('');
  isEdit = computed(() => this.user() !== null);
  isCurrentUser = computed(() => this.user()?.id === this.auth.currentUser()?.id);

  open(user?: ApiUser) {
    ++this.session;
    this.user.set(user ?? null);
    this.displayName.set(user?.displayName ?? '');
    this.email.set(user?.email ?? '');
    this.password.set('');
    this.isAdmin.set(user?.isAdmin ?? false);
    this.saving.set(false);
    this.error.set('');
    this.modal().open();
  }

  requestRemoval() {
    const user = this.user();
    if (!user || this.isCurrentUser() || this.saving()) return;
    this.modal().close();
    this.removed.emit(user);
  }

  save() {
    const session = this.session;
    if (this.saving()) return;
    const displayName = this.displayName().trim();
    const email = this.email().trim();
    if (!displayName) {
      this.error.set($localize`:@@users.userFormModal.enterADisplayName:Enter a display name.`);
      return;
    }
    if (!this.isEdit() && !email) {
      this.error.set($localize`:@@users.userFormModal.enterAnEmailAddress:Enter an email address.`);
      return;
    }
    if (!this.isEdit() && this.password().length < 6) {
      this.error.set(
        $localize`:@@users.userFormModal.passwordMustContainAtLeast6Characters:Password must contain at least 6 characters.`,
      );
      return;
    }

    const existing = this.user();
    this.saving.set(true);
    this.error.set('');
    this.store
      .saveUser(existing?.id ?? null, {
        displayName,
        isAdmin: this.isAdmin(),
        ...(!existing ? { email, password: this.password() } : {}),
      })
      .subscribe({
        next: (saved) => {
          if (session !== this.session) return;
          this.saving.set(false);
          this.saved.emit(saved);
          this.modal().close();
          this.toast.success(
            existing
              ? $localize`:@@users.userFormModal.userUpdated:User updated.`
              : $localize`:@@users.userFormModal.userCreated:User created.`,
          );
        },
        error: (error: unknown) => {
          if (session !== this.session) return;
          this.saving.set(false);
          this.error.set(
            apiErrorMessage(
              error,
              $localize`:@@users.userFormModal.theUserCouldNotBeSaved:The user could not be saved.`,
            ),
          );
        },
      });
  }
}
