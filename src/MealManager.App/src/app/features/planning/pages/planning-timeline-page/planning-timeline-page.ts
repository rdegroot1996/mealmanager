import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { AddMealModal } from '../../components/add-meal-modal/add-meal-modal';
import { CycleFormModal } from '../../../planning-cycle/components/cycle-form-modal/cycle-form-modal';
import { MealGroceriesFormModal } from '../../components/meal-groceries-form-modal/meal-groceries-form-modal';
import { PlanLeftoversModal } from '../../components/plan-leftovers-modal/plan-leftovers-modal';
import { ChangeProfileModal } from '../../components/change-profile-modal/change-profile-modal';
import { AddNoteModal } from '../../components/add-note-modal/add-note-modal';
import { PlanningCycleSwitcher } from '../../../planning-cycle/components/planning-cycle-switcher/planning-cycle-switcher';
import { PlanningDay, PlanningStore } from '../../state/planning.store';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { ApiPlanningCycle } from '../../../../api/models/api-planning-cycle';
import { ApiPlanningEntry, ApiPlanningNote } from '../../../../api/models/api-planning';
import { catchError, finalize, map, of, switchMap, Subscription } from 'rxjs';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { ToastService } from '../../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PlanningMealRow } from '../../components/planning-meal-row/planning-meal-row';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

import { Modal } from '../../../../shared/components/modal/modal';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { PlanningDaySelect } from '../../components/planning-day-select/planning-day-select';

@Component({
  selector: 'app-planning-timeline-page',
  imports: [
    Modal,
    RecipeSummary,
    PlanningDaySelect,
    AddMealModal,
    CycleFormModal,
    MealGroceriesFormModal,
    PlanLeftoversModal,
    ChangeProfileModal,
    AddNoteModal,
    PlanningCycleSwitcher,
    LoadingIndicator,
    ConfirmationModal,
    EmptyState,
    PlanningMealRow,
    AppIcon,
  ],
  templateUrl: './planning-timeline-page.html',
})
export class PlanningTimelinePage implements OnInit {
  readonly title = $localize`:@@navigation.planning:Planning`;
  originalWeekday(meal: ApiPlanningEntry): string | null {
    if (meal.kind !== 'Leftover') return null;
    return (
      this.planningStore
        .days()
        .find((day) => day.entries.some((entry) => entry.id === meal.originalMealId))
        ?.longWeekday ?? null
    );
  }
  dayLabel(day: PlanningDay): string {
    if (day.isToday)
      return $localize`:@@planning.todayDate:Today, ${day.longWeekday}:weekday: ${day.shortDate}:date:`;
    if (day.isPast)
      return $localize`:@@planning.pastDate:Past day, ${day.longWeekday}:weekday: ${day.shortDate}:date:`;
    return $localize`:@@planning.upcomingDate:Upcoming day, ${day.longWeekday}:weekday: ${day.shortDate}:date:`;
  }

  planningStore = inject(PlanningStore);
  cycleStore = inject(PlanningCycleStore);
  toast = inject(ToastService);
  addMealModal = viewChild<AddMealModal>('addMealModal');
  cycleFormModal = viewChild<CycleFormModal>('cycleFormModal');
  mealGroceriesFormModal = viewChild<MealGroceriesFormModal>('mealGroceriesFormModal');
  planLeftoversModal = viewChild<PlanLeftoversModal>('planLeftoversModal');
  changeProfileModal = viewChild<ChangeProfileModal>('changeProfileModal');
  addNoteModal = viewChild<AddNoteModal>('addNoteModal');
  confirmationModal = viewChild.required<ConfirmationModal>('confirmationModal');
  loading = signal(false);
  loadError = signal<string | null>(null);
  noCycle = signal(false);
  mutationPending = signal(false);
  moveAnnouncement = signal('');
  readonly moveDialogTitle = $localize`:@@planning.moveDialogTitle:Move meal`;
  moveDialog = viewChild.required<Modal>('moveDialog');
  movingMeal = signal<ApiPlanningEntry | null>(null);
  moveDate = signal('');
  private moveCycleId: string | undefined;
  moveDays = computed(() => {
    const meal = this.movingMeal();
    return meal
      ? this.planningStore.days().filter((day) => this.canMoveToDate(day.date, meal))
      : [];
  });
  canConfirmMove() {
    return (
      !!this.movingMeal() &&
      !this.isHistorical() &&
      !this.mutationPending() &&
      this.cycleStore.currentCycle()?.id === this.moveCycleId &&
      this.moveDays().some((day) => day.date === this.moveDate())
    );
  }

