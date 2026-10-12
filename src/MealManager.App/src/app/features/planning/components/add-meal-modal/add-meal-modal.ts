import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { afterNextRender, Component, inject, Injector, signal, viewChild } from '@angular/core';
import { Modal } from '../../../../shared/components/modal/modal';
import { RecipesStore } from '../../../recipes/state/recipes.store';
import { PlanningStore } from '../../state/planning.store';
import { ApiRecipeSummary } from '../../../../api/models/api-recipe-summary';
import { Recipe } from '../../../recipes/models/recipe';
import { recipeCategoryLabel } from '../../../recipes/models/recipe-category';
import { FormsModule } from '@angular/forms';
import { PlanningDaySelect } from '../planning-day-select/planning-day-select';
import { ProfileSelect } from '../../../recipes/components/profile-select/profile-select';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';

import { Subscription } from 'rxjs';
import { RecipeSummary } from '../../../../shared/components/recipe-summary/recipe-summary';

@Component({
  selector: 'app-add-meal-modal',
  imports: [
    Modal,
    FormsModule,
    PlanningDaySelect,
    ProfileSelect,
    SearchField,
    LoadingIndicator,
    RecipeSummary,
  ],
  templateUrl: './add-meal-modal.html',
})
export class AddMealModal {
  readonly categoryLabel = recipeCategoryLabel;
  cycleStore = inject(PlanningCycleStore);
  private cycleId: string | undefined;
  private session = 0;
  private readonly injector = inject(Injector);
  endSession() {
    ++this.session;
  }
  modal = viewChild<Modal>('modal');
  recipesStore = inject(RecipesStore);
  planningStore = inject(PlanningStore);

  private searchRequest?: Subscription;
  private recipeRequest?: Subscription;
  private searchSession = 0;
  ngOnDestroy() {
    this.endSession();
    ++this.searchSession;
    this.searchRequest?.unsubscribe();
    this.recipeRequest?.unsubscribe();
  }
  date = signal('');
  searchQuery = signal('');
  selectedRecipe = signal<Recipe | null>(null);
  selectedProfileId = signal('');
  saving = signal(false);
  searching = signal(false);
  searchError = signal('');
  error = signal('');

  days = this.planningStore.days;

  open(date: string) {
    if (this.cycleStore.currentCycle()?.nextPlanningCycleId) return;
    this.cycleId = this.cycleStore.currentCycle()?.id;
    ++this.session;
    this.recipeRequest?.unsubscribe();
    this.date.set(date);
    this.selectedRecipe.set(null);
    this.selectedProfileId.set('');
    this.searchQuery.set('');
    this.saving.set(false);
    this.searchError.set('');
    this.error.set('');
    this.search();
    this.modal()!.open();
  }

  search() {
    const searchSession = ++this.searchSession;
    this.searchRequest?.unsubscribe();
    this.searching.set(true);
    this.searchError.set('');
    this.searchRequest = this.recipesStore.loadSummaries({ search: this.searchQuery() }).subscribe({
      next: () => {
        if (searchSession !== this.searchSession) return;
        this.searching.set(false);
      },
      error: () => {
        if (searchSession !== this.searchSession) return;
        this.searching.set(false);
        this.searchError.set(
          $localize`:@@planning.addMealModal.recipesCouldNotBeLoadedPleaseRetry:Recipes could not be loaded. Please retry your search.`,
        );
      },
    });
  }

  selectRecipe(summary: ApiRecipeSummary) {
    const session = this.session;
    this.recipeRequest?.unsubscribe();
    this.error.set('');
    this.selectedRecipe.set(null);
    this.recipeRequest = this.recipesStore.loadRecipe(summary.id).subscribe({
      next: (recipe) => {
        if (session !== this.session) return;
        this.selectedRecipe.set(recipe);
        this.selectedProfileId.set(recipe.profiles[0]?.id ?? '');
        afterNextRender(
          () => {
            if (session === this.session) this.modal()?.focusFirstControl();
          },
          { injector: this.injector },
        );
      },
      error: () => {
        if (session !== this.session) return;
        this.error.set(
          $localize`:@@planning.addMealModal.theRecipeCouldNotBeLoadedPlease:The recipe could not be loaded. Please select it again.`,
        );
      },
    });
  }

  confirm() {
    if (
      this.cycleStore.currentCycle()?.nextPlanningCycleId ||
      this.cycleStore.currentCycle()?.id !== this.cycleId
    )
      return;
    const session = this.session;
    const recipe = this.selectedRecipe();
    const profileId = this.selectedProfileId();
    if (!recipe || !profileId || this.saving()) return;

    this.saving.set(true);
    this.error.set('');
    this.planningStore.addMeal(this.date(), recipe.id, profileId).subscribe({
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
            $localize`:@@planning.addMealModal.theMealCouldNotBeAddedPlease:The meal could not be added. Please try again.`,
          ),
        );
      },
    });
  }
}
