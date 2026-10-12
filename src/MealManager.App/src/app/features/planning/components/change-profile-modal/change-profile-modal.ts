import { ApiRecipeProfile } from '../../../../api/models/api-recipe';
import { Component, inject, signal, viewChild } from '@angular/core';
import { Modal } from '../../../../shared/components/modal/modal';
import { PlanningStore } from '../../state/planning.store';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { RecipesStore } from '../../../recipes/state/recipes.store';
import { ApiPlanningEntry } from '../../../../api/models/api-planning';
import { FormsModule } from '@angular/forms';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';
import { ProfileSelect } from '../../../recipes/components/profile-select/profile-select';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';

@Component({
  selector: 'app-change-profile-modal',
  imports: [Modal, FormsModule, RecipeSummary, ProfileSelect, LoadingIndicator],
  templateUrl: './change-profile-modal.html',
})
export class ChangeProfileModal {
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
  recipesStore = inject(RecipesStore);

  meal = signal<ApiPlanningEntry | null>(null);
  profiles = signal<ApiRecipeProfile[]>([]);
  selectedProfileId = signal('');
  loading = signal(false);
  saving = signal(false);
  error = signal('');

  open(meal: ApiPlanningEntry) {
    if (this.cycleStore.currentCycle()?.nextPlanningCycleId) return;
    this.cycleId = this.cycleStore.currentCycle()?.id;
    const session = ++this.session;
    this.meal.set(meal);
    this.selectedProfileId.set(meal.recipeProfile.id);
    this.profiles.set([]);
    this.loading.set(true);
    this.saving.set(false);
    this.error.set('');
    this.recipesStore.loadRecipe(meal.recipe.id).subscribe({
      next: (recipe) => {
        if (session !== this.session) return;
        this.profiles.set(recipe.profiles);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        if (session !== this.session) return;
        this.loading.set(false);
        this.error.set(
          apiErrorMessage(
            error,
            $localize`:@@planning.changeProfileModal.theRecipeProfilesCouldNotBeLoaded:The recipe profiles could not be loaded.`,
          ),
        );
      },
    });
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
    const profileId = this.selectedProfileId();
    if (!meal || !cycleId || !profileId || profileId === meal.recipeProfile.id || this.saving())
      return;

    this.saving.set(true);
    this.error.set('');
    this.planningStore.changeProfile(meal.id, profileId).subscribe({
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
            $localize`:@@planning.changeProfileModal.theMealProfileCouldNotBeChanged:The meal profile could not be changed.`,
          ),
        );
      },
    });
  }
}
