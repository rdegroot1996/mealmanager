import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfigService } from '../../../../core/config/config.service';
import { AuthService } from '../../../../core/auth/auth.service';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthShell } from '../../../../shared/components/auth-shell/auth-shell';
import { FormField } from '../../../../shared/components/form-field/form-field';
import { DEFAULT_LOCALE } from '../../../../core/i18n/locale';
import {
  emailError,
  focusInvalidControl,
  newPasswordError,
  passwordHint,
} from '../../authentication-validation';

@Component({
  selector: 'app-setup-page',
  imports: [FormsModule, AuthShell, FormField],
  templateUrl: './setup-page.html',
})
export class SetupPage implements OnInit {
  private readonly config = inject(ConfigService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  email = '';
  displayName = '';
  password = '';
  confirmPassword = '';
  error = signal('');
  loading = signal(false);
  attempted = signal(false);
  readonly passwordHint = passwordHint;

  fieldError(field: string): string | null {
    if (!this.attempted()) return null;
    if (field === 'display-name')
      return this.displayName.trim()
        ? null
        : $localize`:@@authentication.displayNameRequired:Enter your display name.`;
    if (field === 'email') return emailError(this.email);
    if (field === 'password') return newPasswordError(this.password);
    return this.confirmPassword && this.password === this.confirmPassword
      ? null
      : $localize`:@@authentication.setupPage.thePasswordsDoNotMatch:The passwords do not match.`;
  }

  ngOnInit() {
    this.config.getConfig().subscribe({
      next: (state) => {
        if (state.appInitialized && !this.auth.isAuthenticated())
          void this.router.navigate(['/login']);
      },
      error: () =>
        this.error.set(
          $localize`:@@authentication.setupPage.theApplicationSetupStatusCouldNotBe:The application setup status could not be loaded.`,
        ),
    });
  }

  submit() {
    if (this.loading()) return;
    this.error.set('');
    this.attempted.set(true);
    const invalid = ['display-name', 'email', 'password', 'confirm-password'].filter((field) =>
      this.fieldError(field),
    );
    if (invalid.length) {
      focusInvalidControl(invalid.map((field) => 'setup-' + field));
      return;
    }

    this.loading.set(true);
    this.config
      .initialize({
        adminEmail: this.email.trim(),
        adminPassword: this.password,
        adminDisplayName: this.displayName.trim(),
      })
      .pipe(
        switchMap(() =>
          this.auth
            .login(this.email.trim(), this.password)
            .pipe(catchError(() => throwError(() => new Error('automatic-sign-in-failed')))),
        ),
      )
      .subscribe({
        next: (authenticated) => {
          this.loading.set(false);
          if (authenticated) void this.router.navigate(['/']);
          else {
            this.error.set(
              $localize`:@@authentication.setupPage.setupCompletedPleaseSignIn:Setup completed. Please sign in.`,
            );
            void this.router.navigate(['/login']);
          }
        },
        error: (response) => {
          this.loading.set(false);
          if (response instanceof Error && response.message === 'automatic-sign-in-failed') {
            this.error.set(
              $localize`:@@authentication.setupPage.setupCompletedButAutomaticSignInFailed:Setup completed, but automatic sign-in failed. Please sign in.`,
            );
            void this.router.navigate(['/login']);
            return;
          }
          this.error.set(
            document.documentElement.lang !== DEFAULT_LOCALE
              ? $localize`:@@authentication.setupPage.theApplicationCouldNotBeInitialized:The application could not be initialized.`
              : (response?.error?.detail ??
                  $localize`:@@authentication.setupPage.theApplicationCouldNotBeInitialized:The application could not be initialized.`),
          );
        },
      });
  }
}
