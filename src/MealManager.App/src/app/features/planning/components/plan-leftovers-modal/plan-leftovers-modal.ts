import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { Modal } from '../../../../shared/components/modal/modal';
import { PlanningStore } from '../../state/planning.store';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { ApiPlanningEntry } from '../../../../api/models/api-planning';
import { FormsModule } from '@angular/forms';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { PlanningDaySelect } from '../planning-day-select/planning-day-select';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';

@Component({
  selector: 'app-plan-leftovers-modal',
  imports: [Modal, FormsModule, RecipeSummary, PlanningDaySelect],
  templateUrl: './plan-leftovers-modal.html',
})
export class PlanLeftoversModal {
  ngOnDestroy() {
    this.endSession();
  }
  private cycleId: string | undefined;
  private session = 0;
  endSession() {
    ++this.session;
  }
  modal = viewChild<Modal>('modal');
  planningStore = inject(PlanningStore);
  cycleStore = inject(PlanningCycleStore);

  meal = signal<ApiPlanningEntry | null>(null);
  selectedDate = signal('');
  saving = signal(false);
  error = signal('');
  days = computed(() => {
    const meal = this.meal();
    const leftovers =
      this.planningStore.activePlanning()?.entries.filter((item) => item.kind === 'Leftover') ?? [];
    if (!meal) return [];
    return this.planningStore
      .days()
      .filter(
        (day) =>
          day.date > meal.date &&
          !leftovers.some(
            (leftover) => leftover.originalMealId === meal.id && leftover.date === day.date,
          ),
      );
  });

  open(meal: ApiPlanningEntry) {
    if (this.cycleStore.currentCycle()?.nextPlanningCycleId) return;
    this.cycleId = this.cycleStore.currentCycle()?.id;
    ++this.session;
    this.meal.set(meal);
    const followingDay = this.days().find((day) => day.date > meal.date);
    this.selectedDate.set(followingDay?.date ?? '');
    this.error.set('');
    this.saving.set(false);
    this.modal()!.open();
  }

  confirm() {
    if (
      this.cycleStore.currentCycle()?.nextPlanningCycleId ||
      this.cycleStore.currentCycle()?.id !== this.cycleId
    )
      return;
    const session = this.session;
    const meal = this.meal();
    const cycleId = this.cycleStore.currentCycle()?.id;
    if (!meal || !cycleId || !this.selectedDate() || this.saving()) return;

    this.saving.set(true);
    this.error.set('');
    this.planningStore.planLeftovers(meal.id, this.selectedDate()).subscribe({
      next: () => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.modal()?.close();
      },
      error: (error: unknown) => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.error.set(
          apiErrorMessage(
            error,
            $localize`:@@planning.planLeftoversModal.couldNotPlanLeftoversPleaseTryAgain:Could not plan leftovers. Please try again.`,
          ),
        );
      },
    });
  }
}
