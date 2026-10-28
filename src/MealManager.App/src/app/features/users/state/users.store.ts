import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';
import { ApiUser } from '../../../api/models/api-user';

export interface SaveUserRequest {
  displayName: string;
  isAdmin: boolean;
  email?: string;
  password?: string;
}

@Injectable({ providedIn: 'root' })
export class UsersStore {
  private readonly http = inject(HttpClient);

  readonly users = signal<ApiUser[]>([]);

  loadUsers() {
    return this.http
      .get<ApiUser[]>('/api/users')
      .pipe(tap((users) => this.users.set(this.sort(users))));
  }

  saveUser(userId: string | null, request: SaveUserRequest) {
    const operation = userId
      ? this.http.put<ApiUser>(`/api/users/${userId}`, {
          displayName: request.displayName,
          isAdmin: request.isAdmin,
        })
      : this.http.post<ApiUser>('/api/users', request);

    return operation.pipe(
      tap((saved) => {
        this.users.update((users) =>
          this.sort([...users.filter((user) => user.id !== saved.id), saved]),
        );
      }),
    );
  }

  deleteUser(userId: string) {
    return this.http
      .delete<void>(`/api/users/${userId}`)
      .pipe(tap(() => this.users.update((users) => users.filter((user) => user.id !== userId))));
  }

  resetPassword(userId: string, temporaryPassword: string) {
    return this.http
      .post<void>(`/api/users/${userId}/reset-password`, { temporaryPassword })
      .pipe(
        tap(() =>
          this.users.update((users) =>
            users.map((user) =>
              user.id === userId ? { ...user, mustChangePassword: true } : user,
            ),
          ),
        ),
      );
  }

  private sort(users: ApiUser[]) {
    return [...users].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }
}
