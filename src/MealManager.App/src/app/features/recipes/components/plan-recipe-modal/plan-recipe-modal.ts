import { ApiRecipeProfile } from '../../../../api/models/api-recipe';
import {
  afterNextRender,
  Component,
  inject,
  Injector,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Modal } from '../../../../shared/components/modal/modal';
import { Recipe } from '../../models/recipe';
import { MealPlanStore, PlanningDay, planningDays } from '../../../planner/state/meal-plan.store';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { FormsModule } from '@angular/forms';
import { EMPTY, map, switchMap } from 'rxjs';
import { PlanningDaySelect } from '../../../planner/components/planning-day-select/planning-day-select';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { ToastService } from '../../../../shared/services/toast.service';
import { HttpErrorResponse } from '@angular/common/http';
import { CycleFormModal } from '../../../planning-cycle/components/cycle-form-modal/cycle-form-modal';

@Component({
  selector: 'app-plan-recipe-modal',
  imports: [Modal, FormsModule, PlanningDaySelect, LoadingIndicator, CycleFormModal],
  templateUrl: './plan-recipe-modal.html',
})
export class PlanRecipeModal {
  mealPlanStore = inject(MealPlanStore);
  cycleStore = inject(PlanningCycleStore);
  toast = inject(ToastService);
  private readonly injector = inject(Injector);

  modal = viewChild<Modal>('modal');
  noCycle = signal(false);

  recipe = input.required<Recipe>();
  profile = input.required<ApiRecipeProfile>();

  selectedDate = signal('');
  days = signal<PlanningDay[]>([]);
  private mealPlanId: string | null = null;
  private cycleId: string | null = null;
  ngOnDestroy() {
    this.endSession();
  }
  private session = 0;
  endSession() {
    ++this.session;
  }
  loading = signal(false);
  saving = signal(false);
  error = signal('');

  open() {
    const session = ++this.session;
    this.mealPlanId = null;
    this.cycleId = null;
    this.days.set([]);
    this.selectedDate.set('');
    this.loading.set(true);
    this.saving.set(false);
    this.error.set('');
    this.noCycle.set(false);
    this.cycleStore
      .fetchActiveCycle()
      .pipe(
        switchMap((cycle) =>
          this.mealPlanStore.fetchMealPlan(cycle.id).pipe(map((mealPlan) => ({ cycle, mealPlan }))),
        ),
      )
      .subscribe({
        next: ({ cycle, mealPlan }) => {
          if (session !== this.session) return;
          this.mealPlanId = mealPlan.id;
          this.cycleId = cycle.id;
          const days = planningDays(cycle, mealPlan);
          this.days.set(days);
          this.selectedDate.set(
            days.find((day) => day.isToday)?.date ??
              days.find((day) => !day.isPast)?.date ??
              days[0]?.date ??
              '',
          );
          this.loading.set(false);
          afterNextRender(
            () => {
              if (session === this.session) this.modal()?.focusFirstControl();
            },
            { injector: this.injector },
          );
        },
        error: (error: unknown) => {
          if (session !== this.session) return;
          this.loading.set(false);
          if (error instanceof HttpErrorResponse && error.status === 404) {
            this.noCycle.set(true);
            return;
          }
          this.error.set(
            apiErrorMessage(
              error,
              $localize`:@@recipes.planRecipeModal.planningDaysCouldNotBeLoaded:Planning days could not be loaded.`,
            ),
          );
        },
      });
    this.modal()!.open();
  }

  planRecipe() {
    if (
      !this.mealPlanId ||
      !this.days().some((day) => day.date === this.selectedDate()) ||
      this.loading() ||
      this.saving()
    )
      return;
    const session = this.session;

    this.saving.set(true);
    this.error.set('');
    const mealPlanId = this.mealPlanId;
    const date = this.selectedDate();
    const recipeId = this.recipe().id;
    const profileId = this.profile().id;
    this.cycleStore
      .fetchActiveCycle()
      .pipe(
        switchMap((cycle) => {
          if (session !== this.session) return EMPTY;
          if (cycle.id !== this.cycleId) {
            this.saving.set(false);
            this.error.set(
              $localize`:@@recipes.activeCycleChanged:The active cycle changed. Reopen Add to planner and choose a day.`,
            );
            return EMPTY;
          }
          return this.mealPlanStore.planMeal(mealPlanId, date, recipeId, profileId);
        }),
      )
      .subscribe({
        next: () => {
          if (session !== this.session) return;
          this.saving.set(false);
          this.modal()?.close();
          this.toast.success(
            $localize`:@@recipes.planRecipeModal.mealAddedToPlanner:Meal added to planner.`,
          );
        },
        error: (error: unknown) => {
          if (session !== this.session) return;
          this.saving.set(false);
          this.error.set(
            apiErrorMessage(
              error,
              $localize`:@@recipes.planRecipeModal.theMealCouldNotBeAddedTo:The meal could not be added to the planner.`,
            ),
          );
        },
      });
  }
}
