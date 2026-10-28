import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../../core/auth/auth.service';
import { ConfigService } from '../../../../core/config/config.service';
import { SetupPage } from './setup-page';

describe('SetupPage', () => {
  let component: SetupPage;
  let fixture: ComponentFixture<SetupPage>;
  const router = { navigate: vi.fn() };
  const auth = { login: vi.fn(() => of(true)), isAuthenticated: vi.fn(() => false) };
  const config = {
    getConfig: vi.fn(() => of({ appInitialized: false })),
    initialize: vi.fn(() => of(void 0)),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    await TestBed.configureTestingModule({
      imports: [SetupPage],
      providers: [
        { provide: Router, useValue: router },
        { provide: AuthService, useValue: auth },
        { provide: ConfigService, useValue: config },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(SetupPage);
    component = fixture.componentInstance;
  });

  it('uses the clean MealManager brand heading while the subtitle explains setup', () => {
    fixture.detectChanges();

    const heading = fixture.nativeElement.querySelector('h1') as HTMLHeadingElement;
    expect(heading.textContent?.trim()).toBe('MealManager');
    expect(fixture.nativeElement.textContent).toContain(
      'Create the first local administrator account.',
    );
  });

  it('does not submit mismatched passwords', () => {
    component.password = 'Pass123!';
    component.confirmPassword = 'different-password';

    component.submit();

    expect(config.initialize).not.toHaveBeenCalled();
    expect(component.fieldError('confirm-password')).toBe('The passwords do not match.');
  });

  it('creates the administrator, signs in, and opens the dashboard', () => {
    component.email = 'admin@example.com';
    component.displayName = 'Admin';
    component.password = 'Pass123!';
    component.confirmPassword = 'Pass123!';

    component.submit();

    expect(config.initialize).toHaveBeenCalledWith({
      adminEmail: 'admin@example.com',
      adminPassword: 'Pass123!',
      adminDisplayName: 'Admin',
    });
    expect(auth.login).toHaveBeenCalledWith('admin@example.com', 'Pass123!');
    expect(router.navigate).toHaveBeenCalledWith(['/']);
  });
});
