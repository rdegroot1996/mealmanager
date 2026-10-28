import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { SetupPage } from './pages/setup-page/setup-page';
import { LoginPage } from './pages/login-page/login-page';
import { ChangePasswordPage } from './pages/change-password-page/change-password-page';

describe('account form validation', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  afterEach(() => {
    const http = TestBed.inject(HttpTestingController);
    http.match('/api/config').forEach((request) => request.flush({ appInitialized: true }));
    http.verify();
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('focuses the first invalid setup field and explains the full password policy without posting', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(SetupPage);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/config').flush({ appInitialized: false });
    const page = fixture.componentInstance;
    page.submit();
    fixture.detectChanges();
    vi.runAllTimers();
    expect(document.activeElement?.id).toBe('setup-display-name');
    expect(
      fixture.nativeElement.querySelector('#setup-display-name').getAttribute('aria-invalid'),
    ).toBe('true');
    page.displayName = 'Admin';
    page.email = 'a@example.test';
    page.password = 'abcdef';
    page.confirmPassword = 'abcdef';
    page.submit();
    fixture.detectChanges();
    vi.runAllTimers();
    expect(document.activeElement?.id).toBe('setup-password');
    expect(page.fieldError('password')).toContain('A–Z');
    page.password = 'Valid123!';
    page.confirmPassword = 'Valid123!';
    expect(page.fieldError('password')).toBeNull();
    expect(page.fieldError('confirm-password')).toBeNull();
    http.expectNone((request) => request.method === 'POST');
  });

  it('validates sign-in fields and removes messages as values are corrected', () => {
    const fixture = TestBed.createComponent(LoginPage);
    const page = fixture.componentInstance;
    page.submit();
    fixture.detectChanges();
    expect(page.fieldError('email')).toBeTruthy();
    expect(page.fieldError('password')).toBeTruthy();
    page.email = 'bad';
    expect(page.fieldError('email')).toBeTruthy();
    page.email = ' member@example.test ';
    page.password = 'anything';
    expect(page.fieldError('email')).toBeNull();
    expect(page.fieldError('password')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone((request) => request.method === 'POST');
  });

  it('blocks mismatched, weak, or unchanged replacement passwords', () => {
    const page = TestBed.runInInjectionContext(() => new ChangePasswordPage());
    page.currentPassword = 'Temporary123!';
    page.newPassword = 'Temporary123!';
    page.confirmPassword = 'Temporary123!';
    page.save();
    expect(page.fieldError('new')).toBe('Choose a different new password.');
    page.newPassword = 'weak';
    page.save();
    expect(page.fieldError('new')).toBeTruthy();
    page.newPassword = 'Personal123!';
    page.save();
    expect(page.fieldError('confirm')).toBeTruthy();
    TestBed.inject(HttpTestingController).expectNone((request) => request.method === 'POST');
  });

  it('explains the actual API passwordMismatch response and focuses the current password', () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(ChangePasswordPage);
    fixture.detectChanges();
    const page = fixture.componentInstance;
    page.currentPassword = 'Wrong123!';
    page.newPassword = 'Personal123!';
    page.confirmPassword = 'Personal123!';
    page.save();
    TestBed.inject(HttpTestingController)
      .expectOne('/api/authentication/change-password')
      .flush(
        { code: 'ValidationError', errors: { passwordMismatch: ['Incorrect password.'] } },
        { status: 400, statusText: 'Bad Request' },
      );
    fixture.detectChanges();
    vi.runAllTimers();
    expect(page.error()).toBe('The current password is incorrect.');
    expect(page.saving()).toBe(false);
    expect(document.activeElement?.id).toBe('current-password');
  });

  it('offers sign-out on a standalone required-replacement page and omits redundant back navigation', () => {
    const fixture = TestBed.createComponent(ChangePasswordPage);
    const page = fixture.componentInstance;
    page.auth.currentUser.set({
      id: 'member',
      email: 'member@example.test',
      displayName: 'Member',
      isAdmin: false,
      mustChangePassword: true,
    });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('app-auth-shell')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Sign out');
    expect(fixture.nativeElement.textContent).not.toContain('Back to Dashboard');
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    page.signOut();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/authentication/logout').flush(null);
    http.expectOne('/api/authentication/session').flush({ isAuthenticated: false });
    expect(page.auth.isAuthenticated()).toBe(false);
  });
});
