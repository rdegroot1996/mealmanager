import { Component, computed, inject, LOCALE_ID, output, signal, viewChild } from '@angular/core';
import { Modal } from '../../../../shared/components/modal/modal';
import { NumberInput } from '../../../../shared/components/number-input/number-input';
import { FormField } from '../../../../shared/components/form-field/form-field';
import { FormsModule } from '@angular/forms';
import { PlanningCycleStore } from '../../state/planning-cycle.store';
import { ApiPlanningCycle } from '../../../../api/models/api-planning-cycle';
import { DateTime } from 'luxon';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { planningDateLabel } from '../../../../shared/utils/planning-date';
import { ToastService } from '../../../../shared/services/toast.service';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

@Component({
  selector: 'app-cycle-form-modal',
  imports: [Modal, FormsModule, FormField, AppIcon, NumberInput],
  templateUrl: './cycle-form-modal.html',
})
export class CycleFormModal {
  ngOnDestroy() {
    this.endSession();
  }
  private session = 0;
  endSession() {
    ++this.session;
  }
  cycleStore = inject(PlanningCycleStore);
  private locale = inject(LOCALE_ID);
  toast = inject(ToastService);
  modal = viewChild<Modal>('modal');
  readonly deleteLabel = $localize`:@@planning.deleteCycle:Delete cycle`;
  saved = output<ApiPlanningCycle>();
  removeRequested = output<string>();
  remove() {
    const cycle = this.editCycle();
    if (
      !cycle ||
      this.saving() ||
      this.cycleStore.currentCycle()?.id !== cycle.id ||
      this.cycleStore.currentCycle()?.nextPlanningCycleId
    )
      return;
    this.modal()?.close();
    this.removeRequested.emit(cycle.id);
  }

  editCycle = signal<ApiPlanningCycle | null>(null);
  startDate = signal(DateTime.now().toISODate()!);
  days = signal(7);
  saving = signal(false);
  error = signal('');

  isEdit = computed(() => !!this.editCycle());
  minimumNewStartDate = computed(() => {
    if (this.isEdit()) return null;
    const currentCycle = this.cycleStore.currentCycle();
    return currentCycle
      ? DateTime.fromISO(currentCycle.startDate).plus({ days: 1 }).toISODate()
      : null;
  });
  dateRange = computed(() => {
    const start = DateTime.fromISO(this.startDate());
    if (!Number.isInteger(this.days()) || this.days() < 1) {
      return planningDateLabel(start, this.locale);
    }
    const end = start.plus({ days: this.days() - 1 });
    return `${planningDateLabel(start, this.locale)} – ${planningDateLabel(end, this.locale)}`;
  });

  open(cycle?: ApiPlanningCycle) {
    ++this.session;
    this.saving.set(false);
    this.error.set('');
    if (cycle) {
      this.editCycle.set(cycle);
      this.startDate.set(cycle.startDate);
      const start = DateTime.fromISO(cycle.startDate);
      const end = DateTime.fromISO(cycle.endDate);
      this.days.set(end.diff(start, 'days').days + 1);
    } else {
      this.editCycle.set(null);
      const currentCycle = this.cycleStore.currentCycle();
      if (currentCycle) {
        const start = DateTime.fromISO(currentCycle.startDate);
        const end = DateTime.fromISO(currentCycle.endDate);
        this.startDate.set(end.plus({ days: 1 }).toISODate()!);
        this.days.set(end.diff(start, 'days').days + 1);
      } else {
        this.startDate.set(DateTime.now().toISODate()!);
        this.days.set(7);
      }
    }
    this.modal()!.open();
  }

  save() {
    const session = this.session;
    if (this.saving()) return;
    if (!DateTime.fromISO(this.startDate()).isValid) {
      this.error.set(
        $localize`:@@planning-cycle.cycleFormModal.chooseAValidStartDate:Choose a valid start date.`,
      );
      return;
    }
    if (!Number.isInteger(this.days()) || this.days() < 1) {
      this.error.set(
        $localize`:@@planning-cycle.cycleFormModal.planningDaysMustBeAPositiveWhole:Planning days must be a positive whole number.`,
      );
      return;
    }
    const minimumStartDate = this.minimumNewStartDate();
    if (!this.isEdit() && minimumStartDate && this.startDate() < minimumStartDate) {
      this.error.set(
        $localize`:@@planning-cycle.cycleFormModal.aNewCycleMustStartAfterThe:A new cycle must start after the current cycle’s start date.`,
      );
      return;
    }

    const endDate = DateTime.fromISO(this.startDate())
      .plus({ days: this.days() - 1 })
      .toISODate()!;
    const cycle = this.editCycle();
    this.saving.set(true);
    this.error.set('');
    const save = cycle
      ? this.cycleStore.updateCycle(cycle.id, this.startDate(), endDate)
      : this.cycleStore.addCycle(this.startDate(), endDate);
    save.subscribe({
      next: (saved) => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.saved.emit(saved);
        this.modal()?.close();
        this.toast.success(
          cycle
            ? $localize`:@@planning-cycle.cycleFormModal.planningCycleUpdated:Planning cycle updated.`
            : $localize`:@@planning-cycle.cycleFormModal.planningCycleAdded:Planning cycle added.`,
        );
      },
      error: (error: unknown) => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.error.set(
          apiErrorMessage(
            error,
            $localize`:@@planning-cycle.cycleFormModal.thePlanningCycleCouldNotBeSaved:The planning cycle could not be saved.`,
          ),
        );
      },
    });
  }
}
