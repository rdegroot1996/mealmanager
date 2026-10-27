import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { catchError, map, Observable, of, switchMap, tap, throwError } from 'rxjs';
import { ApiUser } from '../../api/models/api-user';

interface AuthenticationSession {
  isAuthenticated: boolean;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);

  readonly isAuthenticated = signal(false);
  readonly currentUser = signal<ApiUser | null>(null);

  login(email: string, password: string) {
    return this.http
      .post<void>('/api/authentication/login', { email, password })
      .pipe(switchMap(() => this.restoreSession(true)));
  }

  logout() {
    return this.http
      .post<void>('/api/authentication/logout', {})
      .pipe(switchMap(() => this.restoreSession()));
  }

  changePassword(currentPassword: string, newPassword: string) {
    return this.http
      .post<void>('/api/authentication/change-password', { currentPassword, newPassword })
      .pipe(switchMap(() => this.restoreSession()));
  }

  restoreSession(strict = false): Observable<boolean> {
    return this.http.get<AuthenticationSession>('/api/authentication/session').pipe(
      switchMap((session) =>
        session.isAuthenticated
          ? this.http.get<ApiUser>('/api/users/me').pipe(
              tap((user) => this.currentUser.set(user)),
              map(() => true),
            )
          : of(false),
      ),
      tap((isAuthenticated) => {
        this.isAuthenticated.set(isAuthenticated);
        if (!isAuthenticated) this.currentUser.set(null);
      }),
      catchError((error: unknown) => {
        this.markUnauthenticated();
        return strict ? throwError(() => error) : of(false);
      }),
    );
  }

  markUnauthenticated() {
    this.isAuthenticated.set(false);
    this.currentUser.set(null);
  }
}
