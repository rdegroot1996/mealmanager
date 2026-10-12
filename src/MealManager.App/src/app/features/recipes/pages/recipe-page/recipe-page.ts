import { ApiRecipeProfile, ApiRecipeIngredient } from '../../../../api/models/api-recipe';
import { Component, computed, inject, LOCALE_ID, OnInit, signal, viewChild } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipesStore } from '../../state/recipes.store';
import { PlanRecipeModal } from '../../components/plan-recipe-modal/plan-recipe-modal';
import { ProfileFormModal } from '../../components/profile-form-modal/profile-form-modal';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { ProfileSelect } from '../../components/profile-select/profile-select';
import { catchError, EMPTY, finalize, switchMap, tap, throwError, Subscription } from 'rxjs';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ToastService } from '../../../../shared/services/toast.service';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { ActionDialog } from '../../../../shared/components/action-dialog/action-dialog';
import { DateTime } from 'luxon';
import { recipeCategoryLabel } from '../../models/recipe-category';
import { displayIngredientUnit } from '../../models/ingredient-unit';

import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { RecipeFavoriteButton } from '../../components/recipe-favorite-button/recipe-favorite-button';

@Component({
  selector: 'app-recipe-page',
  imports: [
    PlanRecipeModal,
    ProfileFormModal,
    RouterLink,
    PageHeader,
    ProfileSelect,
    LoadingIndicator,
    EmptyState,
    ConfirmationModal,
    ActionDialog,
    AppIcon,
    RecipeFavoriteButton,
  ],
  templateUrl: './recipe-page.html',
})
export class RecipePage implements OnInit {
  readonly categoryLabel = recipeCategoryLabel;
  readonly displayUnit = displayIngredientUnit;
  private readonly locale = inject(LOCALE_ID);
  activatedRoute = inject(ActivatedRoute);
  recipeStore = inject(RecipesStore);
  router = inject(Router);
  toast = inject(ToastService);

  recipe = computed(() => this.recipeStore.activeRecipe());
  profile = signal<ApiRecipeProfile | null>(null);
  grocerySections = computed(() => {
    const products = this.profile()?.products ?? [];
    return [
      {
        name: $localize`:@@groceries.needed:Needed`,
        showHeading: products.some((item) => item.atHome),
        products: products.filter((item) => !item.atHome),
      },
      {
        name: $localize`:@@groceries.usuallyAtHome:Usually at home`,
        showHeading: true,
        products: products.filter((item) => item.atHome),
      },
    ].filter((section) => section.products.length > 0);
  });
  selectedProfileId = signal<string>('');
  loading = signal(false);
  notFound = signal(false);
  loadError = signal('');
  deleting = signal(false);
  scaledIngredients = computed(() => {
    const recipe = this.recipe();
    const profile = this.profile();
    if (!recipe || !profile) return [];

    const scale = profile.servings / recipe.baseServings;
    return recipe.ingredients.map((ingredient) => ({
      ...ingredient,
      quantity: ingredient.quantity * scale,
    }));
  });

  planRecipeModal = viewChild<PlanRecipeModal>('planRecipeModal');
  profileFormModal = viewChild<ProfileFormModal>('profileFormModal');
  confirmationModal = viewChild.required<ConfirmationModal>('confirmationModal');

  ngOnInit(): void {
    this.loadRecipe();
  }

  private recipeRequest?: Subscription;
  loadRecipe() {
    this.recipeRequest?.unsubscribe();
    this.profileRequest?.unsubscribe();
    const recipeId = this.activatedRoute.snapshot.paramMap.get('id');
    if (recipeId) {
      this.loading.set(true);
      this.notFound.set(false);
      this.loadError.set('');
      this.recipeStore.activeRecipe.set(null);
      this.profile.set(null);
      this.recipeRequest = this.recipeStore
        .loadRecipe(recipeId)
        .pipe(
          switchMap((recipe) => {
            const initialProfile = recipe.profiles[0];
            if (!initialProfile) {
              this.profile.set(null);
              this.selectedProfileId.set('');
              return EMPTY;
            }
            return this.recipeStore.loadProfile(initialProfile.id);
          }),
          catchError((error: HttpErrorResponse) => {
            if (error.status === 404) this.notFound.set(true);
            else
              this.loadError.set(
                $localize`:@@recipes.recipePage.theRecipeCouldNotBeLoadedPlease:The recipe could not be loaded. Please try again.`,
              );
            return throwError(() => error);
          }),
          finalize(() => this.loading.set(false)),
        )
        .subscribe({
          next: (profile) => {
            this.profile.set(profile);
            this.selectedProfileId.set(profile.id);
          },
          error: () => undefined,
        });
    }
  }

