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
    const request = http.expectOne('/api/planned-meals');
    expect(request.request.body.mealPlanId).toBe('active-meal-plan');
    request.flush({ id: 'new-meal' });
    expect(success).toHaveBeenCalledWith('Meal added to planner.');
    http.verify();
  });
});
