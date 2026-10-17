import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DashboardPage, timeOfDayGreeting } from './dashboard-page';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';

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
      component.greeting,
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

  it('orders upcoming meals directly after active meal plan', () => {
    const children = fixture.nativeElement.querySelectorAll(
      'app-active-meal-plan, app-upcoming-meals, app-favorite-recipes',
    ) as NodeListOf<HTMLElement>;
    const widgets = Array.from(children).map((element) => element.tagName.toLowerCase());

    expect(widgets).toEqual(['app-active-meal-plan', 'app-upcoming-meals', 'app-favorite-recipes']);
  });
});