  openNewProfile() {
    this.profileFormModal()!.open(
      undefined,
      (profile) => this.saveProfile(profile),
      this.recipe()?.ingredients ?? [],
      this.recipe()?.baseServings,
    );
  }

  openEditProfile() {
    const prof = this.profile();
    if (!prof) return;
    this.profileFormModal()!.open(
      prof,
      (profile) => this.saveProfile(profile),
      this.recipe()?.ingredients ?? [],
      this.recipe()?.baseServings,
    );
  }

  private saveProfile(profile: ApiRecipeProfile) {
    const recipeId = this.recipe()?.id;
    const selectedProfileId = this.selectedProfileId();
    return this.recipeStore.saveProfile(profile).pipe(
      tap((saved) => {
        if (this.recipe()?.id !== recipeId || this.selectedProfileId() !== selectedProfileId)
          return;
        this.profile.set(saved);
        this.selectedProfileId.set(saved.id);
        this.toast.success(
          profile.id
            ? $localize`:@@recipes.recipePage.profileSaved:Profile saved.`
            : $localize`:@@recipes.recipePage.profileAdded:Profile added.`,
        );
      }),
    );
  }

  async deleteRecipe() {
    const recipe = this.recipe();
    if (!recipe || this.deleting()) return;
    const confirmed = await this.confirmationModal().open({
      title: $localize`:@@recipes.recipePage.removeRecipe:Remove recipe?`,
      message: $localize`:@@recipes.confirmRemoveRecipe:Remove "${recipe.name}:recipeName:"? This cannot be undone.`,
      confirmLabel: $localize`:@@recipes.removeRecipe:Remove recipe`,
      destructive: true,
    });
    if (!confirmed) return;
    this.deleting.set(true);
    this.recipeStore.deleteRecipe(recipe.id).subscribe({
      next: () => {
        this.deleting.set(false);
        void this.router.navigate(['/recipes']);
        this.toast.success($localize`:@@recipes.recipePage.recipeRemoved:Recipe removed.`);
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.toast.error(
          apiErrorMessage(
            error,
            $localize`:@@recipes.recipePage.thisRecipeCannotBeRemovedWhilePlanning:This recipe cannot be removed while planning history still refers to it.`,
          ),
        );
      },
    });
  }

  async deleteProfile() {
    const recipe = this.recipe();
    const profile = this.profile();
    if (!recipe || !profile || recipe.profiles.length <= 1 || this.deleting()) return;
    const confirmed = await this.confirmationModal().open({
      title: $localize`:@@recipes.recipePage.removeProfile:Remove profile?`,
      message: $localize`:@@recipes.confirmRemoveProfile:Remove the "${profile.name}:profileName:" profile? This cannot be undone.`,
      confirmLabel: $localize`:@@recipes.removeProfile:Remove profile`,
      destructive: true,
    });
    if (!confirmed) return;
    this.deleting.set(true);
    this.recipeStore.deleteProfile(profile.id).subscribe({
      next: () => {
        this.deleting.set(false);
        const nextProfile = this.recipe()?.profiles[0];
        if (nextProfile) this.selectProfile(nextProfile.id);
        this.toast.success($localize`:@@recipes.recipePage.profileRemoved:Profile removed.`);
      },
      error: (error: unknown) => {
        this.deleting.set(false);
        this.toast.error(
          apiErrorMessage(
            error,
            $localize`:@@recipes.recipePage.thisProfileCannotBeRemovedWhilePlanning:This profile cannot be removed while planning history still refers to it.`,
          ),
        );
      },
    });
  }

  private profileRequest?: Subscription;
  ngOnDestroy() {
    this.profileRequest?.unsubscribe();
    this.recipeRequest?.unsubscribe();
  }
  selectProfile(profileId: string) {
    this.profileRequest?.unsubscribe();
    if (!profileId || profileId === this.selectedProfileId()) return;
    this.profileRequest = this.recipeStore.loadProfile(profileId).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.selectedProfileId.set(profile.id);
      },
      error: () =>
        this.toast.error(
          $localize`:@@recipes.recipePage.theProfileCouldNotBeLoadedPlease:The profile could not be loaded. Please retry.`,
        ),
    });
  }

  formatQuantity(ingredient: ApiRecipeIngredient): string {
    return new Intl.NumberFormat(this.locale, { maximumFractionDigits: 3 }).format(
      ingredient.quantity,
    );
  }

  timesPlannedLabel(count: number): string {
    return count === 1
      ? $localize`:@@recipes.plannedOnce:1 time`
      : $localize`:@@recipes.plannedTimes:${count}:count: times`;
  }

  formatPlanningDate(date: string | null): string {
    return date
      ? DateTime.fromISO(date).setLocale(this.locale).toLocaleString(DateTime.DATE_MED)
      : $localize`:@@recipes.recipePage.never:Never`;
  }
}
