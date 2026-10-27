import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const isAnonymousRequest =
    request.url.includes('/api/authentication/') || request.url.includes('/api/config');

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 403 && error.error?.code === 'PasswordChangeRequired') {
        auth.currentUser.update((user) => (user ? { ...user, mustChangePassword: true } : user));
        void router.navigate(['/change-password']);
      }
      if (error.status === 401 && !isAnonymousRequest) {
        auth.markUnauthenticated();
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    }),
  );
};
