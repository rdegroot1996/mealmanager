import { Component, inject, OnInit, signal, viewChild } from '@angular/core';
import { ApiUser } from '../../../../api/models/api-user';
import { AuthService } from '../../../../core/auth/auth.service';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { ToastService } from '../../../../shared/services/toast.service';
import { UserFormModal } from '../../components/user-form-modal/user-form-modal';
import { UsersStore } from '../../state/users.store';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { editItemLabel } from '../../../../core/i18n/labels';

@Component({
  selector: 'app-users-page',
  imports: [ConfirmationModal, EmptyState, LoadingIndicator, UserFormModal, AppIcon],
  templateUrl: './users-page.html',
})
export class UsersPage implements OnInit {
  readonly editItemLabel = editItemLabel;
  readonly store = inject(UsersStore);
  readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);

  form = viewChild.required<UserFormModal>('form');
  confirmation = viewChild.required<ConfirmationModal>('confirmation');
  loading = signal(true);
  error = signal('');

  ngOnInit() {
    this.load();
  }

  load() {
    this.loading.set(true);
    this.error.set('');
    this.store.loadUsers().subscribe({
      next: () => this.loading.set(false),
      error: (error: unknown) => {
        this.loading.set(false);
        this.error.set(
          apiErrorMessage(
            error,
            $localize`:@@users.usersPage.usersCouldNotBeLoaded:Users could not be loaded.`,
          ),
        );
      },
    });
  }

  async deleteUser(user: ApiUser) {
    if (user.id === this.auth.currentUser()?.id) return;
    const confirmed = await this.confirmation().open({
      title: $localize`:@@users.usersPage.removeUser:Remove user?`,
      message: $localize`:@@users.confirmRemove:${user.displayName}:displayName: will no longer be able to sign in.`,
      confirmLabel: $localize`:@@users.removeUser:Remove user`,
      destructive: true,
    });
    if (!confirmed) return;
    this.store.deleteUser(user.id).subscribe({
      next: () => this.toast.success($localize`:@@users.usersPage.userRemoved:User removed.`),
      error: (error: unknown) =>
        this.toast.error(
          apiErrorMessage(
            error,
            $localize`:@@users.usersPage.theUserCouldNotBeRemoved:The user could not be removed.`,
          ),
        ),
    });
  }

  onSaved(user: ApiUser) {
    if (user.id === this.auth.currentUser()?.id) this.auth.currentUser.set(user);
  }
}
