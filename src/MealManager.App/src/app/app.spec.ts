import { TestBed } from '@angular/core/testing';
import { App } from './app';
import { provideRouter } from '@angular/router';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should render the authenticated application shell', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.auth.isAuthenticated.set(true);
    fixture.detectChanges();
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('MealManager');
    expect(compiled.querySelector('main h1')).not.toBeNull();
    expect(compiled.querySelector('header a[aria-label="MealManager"]')?.getAttribute('href')).toBe(
      '/',
    );
  });
});
