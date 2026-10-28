import { TestBed } from '@angular/core/testing';
import { provideRouter, Router, UrlTree } from '@angular/router';
import { AuthService } from './auth.service';
import { adminGuard } from './admin.guard';

describe('adminGuard', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('allows administrators', () => {
    TestBed.inject(AuthService).currentUser.set({
      id: 'admin-id',
      email: 'admin@example.test',
      displayName: 'Admin',
      isAdmin: true,
      mustChangePassword: false,
    });

    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('redirects other users to the dashboard', () => {
    TestBed.inject(AuthService).currentUser.set({
      id: 'member-id',
      email: 'member@example.test',
      displayName: 'Member',
      isAdmin: false,
      mustChangePassword: false,
    });

    const result = TestBed.runInInjectionContext(() => adminGuard({} as never, {} as never));
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
