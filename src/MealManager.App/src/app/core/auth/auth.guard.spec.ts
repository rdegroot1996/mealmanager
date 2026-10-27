import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { authGuard } from './auth.guard';

describe('temporary-password route guard', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] }),
  );
  it('redirects household routes to replacement and allows the replacement route', () => {
    const auth = TestBed.inject(AuthService);
    auth.isAuthenticated.set(true);
    auth.currentUser.set({
      id: 'member',
      email: 'member@example.test',
      displayName: 'Member',
      isAdmin: false,
      mustChangePassword: true,
    });
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as never, { url: '/recipes' } as never),
    );
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/change-password');
    expect(
      TestBed.runInInjectionContext(() =>
        authGuard({} as never, { url: '/change-password' } as never),
      ),
    ).toBe(true);
    auth.currentUser.update((user) => ({ ...user!, mustChangePassword: false }));
    expect(
      TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/recipes' } as never)),
    ).toBe(true);
  });
});
