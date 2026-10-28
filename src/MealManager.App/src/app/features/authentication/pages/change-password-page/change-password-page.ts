import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { AuthService } from '../../../../core/auth/auth.service';
import { FormField } from '../../../../shared/components/form-field/form-field';
import { AuthShell } from '../../../../shared/components/auth-shell/auth-shell';
import { ToastService } from '../../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import {
  focusInvalidControl,
  newPasswordError,
  passwordHint,
} from '../../authentication-validation';

@Component({
  selector: 'app-change-password-page',
  imports: [FormsModule, FormField, AuthShell, NgTemplateOutlet],
  templateUrl: './change-password-page.html',
})
export class ChangePasswordPage {
  auth = inject(AuthService);
  private router = inject(Router);
  private toast = inject(ToastService);
  readonly passwordHint = passwordHint;
  readonly required = computed(() => !!this.auth.currentUser()?.mustChangePassword);
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  attempted = signal(false);
  saving = signal(false);
  error = signal('');

  signOut() {
    this.saving.set(true);
    this.auth.logout().subscribe({
      next: () => void this.router.navigate(['/login']),
      error: () => {
        this.auth.markUnauthenticated();
        void this.router.navigate(['/login']);
      },
    });
  }

  fieldError(field: string): string | null {
    if (!this.attempted()) return null;
    if (field === 'current')
      return this.currentPassword
        ? null
        : $localize`:@@authentication.passwordRequired:Enter your password.`;
    if (field === 'new')
      return (
        newPasswordError(this.newPassword) ??
        (this.newPassword === this.currentPassword
          ? $localize`:@@authentication.chooseDifferentPassword:Choose a different new password.`
          : null)
      );
    return this.confirmPassword && this.confirmPassword === this.newPassword
      ? null
      : $localize`:@@authentication.setupPage.thePasswordsDoNotMatch:The passwords do not match.`;
  }

  save() {
    if (this.saving()) return;
    this.attempted.set(true);
    this.error.set('');
    const invalid = ['current', 'new', 'confirm'].filter((field) => this.fieldError(field));
    if (invalid.length) {
      focusInvalidControl(invalid.map((field) => field + '-password'));
      return;
    }
    this.saving.set(true);
    this.auth.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: (authenticated) => {
        this.currentPassword = this.newPassword = this.confirmPassword = '';
        this.toast.success($localize`:@@authentication.passwordChanged:Password changed.`);
        void this.router.navigate([authenticated ? '/' : '/login']);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        if (error.error?.errors?.passwordMismatch) {
          this.error.set(
            $localize`:@@authentication.currentPasswordIncorrect:The current password is incorrect.`,
          );
          focusInvalidControl(['current-password']);
        } else
          this.error.set(
            apiErrorMessage(
              error,
              $localize`:@@authentication.passwordChangeFailed:The password could not be changed. Check the details and try again.`,
            ),
          );
      },
    });
  }
}
