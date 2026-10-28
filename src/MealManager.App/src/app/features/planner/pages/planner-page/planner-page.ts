import { RecipeReturnContext } from '../../../../core/layout/recipe-return-context';
import { Component, computed, inject, OnInit, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { RecipePlanningContext } from '../../state/recipe-planning-context';
import { afterNextRender, Injector } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { AddMealModal } from '../../components/add-meal-modal/add-meal-modal';
import { CycleFormModal } from '../../../planning-cycle/components/cycle-form-modal/cycle-form-modal';
import { MealGroceryReviewModal } from '../../components/meal-grocery-review-modal/meal-grocery-review-modal';
import { PlanLeftoversModal } from '../../components/plan-leftovers-modal/plan-leftovers-modal';
import { ChangeProfileModal } from '../../components/change-profile-modal/change-profile-modal';
import { AddNoteModal } from '../../components/add-note-modal/add-note-modal';
import { PlanningCycleSwitcher } from '../../../planning-cycle/components/planning-cycle-switcher/planning-cycle-switcher';
import { PlanningDay, MealPlanStore } from '../../state/meal-plan.store';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { ApiPlanningCycle } from '../../../../api/models/api-planning-cycle';
import { ApiPlannedEntry, ApiPlanningDayNote } from '../../../../api/models/api-meal-plan';
import { catchError, finalize, map, of, switchMap, Subscription } from 'rxjs';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { ToastService } from '../../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { PlannedMealRow } from '../../components/planned-meal-row/planned-meal-row';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

import { Modal } from '../../../../shared/components/modal/modal';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { PlanningDaySelect } from '../../components/planning-day-select/planning-day-select';

@Component({
  selector: 'app-planner-page',
  imports: [
    Modal,
    RecipeSummary,
    PlanningDaySelect,
    AddMealModal,
    CycleFormModal,
    MealGroceryReviewModal,
    PlanLeftoversModal,
    ChangeProfileModal,
    AddNoteModal,
    PlanningCycleSwitcher,
    LoadingIndicator,
    ConfirmationModal,
    EmptyState,
    PlannedMealRow,
    AppIcon,
  ],
  templateUrl: './planner-page.html',
})
export class PlannerPage implements OnInit {
  readonly todayLabel = $localize`:@@planner.plannerPage.template.today:Today`;
  readonly title = $localize`:@@navigation.planner:Planner`;
  originalWeekday(meal: ApiPlannedEntry): string | null {
    if (meal.kind !== 'Leftover') return null;
    return (
      this.mealPlanStore
        .days()
        .find((day) => day.entries.some((entry) => entry.id === meal.originalMealId))
        ?.longWeekday ?? null
    );
  }
  dayLabel(day: PlanningDay): string {
    if (day.isToday)
      return $localize`:@@planner.todayDate:Today, ${day.longWeekday}:weekday: ${day.shortDate}:date:`;
    if (day.isPast)
      return $localize`:@@planner.pastDate:Past day, ${day.longWeekday}:weekday: ${day.shortDate}:date:`;
    return $localize`:@@planner.upcomingDate:Upcoming day, ${day.longWeekday}:weekday: ${day.shortDate}:date:`;
  }

  mealPlanStore = inject(MealPlanStore);
  cycleStore = inject(PlanningCycleStore);
  toast = inject(ToastService);
  addMealModal = viewChild<AddMealModal>('addMealModal');
  cycleFormModal = viewChild<CycleFormModal>('cycleFormModal');
  mealGroceryReviewModal = viewChild<MealGroceryReviewModal>('mealGroceryReviewModal');
  planLeftoversModal = viewChild<PlanLeftoversModal>('planLeftoversModal');
  changeProfileModal = viewChild<ChangeProfileModal>('changeProfileModal');
  addNoteModal = viewChild<AddNoteModal>('addNoteModal');
  confirmationModal = viewChild.required<ConfirmationModal>('confirmationModal');
  loading = signal(false);
  loadError = signal<string | null>(null);
  noCycle = signal(false);
  mutationPending = signal(false);
  moveAnnouncement = signal('');
  readonly moveDialogTitle = $localize`:@@planner.moveDialogTitle:Move meal`;
  moveDialog = viewChild.required<Modal>('moveDialog');
  movingMeal = signal<ApiPlannedEntry | null>(null);
  moveDate = signal('');
  private moveCycleId: string | undefined;
  moveDays = computed(() => {
    const meal = this.movingMeal();
    return meal
      ? this.mealPlanStore.days().filter((day) => this.canMoveToDate(day.date, meal))
      : [];
  });
  canConfirmMove() {
    return (
      !!this.movingMeal() &&
      !this.mutationPending() &&
      this.cycleStore.currentCycle()?.id === this.moveCycleId &&
      this.moveDays().some((day) => day.date === this.moveDate())
    );
  }

  openMoveMeal(meal: ApiPlannedEntry) {
    if (this.mutationPending()) return;
    this.moveCycleId = this.cycleStore.currentCycle()?.id;
    this.movingMeal.set(meal);
    this.moveDate.set(meal.date);
    this.moveDialog().open();
  }

  changeMoveDate(date: string) {
    this.moveDate.set(date);
  }

  confirmMoveMeal() {
    const meal = this.mealPlanStore
      .activeMealPlan()
      ?.entries.find((entry) => entry.id === this.movingMeal()?.id);
    if (!meal || !this.canConfirmMove()) return;
    this.moveDialog().close();
    this.moveMealTo(meal, this.moveDate());
  }

  private returnContext = inject(RecipeReturnContext);
  private loadRequest?: Subscription;
  ngOnDestroy() {
    this.loadRequest?.unsubscribe();
  }
  ngOnInit() {
    this.loadCurrentPlanning();
  }

  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private injector = inject(Injector);
  private creationContext = inject(RecipePlanningContext);
  private resumeDraft =
    this.route.snapshot.queryParamMap.get('resume') === 'recipe'
      ? this.creationContext.current()
      : null;
  private resumePicker() {
    const draft = this.resumeDraft;
    if (!draft) return;
    this.resumeDraft = null;
    afterNextRender(
      () => {
        if (!this.mealPlanStore.days().some((day) => day.date === draft.date)) {
          this.toast.error(
            $localize`:@@planner.creationDestinationUnavailable:The original planning day is no longer editable. Choose another day to plan this recipe.`,
          );
        } else this.addMealModal()?.open(draft.date, draft.search, draft.recipeId);
        this.creationContext.clear();
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { resume: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      },
      { injector: this.injector },
    );
  }
  loadCurrentPlanning() {
    this.loadRequest?.unsubscribe();
    this.loading.set(true);
    this.loadError.set(null);
    this.noCycle.set(false);
    this.loadRequest = (
      this.resumeDraft
        ? this.cycleStore.loadCycle(this.resumeDraft.cycleId)
        : this.route.snapshot.queryParamMap.get('cycle') === 'active'
          ? this.cycleStore.loadCurrentCycle()
          : this.cycleStore.loadSelectedCycle()
    )
      .pipe(
        switchMap((cycle) => this.mealPlanStore.loadMealPlan(cycle.id, cycle)),
        catchError((error: HttpErrorResponse) => {
          this.mealPlanStore.activeMealPlan.set(null);
          if (error.status === 404) this.noCycle.set(true);
          else
            this.loadError.set(
              $localize`:@@planner.plannerPage.thePlannerCouldNotBeLoadedPlease:The planner could not be loaded. Please try again.`,
            );
          return of(null);
        }),
        finalize(() => this.loading.set(false)),
      )
      .subscribe((result) => {
        if (result) {
          this.returnContext.restore('/planner');
          this.resumePicker();
        }
      });
  }

  onCycleChanged(cycleId: string) {
    if (this.route.snapshot.queryParamMap.has('cycle'))
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { cycle: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    this.loadRequest?.unsubscribe();
    const cycle = this.cycleStore.currentCycle();
    this.loading.set(true);
    this.loadError.set(null);
    this.loadRequest = this.mealPlanStore
      .loadMealPlan(cycleId, cycle ?? undefined)
      .pipe(
        catchError(() => {
          this.mealPlanStore.activeMealPlan.set(null);
          this.loadError.set(
            $localize`:@@planner.plannerPage.thePlannerCouldNotBeLoadedPlease:The planner could not be loaded. Please try again.`,
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
    if (this.mutationPending()) return;
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
      title: $localize`:@@planner.plannerPage.deletePlanningCycle:Delete planning cycle?`,
      message: $localize`:@@planner.plannerPage.deleteThisCycleAndAllOfIts:Delete this cycle and all of its meal plan and shopping list data? This cannot be undone.`,
      confirmLabel: $localize`:@@planner.deleteCycle:Delete cycle`,
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
            ? this.mealPlanStore.loadMealPlan(nextCycle.id, nextCycle).pipe(map(() => nextCycle))
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
          if (!nextCycle) this.mealPlanStore.activeMealPlan.set(null);
          this.toast.success(
            $localize`:@@planner.plannerPage.planningCycleDeleted:Planning cycle deleted.`,
          );
        },
        error: (error: unknown) =>
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@planner.plannerPage.thePlanningCycleCouldNotBeDeleted:The planning cycle could not be deleted.`,
            ),
          ),
      });
  }

  async removeMeal(meal: ApiPlannedEntry) {
    if (this.mutationPending()) return;
    const cycleId = this.cycleStore.currentCycle()?.id;
    if (meal.kind === 'Meal') {
      const confirmed = await this.confirmationModal().open({
        title: $localize`:@@planner.confirmRemoveMealTitle:Remove planned meal?`,
        message: $localize`:@@planner.confirmRemoveMeal:Remove "${meal.recipe.name}:recipeName:" and its shopping selection? Any leftovers linked to this meal will also be removed.`,
        confirmLabel: $localize`:@@planner.plannedMealRow.removeMeal:Remove meal`,
        destructive: true,
      });
      if (!confirmed || this.mutationPending() || this.cycleStore.currentCycle()?.id !== cycleId)
        return;
    }
    if (!this.mealPlanStore.activeMealPlan()?.entries.some((entry) => entry.id === meal.id)) return;
    this.mutationPending.set(true);
    this.mealPlanStore
      .removeMeal(meal.id)
      .pipe(finalize(() => this.mutationPending.set(false)))
      .subscribe({
        error: (error: unknown) =>
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@planner.plannerPage.theMealCouldNotBeRemoved:The meal could not be removed.`,
            ),
          ),
      });
  }

  planLeftovers(meal: ApiPlannedEntry) {
    if (this.mutationPending()) return;
    this.planLeftoversModal()!.open(meal);
  }

  changeProfile(meal: ApiPlannedEntry) {
    if (this.mutationPending()) return;
    this.changeProfileModal()!.open(meal);
  }

  addNote(date: string) {
    if (this.mutationPending()) return;
    this.addNoteModal()!.open(date);
  }

  editNote(note: ApiPlanningDayNote) {
    if (this.mutationPending()) return;
    this.addNoteModal()!.open(note.date, note);
  }

  deleteNote(noteId: string) {
    if (this.mutationPending()) return;
    this.mutationPending.set(true);
    this.mealPlanStore
      .deleteNote(noteId)
      .pipe(finalize(() => this.mutationPending.set(false)))
      .subscribe({
        error: (error: unknown) =>
          this.toast.error(
            apiErrorMessage(
              error,
              $localize`:@@planner.plannerPage.theNoteCouldNotBeRemoved:The note could not be removed.`,
            ),
          ),
      });
  }

  openGroceriesModal(meal: ApiPlannedEntry) {
    if (this.mutationPending()) return;
    if (meal.kind === 'Meal') this.mealGroceryReviewModal()!.open(meal);
  }

  private moveMealTo(meal: ApiPlannedEntry, targetDate: string) {
    if (this.mutationPending()) return;

    if (!this.canMoveToDate(targetDate, meal)) {
      const message =
        meal.kind === 'Leftover'
          ? $localize`:@@planner.plannerPage.leftoversMustRemainAfterTheirOriginalMeal:Leftovers must remain after their original meal.`
          : $localize`:@@planner.plannerPage.theMealMustRemainBeforeAllOf:The meal must remain before all of its planned leftovers.`;
      this.toast.error(message);
      this.moveAnnouncement.set(message);
      return;
    }

    const action = this.mealPlanStore.moveEntry(meal.id, targetDate);
    this.mutationPending.set(true);
    action.pipe(finalize(() => this.mutationPending.set(false))).subscribe({
      next: () => {
        const targetDay = this.mealPlanStore.days().find((day) => day.date === targetDate);
        this.moveAnnouncement.set(
          $localize`:@@planner.plannerPage.mealMoved:${meal.recipe.name}:recipeName: moved to ${targetDay?.longWeekday ?? targetDate}:day:.`,
        );
        setTimeout(() => this.focusMealActions(meal.id));
      },
      error: (error: unknown) => {
        const message = apiErrorMessage(
          error,
          meal.kind === 'Leftover'
            ? $localize`:@@planner.plannerPage.theLeftoversCouldNotBeMovedTo:The leftovers could not be moved to that day.`
            : $localize`:@@planner.plannerPage.theMealCouldNotBeMovedTo:The meal could not be moved to that day.`,
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

  canMoveToDate(targetDate: string, meal: ApiPlannedEntry) {
    const leftovers =
      this.mealPlanStore.activeMealPlan()?.entries.filter((item) => item.kind === 'Leftover') ?? [];
    if (meal.kind === 'Leftover') {
      const original = this.mealPlanStore
        .activeMealPlan()
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
