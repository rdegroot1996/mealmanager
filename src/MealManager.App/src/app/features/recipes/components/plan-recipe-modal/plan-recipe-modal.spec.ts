import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { PlanRecipeModal } from './plan-recipe-modal';
describe('PlanRecipeModal', () => {
  it('loads an active target without replacing historical browsing state, then adds to that target', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PlanRecipeModal),
      component = fixture.componentInstance,
      http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('recipe', { id: 'r', name: 'Pasta' });
    fixture.componentRef.setInput('profile', { id: 'p', name: 'Default' });
    fixture.detectChanges();
    component.cycleStore.currentCycle.set({
      id: 'history',
      startDate: '2026-08-01',
      endDate: '2026-08-07',
      previousPlanningCycleId: null,
      nextPlanningCycleId: 'active',
    });
    component.mealPlanStore.activeMealPlan.set({
      id: 'history-mealPlan',
      planningCycleId: 'history',
      entries: [],
      notes: [],
    });
    vi.spyOn(component.modal()!, 'open').mockImplementation(() => undefined);
    vi.spyOn(component.modal()!, 'close').mockImplementation(() => undefined);
    const success = vi.spyOn(component.toast, 'success');
    component.open();
    http.expectOne('/api/planning-cycles/current').flush({
      id: 'active',
      startDate: '2099-09-08',
      endDate: '2099-09-14',
      previousPlanningCycleId: 'history',
      nextPlanningCycleId: null,
    });
    http
      .expectOne('/api/meal-plans/cycle/active')
      .flush({ id: 'active-meal-plan', planningCycleId: 'active', entries: [], notes: [] });
    expect(component.cycleStore.currentCycle()?.id).toBe('history');
    expect(component.mealPlanStore.activeMealPlan()?.id).toBe('history-mealPlan');
    expect(component.days()[0].date).toBe('2099-09-08');
    expect(component.selectedDate()).toBe('2099-09-08');
    component.planRecipe();
    // Parent inputs may change while the active-cycle check is pending.
    fixture.componentRef.setInput('recipe', { id: 'other-recipe', name: 'Soup' });
    fixture.componentRef.setInput('profile', { id: 'other-profile', name: 'Family' });
    component.selectedDate.set('2099-09-09');
    http.expectOne('/api/planning-cycles/current').flush({ id: 'active' });
    const request = http.expectOne('/api/planned-meals');
    expect(request.request.body).toEqual({
      mealPlanId: 'active-meal-plan',
      date: '2099-09-08',
      recipeId: 'r',
      recipeProfileId: 'p',
    });
    request.flush({ id: 'new-meal' });
    expect(success).toHaveBeenCalledWith('Meal added to planner.');
    http.verify();
  });

  it('offers first-cycle creation without planning prematurely and resumes the chosen recipe', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PlanRecipeModal);
    const component = fixture.componentInstance;
    const http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('recipe', { id: 'recipe', name: 'Pasta' });
    fixture.componentRef.setInput('profile', { id: 'family', name: 'Family' });
    fixture.detectChanges();
    vi.spyOn(component.modal()!, 'open').mockImplementation(() => undefined);
    component.open();
    http
      .expectOne('/api/planning-cycles/current')
      .flush({}, { status: 404, statusText: 'Not found' });
    fixture.detectChanges();
    expect(component.noCycle()).toBe(true);
    expect(component.error()).toBeFalsy();
    expect(fixture.nativeElement.textContent).toContain('Start first cycle');
    http.expectNone('/api/planned-meals');
    component.open();
    http
      .expectOne('/api/planning-cycles/current')
      .flush({ id: 'new', startDate: '2099-01-01', endDate: '2099-01-07' });
    http
      .expectOne('/api/meal-plans/cycle/new')
      .flush({ id: 'new-plan', planningCycleId: 'new', entries: [], notes: [] });
    expect(component.noCycle()).toBe(false);
    component.planRecipe();
    http.expectOne('/api/planning-cycles/current').flush({ id: 'new' });
    const add = http.expectOne('/api/planned-meals');
    expect(add.request.body).toMatchObject({
      recipeId: 'recipe',
      recipeProfileId: 'family',
      mealPlanId: 'new-plan',
    });
    add.flush({ id: 'meal' });
    http.verify();
  });

  it('rechecks the active cycle before adding and leaves a stale dialog recoverable', () => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(PlanRecipeModal),
      component = fixture.componentInstance,
      http = TestBed.inject(HttpTestingController);
    fixture.componentRef.setInput('recipe', { id: 'recipe', name: 'Pasta' });
    fixture.componentRef.setInput('profile', { id: 'family', name: 'Family' });
    fixture.detectChanges();
    vi.spyOn(component.modal()!, 'open').mockImplementation(() => undefined);
    component.open();
    http
      .expectOne('/api/planning-cycles/current')
      .flush({ id: 'first', startDate: '2099-01-01', endDate: '2099-01-07' });
    http
      .expectOne('/api/meal-plans/cycle/first')
      .flush({ id: 'plan', planningCycleId: 'first', entries: [], notes: [] });
    component.planRecipe();
    http.expectOne('/api/planning-cycles/current').flush({ id: 'next' });
    http.expectNone('/api/planned-meals');
    expect(component.saving()).toBe(false);
    expect(component.error()).toContain('The active cycle changed.');
    http.verify();
  });
});
