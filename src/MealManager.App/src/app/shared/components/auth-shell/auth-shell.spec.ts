import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthShell } from './auth-shell';

describe('AuthShell', () => {
  let fixture: ComponentFixture<AuthShell>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [AuthShell] }).compileComponents();
    fixture = TestBed.createComponent(AuthShell);
    fixture.componentRef.setInput('description', 'Sign in to manage your meals.');
    fixture.detectChanges();
  });

  it('shows the MealManager icon as decorative branding', () => {
    const icon = fixture.nativeElement.querySelector('app-icon[name="restaurant"]') as HTMLElement;

    expect(icon).not.toBeNull();
    expect(icon.getAttribute('aria-hidden')).toBe('true');
  });

  it('shows the title and description in the authentication shell', () => {
    expect(fixture.nativeElement.querySelector('h1').textContent).toContain('MealManager');
    expect(fixture.nativeElement.textContent).toContain('Sign in to manage your meals.');
  });
});
