import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/auth/auth.service';
import { ConfigService } from '../../../../core/config/config.service';
import { AuthShell } from '../../../../shared/components/auth-shell/auth-shell';
import { FormField } from '../../../../shared/components/form-field/form-field';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, AuthShell, FormField],
  templateUrl: './login-page.html',
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly config = inject(ConfigService);

  email = '';
  password = '';
  error = signal('');
  loading = signal(false);

  ngOnInit() {
    this.config.getConfig().subscribe({
      next: (state) => {
        if (!state.appInitialized) void this.router.navigate(['/setup']);
      },
      error: () =>
        this.error.set(
          $localize`:@@authentication.loginPage.theApplicationCouldNotBeReachedRetry:The application could not be reached. Retry when the connection is available.`,
        ),
    });
  }

  submit() {
    this.error.set('');
    this.loading.set(true);
    this.auth.login(this.email, this.password).subscribe({
      next: (authenticated) => {
        this.loading.set(false);
        if (authenticated) void this.router.navigate(['/']);
        else
          this.error.set(
            $localize`:@@authentication.loginPage.signInCouldNotBeConfirmedPlease:Sign-in could not be confirmed. Please retry.`,
          );
      },
      error: (error: { status?: number }) => {
        this.loading.set(false);
        this.error.set(
          error.status === 401
            ? $localize`:@@authentication.loginPage.theEmailOrPasswordIsIncorrect:The email or password is incorrect.`
            : $localize`:@@authentication.loginPage.signInIsUnavailablePleaseRetry:Sign-in is unavailable. Please retry.`,
        );
      },
    });
  }
}
