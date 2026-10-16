import { RecipePlanningContext } from '../../../planner/state/recipe-planning-context';
import { moveItemInArray } from '../../../../shared/utils/array-order';
import { recipeCategories, recipeCategoryLabel } from '../../models/recipe-category';
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  HostListener,
  inject,
  Injector,
  OnInit,
  signal,
  LOCALE_ID,
  viewChild,
} from '@angular/core';
import { Recipe } from '../../models/recipe';
import { ActivatedRoute, CanDeactivateFn, Router, RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { RecipesStore } from '../../state/recipes.store';
import { FormsModule } from '@angular/forms';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { UnitSelector } from '../../../../shared/components/unit-selector/unit-selector';
import { FormField } from '../../../../shared/components/form-field/form-field';
import { finalize, Subscription } from 'rxjs';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { ToastService } from '../../../../shared/services/toast.service';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { Location } from '@angular/common';
import { LanguageService } from '../../../../core/i18n/language.service';
import { formatDecimal, parseDecimal } from '../../../../core/i18n/decimal';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { NumberInput } from '../../../../shared/components/number-input/number-input';
import { ReorderActions } from '../../../../shared/components/reorder-actions/reorder-actions';

interface StoredRecipePhoto {
  id: string;
  url: string;
}

@Component({
  selector: 'app-edit-recipe-page',
  imports: [
    FormsModule,
    RouterLink,
    PageHeader,
    UnitSelector,
    FormField,
    LoadingIndicator,
    EmptyState,
    ConfirmationModal,
    AppIcon,
    NumberInput,
    ReorderActions,
  ],
  templateUrl: './edit-recipe-page.html',
})
export class EditRecipePage implements OnInit {
  readonly backToPlannerLabel = $localize`:@@recipes.backToPlanner:Back to planner`;
  readonly tagsLabel = $localize`:@@recipes.tags:Tags`;
  readonly categories = recipeCategories;
  readonly categoryLabel = recipeCategoryLabel;
  activatedRoute = inject(ActivatedRoute);
  recipeStore = inject(RecipesStore);
  router = inject(Router);
  location = inject(Location);
  toast = inject(ToastService);
  private injector = inject(Injector);
  private language = inject(LanguageService);
  private locale = inject(LOCALE_ID);
  private quantityDrafts = new Map<string, string>();
  private unregisterLanguageSwitch?: () => void;
  private languageSwitchApproved = false;

  private planningContext = inject(RecipePlanningContext);
  readonly planningDraft =
    this.activatedRoute.snapshot.queryParamMap.get('plan') === '1'
      ? this.planningContext.current()
      : null;
  continueLabel() {
    return !this.recipe()?.id || this.hasUnsavedChanges()
      ? $localize`:@@recipes.saveContinuePlanning:Save and continue planning`
      : $localize`:@@recipes.continuePlanning:Continue planning`;
  }
  continuePlanning() {
    if (this.saving() || this.imagesPending()) return;
    if (!this.recipe()?.id || this.hasUnsavedChanges()) this.saveRecipe(false, true);
    else this.returnToPlanning(this.recipe()!.id);
  }
  private returnToPlanning(recipeId?: string) {
    if (!this.planningDraft) return;
    this.planningContext.set({ ...this.planningDraft, recipeId });
    void this.router.navigate(['/planner'], { queryParams: { resume: 'recipe' } });
  }
  preparePlanningReturn() {
    if (this.planningDraft)
      this.planningContext.set({ ...this.planningDraft, recipeId: undefined });
  }
  recipe = signal<Recipe | null>(null);
  saveError = signal('');
  validationErrors = signal<string[]>([]);
  validationIssues = signal<{ id: string; message: string }[]>([]);
  private serverErrors = signal<{ id: string; message: string }[]>([]);
  fieldError(id: string): string | null {
    if (!this.validationAttempted() || !this.recipe()) return null;
    return (
      this.validateFields(this.recipe()!).find((issue) => issue.id === id)?.message ??
      this.serverErrors().find((issue) => issue.id === id)?.message ??
      null
    );
  }
  validationTargetLabel(id: string): string {
    if (id.startsWith('ingredient-')) {
      const index = Number(id.split('-').at(-1)) + 1;
      return $localize`:@@recipes.ingredientNumber:Ingredient ${index}:number:`;
    }
    if (id.startsWith('step-')) return this.stepName(Number(id.split('-').at(-1)) + 1);
    switch (id) {
      case 'recipe-name':
        return $localize`:@@recipes.editRecipePage.template.recipeName:Recipe name`;
      case 'recipe-base-servings':
        return $localize`:@@recipes.editRecipePage.template.baseServings:Base servings`;
      case 'recipe-category':
        return $localize`:@@recipes.editRecipePage.template.category:Category`;
      case 'recipe-notes':
        return $localize`:@@recipes.notes:Notes`;
      default:
        return this.tagsLabel;
    }
  }
  @HostListener('input', ['$event'])
  clearServerField(event: Event) {
    const id = (event.target as HTMLElement)?.id;
    this.serverErrors.update((errors) => errors.filter((error) => error.id !== id));
  }
  validationAttempted = signal(false);
  readonly ingredientLabel = $localize`:@@recipes.ingredient:ingredient`;
  reorderAnnouncement = signal('');
  imageError = signal('');
  imageUploading = signal(false);
  uploadProgress = signal<{ current: number; total: number } | null>(null);
  uploadStatus = computed(() => {
    const progress = this.uploadProgress();
    return progress
      ? $localize`:@@recipes.uploadingPhoto:Uploading photo ${progress.current}:current: of ${progress.total}:total:…`
      : '';
  });
  photoItems = signal<StoredRecipePhoto[]>([]);
  photoOrderDirty = signal(false);
  imageReordering = signal(false);
  deletingImageIds = signal<Set<string>>(new Set());
  saving = signal(false);
  loading = signal(false);
  notFound = signal(false);
  loadError = signal('');
  imageInput = viewChild<ElementRef<HTMLInputElement>>('imageInput');
  discardChangesModal = viewChild.required<ConfirmationModal>('discardChangesModal');
  private destroyed = false;
  creatingRecipe = this.activatedRoute.snapshot.queryParamMap.get('new') === '1';
  private recipeRequest?: Subscription;
  private tagsRequest?: Subscription;
  ngOnDestroy() {
    this.unregisterLanguageSwitch?.();
    this.destroyed = true;
    this.recipeRequest?.unsubscribe();
    this.tagsRequest?.unsubscribe();
  }
  private savedSnapshot = '';
  tagQuery = signal('');
  knownTags = signal<string[]>([]);
  tagSuggestions = computed(() => {
    const recipe = this.recipe();
    const query = this.tagQuery().trim().toLocaleLowerCase();
    const selected = new Set(recipe?.tags.map((tag) => tag.name.toLocaleLowerCase()) ?? []);
    return this.knownTags()
      .filter(
        (tag) =>
          !selected.has(tag.toLocaleLowerCase()) &&
          (!query || tag.toLocaleLowerCase().includes(query)),
      )
      .slice(0, query ? 50 : 8);
  });

  ngOnInit(): void {
    this.loadTagSuggestions();
    this.unregisterLanguageSwitch = this.language.registerBeforeSwitch(
      () => this.canDeactivate(),
      () => (this.languageSwitchApproved = true),
    );
    const recipeId = this.activatedRoute.snapshot.paramMap.get('id');
    if (recipeId) {
      this.loadRecipe(recipeId);
    } else {
      this.creatingRecipe = true;
      // New recipe
      const newRecipe = this.createNewRecipe();
      if (this.planningDraft) newRecipe.name = this.planningDraft.search;
      this.recipe.set(newRecipe);
      this.savedSnapshot = this.editableSnapshot(newRecipe);
    }
  }

  loadTagSuggestions() {
    this.tagsRequest?.unsubscribe();
    this.tagsRequest = this.recipeStore.loadTags(this.tagQuery()).subscribe({
      next: (recipes) => this.knownTags.set(recipes.map((tag) => tag.name)),
      error: () => this.knownTags.set([]),
    });
  }

  loadRecipe(recipeId = this.activatedRoute.snapshot.paramMap.get('id')) {
    if (!recipeId) return;
    this.recipeRequest?.unsubscribe();
    this.loading.set(true);
    this.notFound.set(false);
    this.loadError.set('');
    this.recipe.set(null);
    this.recipeRequest = this.recipeStore
      .loadRecipe(recipeId)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (recipe) => {
          const editable = structuredClone(recipe);
          this.recipe.set(editable);
          this.photoItems.set(editable.images.map(({ id, url }) => ({ id, url })));
          this.photoOrderDirty.set(false);
          this.savedSnapshot = this.editableSnapshot(editable);
          if (this.activatedRoute.snapshot.queryParamMap.has('photos')) {
            this.revealControl('recipe-photos');
            void this.router.navigate([], {
              relativeTo: this.activatedRoute,
              queryParams: { photos: null },
              queryParamsHandling: 'merge',
              replaceUrl: true,
            });
          }
        },
        error: (error: HttpErrorResponse) => {
          if (error.status === 404) this.notFound.set(true);
          else
            this.loadError.set(
              $localize`:@@recipes.recipePage.theRecipeCouldNotBeLoadedPlease:The recipe could not be loaded. Please try again.`,
            );
        },
      });
  }

  saveRecipe(addAnother = false, continuePlanning = false) {
    const recipe = this.recipe();
    if (!recipe || this.saving() || this.imagesPending()) return;
    this.saveError.set('');
    this.serverErrors.set([]);
    const issues = this.validateFields(recipe);
    this.validationIssues.set(issues);
    const validationErrors = issues.map((issue) => issue.message);
    this.validationAttempted.set(true);
    this.validationErrors.set(validationErrors);
    if (validationErrors.length > 0) {
      this.revealControl(this.firstInvalidControl(recipe));
      return;
    }

    recipe.name = recipe.name.trim();
    this.saving.set(true);

    const wasNew = !recipe.id;
    const submitted = structuredClone(recipe);
    const submittedSnapshot = this.editableSnapshot(submitted);
    this.recipeStore.saveRecipe(submitted).subscribe({
      next: (saved) => {
        if (this.destroyed) return;
        const editable = structuredClone(saved);
        const current = this.recipe();
        this.savedSnapshot = this.editableSnapshot(editable);
        if (wasNew) this.location.replaceState(`/recipes/${saved.id}/edit`);
        if (current && this.editableSnapshot(current) !== submittedSnapshot) {
          this.recipe.set({ ...current, id: saved.id, images: editable.images });
          this.savePhotoOrder(saved.id, () => {
            this.saving.set(false);
            this.toast.success(
              $localize`:@@recipes.editRecipePage.recipeSavedYourNewerEditsAreStill:Recipe saved. Your newer edits are still unsaved.`,
            );
          });
          return;
        }
        this.recipe.set(editable);
        this.savePhotoOrder(saved.id, () => {
          this.saving.set(false);
          if (this.planningDraft) {
            this.planningContext.set({ ...this.planningDraft, recipeId: saved.id });
            if (continuePlanning) this.returnToPlanning(saved.id);
            else {
              this.toast.success(
                wasNew
                  ? $localize`:@@recipes.editRecipePage.recipeSavedYouCanNowAddPhotos:Recipe saved. You can now add photos.`
                  : $localize`:@@recipes.editRecipePage.recipeSaved:Recipe saved.`,
              );
              if (wasNew)
                void this.router.navigate(['/recipes', saved.id, 'edit'], {
                  replaceUrl: true,
                  queryParams: { plan: '1', photos: '1' },
                });
            }
          } else if (addAnother) {
            this.toast.success(
              $localize`:@@recipes.editRecipePage.recipeSavedReadyForAnother:Recipe saved. Ready for another.`,
            );
            if (this.creatingRecipe && !this.activatedRoute.snapshot.paramMap.get('id')) {
              this.location.replaceState('/recipes/new');
              this.resetForAnotherRecipe();
            } else this.router.navigate(['/recipes/new']);
          } else if (wasNew) {
            this.toast.success(
              $localize`:@@recipes.editRecipePage.recipeSavedYouCanNowAddPhotos:Recipe saved. You can now add photos.`,
            );
            this.router.navigate(['/recipes', saved.id, 'edit'], {
              replaceUrl: true,
              queryParams: { photos: '1', new: '1' },
            });
          } else {
            this.toast.success($localize`:@@recipes.editRecipePage.recipeSaved:Recipe saved.`);
            this.router.navigate(['/recipes', saved.id]);
          }
        });
      },
      error: (response: unknown) => {
        this.saving.set(false);
        this.saveError.set(
          apiErrorMessage(
            response,
            $localize`:@@recipes.editRecipePage.theRecipeCouldNotBeSaved:The recipe could not be saved.`,
          ),
        );
        if (
          response instanceof HttpErrorResponse &&
          response.error?.errors &&
          typeof response.error.errors === 'object'
        ) {
          const mapped: { id: string; message: string }[] = [];
          for (const key of Object.keys(response.error.errors)) {
            const path = key.toLowerCase().replace(/^\$\./, '');
            const basic: Record<string, string> = {
              name: 'recipe-name',
              category: 'recipe-category',
              baseservings: 'recipe-base-servings',
              notes: 'recipe-notes',
              tags: 'recipe-tags',
            };
            let id = basic[path];
            if (/^tags(?:\[\d+\])?$/.test(path)) id = 'recipe-tags';
            const ingredient = /^ingredients\[(\d+)\]\.(name|quantity|unit)$/.exec(path);
            const step = /^steps\[(\d+)\]\.description$/.exec(path);
            if (ingredient) {
              const rowId = submitted.ingredients[Number(ingredient[1])]?.id;
              const index = this.recipe()?.ingredients.findIndex((row) => row.id === rowId) ?? -1;
              if (index >= 0) id = `ingredient-${ingredient[2]}-${index}`;
            }
            if (step) {
              const rowId = submitted.steps[Number(step[1])]?.id;
              const index = this.recipe()?.steps.findIndex((row) => row.id === rowId) ?? -1;
              if (index >= 0) id = `step-description-${index}`;
            }
            if (id)
              mapped.push({
                id,
                message: $localize`:@@recipes.checkField:Check this field and try again.`,
              });
          }
          this.serverErrors.set(mapped);
          this.validationIssues.set(mapped);
          this.validationErrors.set(mapped.map((issue) => issue.message));
          this.revealControl(mapped[0]?.id ?? 'recipe-save-error');
        } else this.revealControl('recipe-save-error');
      },
    });
  }

  hasUnsavedChanges() {
    const recipe = this.recipe();
    return (
      this.imageUploading() ||
      this.photoOrderDirty() ||
      (!!recipe && this.editableSnapshot(recipe) !== this.savedSnapshot)
    );
  }

  canDeactivate() {
    if (!this.hasUnsavedChanges()) return true;
    if (this.imageUploading()) {
      return this.discardChangesModal().open({
        title: $localize`:@@recipes.editRecipePage.leaveWhilePhotosUpload:Leave while photos upload?`,
        message: $localize`:@@recipes.editRecipePage.theCurrentUploadMayFinishButRemaining:The current upload may finish, but remaining photos will not be uploaded.`,
        cancelLabel: $localize`:@@recipes.keepEditing:Keep editing`,
        confirmLabel: $localize`:@@recipes.leaveEditor:Leave editor`,
        destructive: true,
      });
    }
    return this.discardChangesModal().open({
      title: $localize`:@@recipes.editRecipePage.discardUnsavedChanges:Discard unsaved changes?`,
      message: $localize`:@@recipes.editRecipePage.yourRecipeChangesHaveNotBeenSaved:Your recipe changes have not been saved. If you leave now, they will be lost.`,
      cancelLabel: $localize`:@@recipes.keepEditing:Keep editing`,
      confirmLabel: $localize`:@@recipes.discardChanges:Discard changes`,
      destructive: true,
    });
  }

  @HostListener('window:beforeunload', ['$event'])
  protectUnsavedChanges(event: BeforeUnloadEvent) {
    if (this.languageSwitchApproved || !this.hasUnsavedChanges()) return;
    event.preventDefault();
  }

  removeIngredient(index: number) {
    const recipe = this.recipe();
    if (!recipe) return;
    recipe.ingredients.splice(index, 1);
    this.renumberIngredients(recipe.ingredients);
    this.recipe.set({ ...recipe });
  }

  addIngredient() {
    const recipe = this.recipe();
    if (!recipe) return;
    const index = recipe.ingredients.length;
    recipe.ingredients.push({
      id: crypto.randomUUID(),
      name: '',
      quantity: 1,
      unit: 'pcs',
      order: recipe.ingredients.length,
    });
    this.recipe.set({ ...recipe });
    this.focusAfterRender(`ingredient-name-${index}`);
  }

  quantityDraft(ingredient: Recipe['ingredients'][number]): string {
    if (!this.quantityDrafts.has(ingredient.id)) {
      this.quantityDrafts.set(ingredient.id, formatDecimal(ingredient.quantity, this.locale));
    }
    return this.quantityDrafts.get(ingredient.id)!;
  }

  updateQuantity(ingredient: Recipe['ingredients'][number], value: string) {
    this.quantityDrafts.set(ingredient.id, value);
    ingredient.quantity = parseDecimal(value, this.locale);
  }

  isFiniteQuantity(value: number): boolean {
    return Number.isFinite(value) && value > 0;
  }

  removeIngredientLabel(name: string): string {
    const ingredient = name || $localize`:@@recipes.ingredient:ingredient`;
    return $localize`:@@recipes.removeIngredient:Remove ${ingredient}:ingredient:`;
  }

  removeTagLabel(name: string): string {
    return $localize`:@@recipes.removeTag:Remove tag ${name}:tagName:`;
  }

  photoAlt(name: string, number: number): string {
    return $localize`:@@recipes.photoAlt:${name}:recipeName: photo ${number}:photoNumber:`;
  }

  movePhotoLabel(number: number, direction: -1 | 1): string {
    return direction < 0
      ? $localize`:@@recipes.movePhotoEarlier:Move photo ${number}:photoNumber: earlier`
      : $localize`:@@recipes.movePhotoLater:Move photo ${number}:photoNumber: later`;
  }

  removePhotoLabel(number: number): string {
    return $localize`:@@recipes.removePhoto:Remove photo ${number}:photoNumber:`;
  }

  stepName(number: number) {
    return $localize`:@@recipes.stepName:step ${number}:stepNumber:`;
  }

  removeStepLabel(number: number): string {
    return $localize`:@@recipes.removeStep:Remove step ${number}:stepNumber:`;
  }

  moveIngredient(previousIndex: number, currentIndex: number, restoreFocus = false) {
    const recipe = this.recipe();
    if (
      !recipe ||
      previousIndex === currentIndex ||
      previousIndex < 0 ||
      previousIndex >= recipe.ingredients.length ||
      currentIndex < 0 ||
      currentIndex >= recipe.ingredients.length
    ) {
      return;
    }

    const ingredientId = recipe.ingredients[previousIndex].id;
    moveItemInArray(recipe.ingredients, previousIndex, currentIndex);
    this.renumberIngredients(recipe.ingredients);
    this.recipe.set({ ...recipe });
    this.reorderAnnouncement.set(
      $localize`:@@common.itemMoved:${recipe.ingredients[currentIndex].name}:itemName: moved to position ${currentIndex + 1}:position:.`,
    );
    if (restoreFocus) this.focusAfterRender(`ingredient-handle-${ingredientId}`, true);
  }

  removeStep(index: number) {
    const recipe = this.recipe();
    if (!recipe) return;
    recipe.steps.splice(index, 1);
    this.renumberSteps(recipe.steps);
    this.recipe.set({ ...recipe });
  }

  addStep() {
    const recipe = this.recipe();
    if (!recipe) return;
    const index = recipe.steps.length;
    recipe.steps.push({
      id: crypto.randomUUID(),
      description: '',
      order: recipe.steps.length,
    });
    this.renumberSteps(recipe.steps);
    this.recipe.set({ ...recipe });
    this.focusAfterRender(`step-description-${index}`);
  }

  moveStep(previousIndex: number, currentIndex: number, restoreFocus = false) {
    const recipe = this.recipe();
    if (
      !recipe ||
      previousIndex === currentIndex ||
      previousIndex < 0 ||
      previousIndex >= recipe.steps.length ||
      currentIndex < 0 ||
      currentIndex >= recipe.steps.length
    )
      return;
    const stepId = recipe.steps[previousIndex].id;
    moveItemInArray(recipe.steps, previousIndex, currentIndex);
    this.renumberSteps(recipe.steps);
    this.recipe.set({ ...recipe });
    this.reorderAnnouncement.set(
      $localize`:@@common.itemMoved:${this.stepName(previousIndex + 1)}:itemName: moved to position ${currentIndex + 1}:position:.`,
    );
    if (restoreFocus) this.focusAfterRender(`step-handle-${stepId}`, true);
  }

  triggerImageSelection() {
    this.imageInput()?.nativeElement.click();
  }

  imagesPending() {
    return this.imageUploading() || this.imageReordering() || this.deletingImageIds().size > 0;
  }

  uploadImage(event: Event) {
    const input = event.target as HTMLInputElement;
    const images = Array.from(input.files ?? []);
    const recipe = this.recipe();
    input.value = '';
    if (images.length === 0 || !recipe?.id || this.imagesPending() || this.saving()) return;

    this.imageError.set('');
    this.imageUploading.set(true);
    this.uploadNextImage(recipe.id, images, 0);
  }

  private uploadNextImage(recipeId: string, images: File[], index: number) {
    if (index === images.length) {
      this.imageUploading.set(false);
      this.uploadProgress.set(null);
      this.toast.success(
        images.length === 1
          ? $localize`:@@recipes.editRecipePage.photoUploaded:Photo uploaded.`
          : $localize`:@@recipes.editRecipePage.photosUploaded:Photos uploaded.`,
      );
      return;
    }

    const file = images[index];
    this.uploadProgress.set({ current: index + 1, total: images.length });
    this.recipeStore.uploadImage(recipeId, file).subscribe({
      next: (uploaded) => {
        if (this.destroyed) return;
        this.photoItems.update((photos) => [...photos, { id: uploaded.id, url: uploaded.url }]);
        this.syncStoredPhotos(recipeId);
        this.uploadNextImage(recipeId, images, index + 1);
      },
      error: (response: unknown) => {
        if (this.destroyed) return;
        const message = apiErrorMessage(
          response,
          $localize`:@@recipes.editRecipePage.thePhotoCouldNotBeUploaded:The photo could not be uploaded.`,
        );
        this.imageUploading.set(false);
        this.uploadProgress.set(null);
        this.imageError.set(
          $localize`:@@recipes.photoUploadError:${file.name}:fileName:: ${message}:error: Select the photo again to retry.`,
        );
        this.toast.error(
          $localize`:@@recipes.photoUploadRetry:Photo upload failed. Select ${file.name}:fileName: again to retry.`,
        );
      },
    });
  }

  moveImage(previousIndex: number, currentIndex: number) {
    if (
      previousIndex === currentIndex ||
      previousIndex < 0 ||
      currentIndex < 0 ||
      previousIndex >= this.photoItems().length ||
      currentIndex >= this.photoItems().length
    )
      return;
    if (this.imagesPending() || this.saving()) return;

    this.photoItems.update((photos) => {
      const reordered = [...photos];
      moveItemInArray(reordered, previousIndex, currentIndex);
      return reordered;
    });
    this.photoOrderDirty.set(true);
  }

  deleteImage(imageId: string) {
    const recipe = this.recipe();
    if (!recipe?.id || this.imagesPending() || this.saving()) return;

    this.imageError.set('');
    this.setImageDeleting(imageId, true);
    this.recipeStore.deleteImage(recipe.id, imageId).subscribe({
      next: () => {
        this.setImageDeleting(imageId, false);
        this.photoItems.update((photos) => photos.filter(({ id }) => id !== imageId));
        this.syncStoredPhotos(recipe.id);
        this.toast.success(
          $localize`:@@recipes.editRecipePage.recipeImageRemoved:Recipe image removed.`,
        );
      },
      error: (response: unknown) => {
        this.setImageDeleting(imageId, false);
        const message = apiErrorMessage(
          response,
          $localize`:@@recipes.editRecipePage.theImageCouldNotBeRemoved:The image could not be removed.`,
        );
        this.imageError.set(message);
        this.toast.error(message);
      },
    });
  }

  addTag(name = this.tagQuery()) {
    const recipe = this.recipe();
    const normalized = name.trim();
    if (!recipe || !normalized) return;
    if (
      !recipe.tags.some((tag) => tag.name.toLocaleLowerCase() === normalized.toLocaleLowerCase())
    ) {
      recipe.tags.push({ id: crypto.randomUUID(), name: normalized });
      this.recipe.set({ ...recipe });
    }
    this.tagQuery.set('');
    this.loadTagSuggestions();
  }

  removeTag(name: string) {
    const recipe = this.recipe();
    if (!recipe) return;
    recipe.tags = recipe.tags.filter((tag) => tag.name !== name);
    this.recipe.set({ ...recipe });
  }

  private setImageDeleting(imageId: string, deleting: boolean) {
    this.deletingImageIds.update((ids) => {
      const updated = new Set(ids);
      if (deleting) updated.add(imageId);
      else updated.delete(imageId);
      return updated;
    });
  }

  private savePhotoOrder(recipeId: string, complete: () => void) {
    const storedPhotos = this.photoItems();
    this.syncStoredPhotos(recipeId);
    if (!this.photoOrderDirty() || storedPhotos.length < 2) {
      this.photoOrderDirty.set(false);
      complete();
      return;
    }

    this.imageError.set('');
    this.imageReordering.set(true);
    this.recipeStore
      .reorderImages(
        recipeId,
        storedPhotos.map(({ id }) => id),
      )
      .subscribe({
        next: (images) => {
          const byId = new Map(images.map((image) => [image.id, image]));
          this.photoItems.update((photos) =>
            photos.map((photo) => ({
              id: photo.id,
              url: byId.get(photo.id)?.url ?? photo.url,
            })),
          );
          this.imageReordering.set(false);
          this.photoOrderDirty.set(false);
          this.syncStoredPhotos(recipeId);
          complete();
        },
        error: (response: unknown) => {
          const message = apiErrorMessage(
            response,
            $localize`:@@recipes.editRecipePage.theImageOrderCouldNotBeSaved:The image order could not be saved.`,
          );
          this.imageReordering.set(false);
          this.saving.set(false);
          this.imageError.set(message);
          this.toast.error(message);
        },
      });
  }

  private syncStoredPhotos(recipeId: string) {
    const images = this.photoItems().map(({ id, url }, order) => ({ id, url, order }));
    this.recipe.update((current) => (current?.id === recipeId ? { ...current, images } : current));
  }

  private createNewRecipe(): Recipe {
    return {
      id: '',
      name: '',
      images: [],
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      ingredients: [],
      steps: [],
      profiles: [],
    };
  }

  private resetForAnotherRecipe() {
    this.photoItems.set([]);
    this.photoOrderDirty.set(false);
    const recipe = this.createNewRecipe();
    this.recipe.set(recipe);
    this.savedSnapshot = this.editableSnapshot(recipe);
    this.saveError.set('');
    this.validationErrors.set([]);
    this.validationAttempted.set(false);
    this.imageError.set('');
    this.tagQuery.set('');
    this.loadTagSuggestions();
    this.focusAfterRender('recipe-name');
  }

  private focusAfterRender(controlId: string, nestedButton = false) {
    afterNextRender(
      () => {
        const element = document.getElementById(controlId);
        (nestedButton
          ? element?.querySelector<HTMLElement>('button:not(:disabled)')
          : element
        )?.focus();
      },
      { injector: this.injector },
    );
  }

  revealControl(id: string) {
    afterNextRender(
      () => {
        const element = document.getElementById(id);
        element?.scrollIntoView?.({ block: 'center' });
        element?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  private firstInvalidControl(recipe: Recipe): string {
    if (!recipe.name.trim()) return 'recipe-name';
    if ((recipe.notes?.length ?? 0) > 4000) return 'recipe-notes';
    if (!recipe.category) return 'recipe-category';
    if (!Number.isInteger(Number(recipe.baseServings)) || recipe.baseServings <= 0)
      return 'recipe-base-servings';
    for (const [index, ingredient] of recipe.ingredients.entries()) {
      if (!ingredient.name.trim()) return `ingredient-name-${index}`;
      if (!this.isFiniteQuantity(ingredient.quantity)) return `ingredient-quantity-${index}`;
      if (!ingredient.unit) return `ingredient-unit-${index}`;
    }
    const stepIndex = recipe.steps.findIndex((step) => !step.description.trim());
    return stepIndex >= 0 ? `step-description-${stepIndex}` : 'recipe-validation';
  }

  private renumberIngredients(ingredients: Recipe['ingredients']) {
    ingredients.forEach((ingredient, index) => (ingredient.order = index));
  }

  private renumberSteps(steps: Recipe['steps']) {
    steps.forEach((step, index) => (step.order = index));
  }

  private validateFields(recipe: Recipe): { id: string; message: string }[] {
    const errors: { id: string; message: string }[] = [];
    const add = (id: string, message: string) => errors.push({ id, message });
    if (!recipe.name.trim())
      add(
        'recipe-name',
        $localize`:@@recipes.editRecipePage.recipeNameIsRequired:Recipe name is required.`,
      );
    if ((recipe.notes?.length ?? 0) > 4000)
      add(
        'recipe-notes',
        $localize`:@@recipes.notesTooLong:Notes must be at most 4000 characters.`,
      );
    if (!recipe.category)
      add(
        'recipe-category',
        $localize`:@@recipes.editRecipePage.categoryIsRequired:Category is required.`,
      );
    if (!Number.isInteger(Number(recipe.baseServings)) || recipe.baseServings <= 0)
      add(
        'recipe-base-servings',
        $localize`:@@recipes.editRecipePage.baseServingsMustBeAPositiveWhole:Base servings must be a positive whole number.`,
      );
    recipe.ingredients.forEach((row, index) => {
      if (!row.name.trim())
        add(
          `ingredient-name-${index}`,
          $localize`:@@recipes.ingredientNameRequired:Enter an ingredient name.`,
        );
      if (!this.isFiniteQuantity(row.quantity))
        add(
          `ingredient-quantity-${index}`,
          $localize`:@@recipes.ingredientQuantityRequired:Enter a quantity greater than zero.`,
        );
      if (!row.unit.trim())
        add(
          `ingredient-unit-${index}`,
          $localize`:@@recipes.ingredientUnitRequired:Enter an ingredient unit.`,
        );
    });
    recipe.steps.forEach((row, index) => {
      if (!row.description.trim())
        add(
          `step-description-${index}`,
          $localize`:@@recipes.stepDescriptionRequired:Enter a description for this step.`,
        );
    });
    return errors;
  }

  private editableSnapshot(recipe: Recipe) {
    return JSON.stringify({
      name: recipe.name,
      notes: recipe.notes ?? null,
      category: recipe.category,
      baseServings: recipe.baseServings,
      tags: recipe.tags.map((tag) => tag.name),
      ingredients: recipe.ingredients.map(({ name, quantity, unit, order }) => ({
        name,
        quantity,
        unit,
        order,
      })),
      steps: recipe.steps.map(({ description, order }) => ({ description, order })),
    });
  }
}

export const unsavedRecipeGuard: CanDeactivateFn<EditRecipePage> = (component) =>
  component.canDeactivate();
