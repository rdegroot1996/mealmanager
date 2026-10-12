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
import { PlanningStore, PlanningDay, planningDays } from '../../../planning/state/planning.store';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { FormsModule } from '@angular/forms';
import { map, switchMap } from 'rxjs';
import { PlanningDaySelect } from '../../../planning/components/planning-day-select/planning-day-select';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { ToastService } from '../../../../shared/services/toast.service';

@Component({
  selector: 'app-plan-recipe-modal',
  imports: [Modal, FormsModule, PlanningDaySelect, LoadingIndicator],
  templateUrl: './plan-recipe-modal.html',
})
export class PlanRecipeModal {
  planningStore = inject(PlanningStore);
  cycleStore = inject(PlanningCycleStore);
  toast = inject(ToastService);
  private readonly injector = inject(Injector);

  modal = viewChild<Modal>('modal');

  recipe = input.required<Recipe>();
  profile = input.required<ApiRecipeProfile>();

  selectedDate = signal('');
  days = signal<PlanningDay[]>([]);
  private planningId: string | null = null;
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
    this.planningId = null;
    this.days.set([]);
    this.selectedDate.set('');
    this.loading.set(true);
    this.saving.set(false);
    this.error.set('');
    this.cycleStore
      .fetchActiveCycle()
      .pipe(
        switchMap((cycle) =>
          this.planningStore.fetchPlanning(cycle.id).pipe(map((planning) => ({ cycle, planning }))),
        ),
      )
      .subscribe({
        next: ({ cycle, planning }) => {
          if (session !== this.session) return;
          this.planningId = planning.id;
          const days = planningDays(cycle, planning);
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
      !this.planningId ||
      !this.days().some((day) => day.date === this.selectedDate()) ||
      this.loading() ||
      this.saving()
    )
      return;
    const session = this.session;

    this.saving.set(true);
    this.error.set('');
    this.planningStore
      .addRecipeToPlanning(
        this.planningId,
        this.selectedDate(),
        this.recipe().id,
        this.profile().id,
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
