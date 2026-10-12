import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { ConfigService } from '../../../../core/config/config.service';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let component: LoginPage;
  let fixture: ComponentFixture<LoginPage>;
  const router = { navigate: vi.fn() };
  const auth = { login: vi.fn(), isAuthenticated: vi.fn(() => false) };
  const config = { getConfig: vi.fn(() => of({ appInitialized: true })) };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: config },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginPage);
    component = fixture.componentInstance;
  });

  it('redirects to setup when the household is not initialized', () => {
    config.getConfig.mockReturnValue(of({ appInitialized: false }));
    component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/setup']);
  });

  it('shows a credential error and clears loading after a failed sign-in', () => {
    auth.login.mockReturnValue(throwError(() => ({ status: 401 })));
    component.email = 'user@example.com';
    component.password = 'wrong-password';

    component.submit();

    expect(auth.login).toHaveBeenCalledWith('user@example.com', 'wrong-password');
    expect(component.loading()).toBe(false);
    expect(component.error()).toBe('The email or password is incorrect.');
  });
});
