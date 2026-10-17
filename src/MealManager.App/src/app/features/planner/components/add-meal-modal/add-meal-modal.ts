import { Router } from '@angular/router';
import { RecipePlanningContext } from '../../state/recipe-planning-context';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { afterNextRender, Component, inject, Injector, signal, viewChild } from '@angular/core';
import { Modal } from '../../../../shared/components/modal/modal';
import { RecipesStore } from '../../../recipes/state/recipes.store';
import { MealPlanStore } from '../../state/meal-plan.store';
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
  mealPlanStore = inject(MealPlanStore);

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

  days = this.mealPlanStore.days;

  private router = inject(Router);
  private creationContext = inject(RecipePlanningContext);
  open(date: string, search = '', recipeId?: string) {
    if (this.cycleStore.currentCycle()?.nextPlanningCycleId) return;
    this.cycleId = this.cycleStore.currentCycle()?.id;
    ++this.session;
    this.recipeRequest?.unsubscribe();
    this.date.set(date);
    this.selectedRecipe.set(null);
    this.selectedProfileId.set('');
    this.searchQuery.set(search);
    this.saving.set(false);
    this.searchError.set('');
    this.error.set('');
    this.search();
    this.modal()!.open();
    if (recipeId) this.selectRecipe({ id: recipeId });
  }

  changeSearch(query: string) {
    ++this.searchSession;
    this.searchRequest?.unsubscribe();
    this.searchQuery.set(query);
    this.searching.set(true);
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
          $localize`:@@planner.addMealModal.recipesCouldNotBeLoadedPleaseRetry:Recipes could not be loaded. Please retry your search.`,
        );
      },
    });
  }

  selectRecipe(summary: Pick<ApiRecipeSummary, 'id'> & Partial<ApiRecipeSummary>) {
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
          $localize`:@@planner.addMealModal.theRecipeCouldNotBeLoadedPlease:The recipe could not be loaded. Please select it again.`,
        );
      },
    });
  }

  createMissingRecipe() {
    const search = this.searchQuery().trim();
    if (!search || !this.cycleId || this.cycleStore.currentCycle()?.nextPlanningCycleId) return;
    this.creationContext.set({ cycleId: this.cycleId, date: this.date(), search });
    this.modal()?.close();
    void this.router.navigate(['/recipes/new'], { queryParams: { plan: '1' } });
  }
  createRecipeLabel() {
    return $localize`:@@planner.createMissingRecipe:Create “${this.searchQuery().trim()}:recipeName:”`;
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
    this.mealPlanStore.addMeal(this.date(), recipe.id, profileId).subscribe({
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
            $localize`:@@planner.addMealModal.theMealCouldNotBeAddedPlease:The meal could not be added. Please try again.`,
          ),
        );
      },
    });
  }
}
