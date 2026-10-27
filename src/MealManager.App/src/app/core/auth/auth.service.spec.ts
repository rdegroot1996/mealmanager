import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('marks the session as authenticated after login', () => {
    auth.login('user@example.com', 'Pass123!').subscribe();

    const request = http.expectOne('/api/authentication/login');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ email: 'user@example.com', password: 'Pass123!' });
    request.flush(null);

    http.expectOne('/api/authentication/session').flush({ isAuthenticated: true });
    http.expectOne('/api/users/me').flush({
      id: 'user-id',
      email: 'user@example.com',
      displayName: 'User',
      isAdmin: false,
      mustChangePassword: false,
    });
    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.currentUser()?.displayName).toBe('User');
  });

  it('clears the session when session restoration fails', () => {
    auth.isAuthenticated.set(true);
    auth.restoreSession().subscribe();
    http.expectOne('/api/authentication/session').flush(null, {
      status: 500,
      statusText: 'Server Error',
    });

    expect(auth.isAuthenticated()).toBe(false);
    expect(auth.currentUser()).toBeNull();
  });

  it('acknowledges a changed password when refreshing the session fails', () => {
    const result = vi.fn();
    auth.changePassword('Temporary123!', 'Personal123!').subscribe(result);
    http.expectOne('/api/authentication/change-password').flush(null);
    http
      .expectOne('/api/authentication/session')
      .flush(null, { status: 503, statusText: 'Unavailable' });
    expect(result).toHaveBeenCalledExactlyOnceWith(false);
    expect(auth.isAuthenticated()).toBe(false);
    http.expectNone('/api/authentication/change-password');
  });
});
