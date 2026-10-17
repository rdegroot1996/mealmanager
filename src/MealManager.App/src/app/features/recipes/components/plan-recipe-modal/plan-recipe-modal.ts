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
import { map, switchMap } from 'rxjs';
import { PlanningDaySelect } from '../../../planner/components/planning-day-select/planning-day-select';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { ToastService } from '../../../../shared/services/toast.service';

@Component({
  selector: 'app-plan-recipe-modal',
  imports: [Modal, FormsModule, PlanningDaySelect, LoadingIndicator],
  templateUrl: './plan-recipe-modal.html',
})
export class PlanRecipeModal {
  mealPlanStore = inject(MealPlanStore);
  cycleStore = inject(PlanningCycleStore);
  toast = inject(ToastService);
  private readonly injector = inject(Injector);

  modal = viewChild<Modal>('modal');

  recipe = input.required<Recipe>();
  profile = input.required<ApiRecipeProfile>();

  selectedDate = signal('');
  days = signal<PlanningDay[]>([]);
  private mealPlanId: string | null = null;
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
    this.days.set([]);
    this.selectedDate.set('');
    this.loading.set(true);
    this.saving.set(false);
    this.error.set('');
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
          const days = planningDays(cycle, mealPlan);
          this.days.set(days);
          this.selectedDate.set(
            days.find((day) => day.isToday)?.date ?? days.find((day) => !day.isPast)?.date ?? '',
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
    this.mealPlanStore
      .planMeal(this.mealPlanId, this.selectedDate(), this.recipe().id, this.profile().id)
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