  openMoveMeal(meal: ApiPlanningEntry) {
    if (this.isHistorical() || this.mutationPending()) return;
    this.moveCycleId = this.cycleStore.currentCycle()?.id;
    this.movingMeal.set(meal);
    this.moveDate.set(meal.date);
    this.moveDialog().open();
  }

  changeMoveDate(date: string) {
    this.moveDate.set(date);
  }

  confirmMoveMeal() {
    const meal = this.planningStore
      .activePlanning()
      ?.entries.find((entry) => entry.id === this.movingMeal()?.id);
    if (!meal || !this.canConfirmMove()) return;
    this.moveDialog().close();
    this.moveMealTo(meal, this.moveDate());
  }

  private loadRequest?: Subscription;
  ngOnDestroy() {
    this.loadRequest?.unsubscribe();
  }
  ngOnInit() {
    this.loadCurrentPlanning();
  }

  loadCurrentPlanning() {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.noCycle.set(false);
    this.loadRequest = this.cycleStore
      .loadSelectedCycle()
      .pipe(
        switchMap((cycle) => this.planningStore.loadPlanning(cycle.id, cycle)),
        catchError((error: HttpErrorResponse) => {
          this.planningStore.activePlanning.set(null);
          if (error.status === 404) this.noCycle.set(true);
          else
            this.loadError.set(
              $localize`:@@planning.planningTimelinePage.thePlannerCouldNotBeLoadedPlease:The planner could not be loaded. Please try again.`,
            );
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  onCycleChanged(cycleId: string) {
    this.loadRequest?.unsubscribe();
    const cycle = this.cycleStore.currentCycle();
    this.loading.set(true);
    this.loadError.set(null);
    this.loadRequest = this.planningStore
      .loadPlanning(cycleId, cycle ?? undefined)
      .pipe(
        catchError(() => {
          this.planningStore.activePlanning.set(null);
          this.loadError.set(
            $localize`:@@planning.planningTimelinePage.thePlannerCouldNotBeLoadedPlease:The planner could not be loaded. Please try again.`,
          );
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe();
  }

  onCycleSaved(cycle: ApiPlanningCycle) {
    this.noCycle.set(false);
    this.loadError.set(null);
    this.onCycleChanged(cycle.id);
  }

  openAddMeal(date: string) {
    if (this.isHistorical() || this.mutationPending()) return;
    this.addMealModal()!.open(date);
  }

  openEditCycle() {
    const cycle = this.cycleStore.currentCycle();
    if (cycle && !this.isHistorical()) this.cycleFormModal()!.open(cycle);
  }

  openNewCycle() {
    if (!this.isHistorical()) this.cycleFormModal()!.open();
  }

  async deleteCycle() {
    const cycle = this.cycleStore.currentCycle();
    if (!cycle || this.isHistorical() || this.mutationPending()) return;
    const confirmed = await this.confirmationModal().open({
      title: $localize`:@@planning.planningTimelinePage.deletePlanningCycle:Delete planning cycle?`,
      message: $localize`:@@planning.planningTimelinePage.deleteThisCycleAndAllOfIts:Delete this cycle and all of its planning and Shopping list data? This cannot be undone.`,
      confirmLabel: $localize`:@@planning.deleteCycle:Delete cycle`,
      destructive: true,
    });
    if (!confirmed) return;

    this.mutationPending.set(true);
    this.loading.set(true);
    this.cycleStore
      .deleteCycle(cycle.id)
      .pipe(
        switchMap((nextCycle) =>
          nextCycle
            ? this.planningStore.loadPlanning(nextCycle.id, nextCycle).pipe(map(() => nextCycle))
            : of(null),
        ),
        finalize(() => {
          this.mutationPending.set(false);
          this.loading.set(false);
        }),
      )
      .subscribe({
        next: (nextCycle) => {
          this.noCycle.set(!nextCycle);
          this.loadError.set(null);
          if (!nextCycle) this.planningStore.activePlanning.set(null);
          this.toast.success(
            $localize`:@@planning.planningTimelinePage.planningCycleDeleted:Planning cycle deleted.`,
          );
        },
        error: (error: unknown) =>
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@planning.planningTimelinePage.thePlanningCycleCouldNotBeDeleted:The planning cycle could not be deleted.`,
            ),
          ),
      });
  }

  removeMeal(meal: ApiPlanningEntry) {
    if (this.isHistorical() || this.mutationPending()) return;
    this.mutationPending.set(true);
    this.planningStore
      .removeMeal(meal.id)
      .pipe(finalize(() => this.mutationPending.set(false)))
      .subscribe({
        error: (error: unknown) =>
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@planning.planningTimelinePage.theMealCouldNotBeRemoved:The meal could not be removed.`,
            ),
          ),
      });
  }

  planLeftovers(meal: ApiPlanningEntry) {
    if (this.isHistorical() || this.mutationPending()) return;
    this.planLeftoversModal()!.open(meal);
  }

  changeProfile(meal: ApiPlanningEntry) {
    if (this.isHistorical() || this.mutationPending()) return;
    this.changeProfileModal()!.open(meal);
  }

  addNote(date: string) {
    if (this.isHistorical() || this.mutationPending()) return;
    this.addNoteModal()!.open(date);
  }

  editNote(note: ApiPlanningNote) {
    if (this.isHistorical() || this.mutationPending()) return;
    this.addNoteModal()!.open(note.date, note);
  }

  deleteNote(noteId: string) {
    if (this.isHistorical() || this.mutationPending()) return;
    this.mutationPending.set(true);
    this.planningStore
      .deleteNote(noteId)
      .pipe(finalize(() => this.mutationPending.set(false)))
      .subscribe({
        error: (error: unknown) =>
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@planning.planningTimelinePage.theNoteCouldNotBeRemoved:The note could not be removed.`,
            ),
          ),
      });
  }

  openGroceriesModal(meal: ApiPlanningEntry) {
    if (this.isHistorical() || this.mutationPending()) return;
    if (meal.kind === 'Meal') this.mealGroceriesFormModal()!.open(meal);
  }

  private moveMealTo(meal: ApiPlanningEntry, targetDate: string) {
    if (this.isHistorical() || this.mutationPending()) return;

    if (!this.canMoveToDate(targetDate, meal)) {
      const message =
        meal.kind === 'Leftover'
          ? $localize`:@@planning.planningTimelinePage.leftoversMustRemainAfterTheirOriginalMeal:Leftovers must remain after their original meal.`
          : $localize`:@@planning.planningTimelinePage.theMealMustRemainBeforeAllOf:The meal must remain before all of its planned leftovers.`;
      this.toast.error(message);
      this.moveAnnouncement.set(message);
      return;
    }

    const action = this.planningStore.moveEntry(meal.id, targetDate);
    this.mutationPending.set(true);
    action.pipe(finalize(() => this.mutationPending.set(false))).subscribe({
      next: () => {
        const targetDay = this.planningStore.days().find((day) => day.date === targetDate);
        this.moveAnnouncement.set(
          $localize`:@@planning.planningTimelinePage.mealMoved:${meal.recipe.name}:recipeName: moved to ${targetDay?.longWeekday ?? targetDate}:day:.`,
        );
        setTimeout(() => this.focusMealActions(meal.id));
      },
      error: (error: unknown) => {
        const message = apiErrorMessage(
          error,
          meal.kind === 'Leftover'
            ? $localize`:@@planning.planningTimelinePage.theLeftoversCouldNotBeMovedTo:The leftovers could not be moved to that day.`
            : $localize`:@@planning.planningTimelinePage.theMealCouldNotBeMovedTo:The meal could not be moved to that day.`,
        );
        this.toast.error(message);
        this.moveAnnouncement.set(message);
      },
    });
  }

  private focusMealActions(mealId: string) {
    document
      .querySelector<HTMLElement>(`[data-planning-entry="${mealId}"] app-action-dialog > button`)
      ?.focus();
  }

  canMoveToDate(targetDate: string, meal: ApiPlanningEntry) {
    const leftovers =
      this.planningStore.activePlanning()?.entries.filter((item) => item.kind === 'Leftover') ?? [];
    if (meal.kind === 'Leftover') {
      const original = this.planningStore
        .activePlanning()
        ?.entries.find((item) => item.id === meal.originalMealId && item.kind === 'Meal');
      return !!original && targetDate > original.date;
    }

    const mealLeftovers = leftovers.filter((item) => item.originalMealId === meal.id);
    return mealLeftovers.every((leftover) => targetDate < leftover.date);
  }

  isHistorical() {
    return !!this.cycleStore.currentCycle()?.nextPlanningCycleId;
  }
}
