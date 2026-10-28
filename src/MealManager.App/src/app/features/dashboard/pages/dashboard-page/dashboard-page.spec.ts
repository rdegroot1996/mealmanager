import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardPage, timeOfDayGreeting } from './dashboard-page';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../../../../core/auth/auth.service';

describe('DashboardPage', () => {
  let component: DashboardPage;
  let fixture: ComponentFixture<DashboardPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DashboardPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(DashboardPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses a short heading with the greeting beneath it', () => {
    expect(fixture.nativeElement.querySelector('h1').textContent.trim()).toBe('Welcome home');
    expect(fixture.nativeElement.querySelector('h1 + p').textContent.trim()).toBe(
      component.greeting(),
    );
  });

  it('updates the greeting with the signed-in user’s full display name', async () => {
    const auth = TestBed.inject(AuthService);
    auth.currentUser.set({
      id: 'user-1',
      email: 'alex@example.test',
      displayName: 'Alex van Dijk',
      isAdmin: false,
      mustChangePassword: false,
    });
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('h1 + p').textContent.trim()).toBe(
      timeOfDayGreeting(new Date().getHours(), 'Alex van Dijk'),
    );

    auth.currentUser.set(null);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('h1 + p').textContent.trim()).toBe(
      timeOfDayGreeting(new Date().getHours()),
    );
  });

  it.each([
    [0, 'Good night 👋'],
    [3, 'Good night 👋'],
    [5, 'Good night 👋'],
    [6, 'Good morning 👋'],
    [11, 'Good morning 👋'],
    [12, 'Good afternoon 👋'],
    [17, 'Good afternoon 👋'],
    [18, 'Good evening 👋'],
    [23, 'Good evening 👋'],
  ])('greets at hour %s', (hour, greeting) => {
    expect(timeOfDayGreeting(hour as number)).toBe(greeting);
  });

  it.each([
    [0, 'Good night, Alex van Dijk 👋'],
    [6, 'Good morning, Alex van Dijk 👋'],
    [12, 'Good afternoon, Alex van Dijk 👋'],
    [18, 'Good evening, Alex van Dijk 👋'],
  ])('greets the user by name at hour %s', (hour, greeting) => {
    expect(timeOfDayGreeting(hour as number, ' Alex van Dijk ')).toBe(greeting);
  });

  it('keeps the generic greeting for a blank display name', () => {
    expect(timeOfDayGreeting(12, '   ')).toBe('Good afternoon 👋');
  });

  it('orders upcoming meals directly after active meal plan', () => {
    const children = fixture.nativeElement.querySelectorAll(
      'app-active-meal-plan, app-upcoming-meals, app-favorite-recipes',
    ) as NodeListOf<HTMLElement>;
    const widgets = Array.from(children).map((element) => element.tagName.toLowerCase());

    expect(widgets).toEqual(['app-active-meal-plan', 'app-upcoming-meals', 'app-favorite-recipes']);
  });
});
