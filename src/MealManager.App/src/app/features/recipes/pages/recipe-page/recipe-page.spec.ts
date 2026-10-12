import { ApiRecipeProfile } from '../../../../api/models/api-recipe';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipePage } from './recipe-page';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { vi } from 'vitest';
import { Observable, of } from 'rxjs';
import { Recipe } from '../../models/recipe';

describe('RecipePage', () => {
  let component: RecipePage;
  let fixture: ComponentFixture<RecipePage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipePage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipePage);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('cancels an older profile selection before applying the latest profile', () => {
    component.selectProfile('first');
    const first = http.expectOne('/api/recipe-profiles/first');
    component.selectProfile('second');
    expect(first.cancelled).toBe(true);
    http
      .expectOne('/api/recipe-profiles/second')
      .flush({ id: 'second', name: 'Second', servings: 3, products: [] });
    expect(component.selectedProfileId()).toBe('second');
  });

  it('cancels a pending selection when returning to the displayed profile', () => {
    component.selectedProfileId.set('current');
    component.selectProfile('other');
    const pending = http.expectOne('/api/recipe-profiles/other');
    component.selectProfile('current');
    expect(pending.cancelled).toBe(true);
    expect(component.selectedProfileId()).toBe('current');
  });

  it('updates the selected profile after editing it', () => {
    const original: ApiRecipeProfile = {
      id: 'profile-1',
      name: 'Default',
      servings: 2,
      products: [],
    };
    const updated: ApiRecipeProfile = { ...original, name: 'Family', servings: 4 };
    const open = vi.fn();
    const success = vi.spyOn(component.toast, 'success');
    component.profile.set(original);
    (component as unknown as { profileFormModal: () => { open: typeof open } }).profileFormModal =
      () => ({ open });

    component.openEditProfile();

    const onSave = open.mock.calls[0][1] as (
      profile: ApiRecipeProfile,
    ) => Observable<ApiRecipeProfile>;
    onSave(updated).subscribe();
    http.expectOne('/api/recipe-profiles/profile-1').flush(updated);

    expect(component.profile()).toEqual(updated);
    expect(success).toHaveBeenCalledWith('Profile saved.');
  });

  it('keeps a newer profile selection when an earlier profile save finishes', () => {
    const original: ApiRecipeProfile = { id: 'first', name: 'First', servings: 2, products: [] };
    component.profile.set(original);
    component.selectedProfileId.set(original.id);
    const open = vi.fn();
    (component as unknown as { profileFormModal: () => { open: typeof open } }).profileFormModal =
      () => ({ open });
    component.openEditProfile();
    const onSave = open.mock.calls[0][1] as (
      profile: ApiRecipeProfile,
    ) => Observable<ApiRecipeProfile>;
    onSave({ ...original, name: 'Updated' }).subscribe();
    const save = http.expectOne('/api/recipe-profiles/first');
    component.selectProfile('second');
    const second: ApiRecipeProfile = { id: 'second', name: 'Second', servings: 4, products: [] };
    http.expectOne('/api/recipe-profiles/second').flush(second);
    save.flush({ ...original, name: 'Updated' });
    expect(component.profile()).toEqual(second);
    expect(component.selectedProfileId()).toBe('second');
  });

  it('offers a retryable error state when loading fails', () => {
    vi.spyOn(component.activatedRoute.snapshot.paramMap, 'get').mockReturnValue('recipe-1');

    component.loadRecipe();
    http.expectOne('/api/recipes/recipe-1').flush({}, { status: 503, statusText: 'Unavailable' });
    fixture.detectChanges();

    expect(component.loadError()).toContain('could not be loaded');
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Retry');
  });

  it('does not remove a recipe when confirmation is cancelled', async () => {
    component.recipeStore.activeRecipe.set(createRecipe());
    fixture.detectChanges();
    vi.spyOn(component.confirmationModal(), 'open').mockResolvedValue(false);
    const remove = vi.spyOn(component.recipeStore, 'deleteRecipe');

    await component.deleteRecipe();

    expect(remove).not.toHaveBeenCalled();
  });

  it('removes a recipe after confirmation', async () => {
    component.recipeStore.activeRecipe.set(createRecipe());
    fixture.detectChanges();
    vi.spyOn(component.confirmationModal(), 'open').mockResolvedValue(true);
    vi.spyOn(component.recipeStore, 'deleteRecipe').mockReturnValue(of({}));
    const navigate = vi.spyOn(component.router, 'navigate').mockResolvedValue(true);
    const success = vi.spyOn(component.toast, 'success');

    await component.deleteRecipe();

    expect(component.recipeStore.deleteRecipe).toHaveBeenCalledWith('recipe-1');
    expect(navigate).toHaveBeenCalledWith(['/recipes']);
    expect(success).toHaveBeenCalledWith('Recipe removed.');
  });

  it('removes the selected profile after confirmation', async () => {
    const recipe = createRecipe();
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[1]);
    component.selectedProfileId.set(recipe.profiles[1].id);
    fixture.detectChanges();
    vi.spyOn(component.confirmationModal(), 'open').mockResolvedValue(true);
    vi.spyOn(component.recipeStore, 'deleteProfile').mockReturnValue(of({}));
    const selectProfile = vi.spyOn(component, 'selectProfile').mockImplementation(() => undefined);
    const success = vi.spyOn(component.toast, 'success');

    await component.deleteProfile();

    expect(component.recipeStore.deleteProfile).toHaveBeenCalledWith('profile-2');
    expect(selectProfile).toHaveBeenCalledWith('profile-1');
    expect(success).toHaveBeenCalledWith('Profile removed.');
  });

  it('omits removal of the only profile from its context menu', () => {
    const recipe = createRecipe();
    recipe.profiles = [recipe.profiles[0]];
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[0]);
    component.loading.set(false);

    fixture.detectChanges();

    const removeButton = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((button) => button.textContent?.includes('Remove profile'));
    expect(removeButton).toBeUndefined();
  });

  it('shows all-history planning statistics beside the recipe metadata', () => {
    const recipe = createRecipe();
    recipe.planningStatistics = { timesPlanned: 3, lastPlanned: '2026-08-28' };
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[0]);
    component.loading.set(false);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Planned');
    expect(fixture.nativeElement.textContent).toContain('3');
    expect(fixture.nativeElement.textContent).toContain('Last planned');
    expect(fixture.nativeElement.textContent).not.toContain('Never');
  });

  it('shows empty states when ingredients and preparation steps are absent', () => {
    const recipe = createRecipe();
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[0]);
    component.loading.set(false);

    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'No ingredients have been added to this recipe.',
    );
    expect(fixture.nativeElement.textContent).toContain(
      'No preparation steps have been added to this recipe.',
    );
    expect(
      fixture.nativeElement.querySelector('[data-testid="profile-selection"] app-profile-select'),
    ).not.toBeNull();
  });

  it('uses the shared recipe placeholder for a missing image', () => {
    const recipe = createRecipe();
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[0]);
    component.loading.set(false);
    fixture.detectChanges();

    const placeholder = fixture.nativeElement.querySelector(
      '[data-testid="recipe-image-placeholder"]',
    ) as HTMLElement;
    expect(placeholder.classList).toContain('app-recipe-placeholder');
    expect(placeholder.classList).not.toContain('bg-base-200');
  });

  it('toggles the persisted favorite from the recipe image', () => {
    const recipe = createRecipe();
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[0]);
    component.loading.set(false);
    fixture.detectChanges();

    const button = fixture.nativeElement.querySelector(
      'button[aria-label="Add to favorites"]',
    ) as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.classList).toContain('btn-circle');
    expect(button.querySelectorAll('app-icon')).toHaveLength(1);
    expect(
      button.closest('.relative')?.querySelector('[data-testid="recipe-image-placeholder"]'),
    ).not.toBeNull();

    button.click();
    const request = http.expectOne('/api/recipes/recipe-1/favorite');
    expect(request.request.body).toEqual({ isFavorite: true });
    request.flush({
      id: 'recipe-1',
      name: 'Pasta',
      category: 'Meals',
      tags: [],
      imageUrl: null,
      isFavorite: true,
    });
    http.expectOne('/api/recipes?favorite=true&sort=RecentPlanningPopularity').flush([]);
    fixture.detectChanges();

    expect(component.recipe()?.isFavorite).toBe(true);
    expect(
      fixture.nativeElement.querySelector('button[aria-label="Remove from favorites"]'),
    ).not.toBeNull();
  });

  it('uses secondary-content text for preparation step numbers', () => {
    const recipe = createRecipe();
    recipe.steps = [{ id: 'step-1', description: 'Boil the pasta.', order: 0 }];
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[0]);
    component.loading.set(false);
    fixture.detectChanges();

    const stepNumber = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('div')).find(
      (element) =>
        element.textContent?.trim() === '1' && element.classList.contains('bg-secondary'),
    );
    expect(stepNumber?.classList).toContain('text-secondary-content');
    expect(stepNumber?.classList).toContain('size-8');
    expect(stepNumber?.classList).toContain('shrink-0');
  });

  it('uses a compact groceries edit action', () => {
    const recipe = createRecipe();
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[0]);
    component.loading.set(false);
    fixture.detectChanges();

    const button = Array.from<HTMLButtonElement>(
      fixture.nativeElement.querySelectorAll('button'),
    ).find((candidate) => candidate.textContent?.trim() === 'Edit');
    expect(button?.classList).toContain('btn-sm');
    expect(button?.querySelector('app-icon[name="edit"]')).not.toBeNull();
  });

  it('uses outlined destructive actions without duplicate menu dividers', () => {
    const recipe = createRecipe();
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[0]);
    component.loading.set(false);

    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelectorAll('app-action-dialog li[role="separator"]'),
    ).toHaveLength(0);
    expect(
      fixture.nativeElement.querySelectorAll('app-action-dialog button.btn-outline.btn-error'),
    ).toHaveLength(2);
  });

  it('groups profile groceries and updates both sections when the profile changes', () => {
    const recipe = createRecipe();
    recipe.profiles[0].products = [
      { id: 'salt', name: 'Salt', quantity: 1, atHome: true },
      { id: 'pasta', name: 'Pasta', quantity: 2, atHome: false },
      { id: 'oil', name: 'Oil', quantity: 1, atHome: true },
    ];
    component.recipeStore.activeRecipe.set(recipe);
    component.profile.set(recipe.profiles[0]);
    component.loading.set(false);
    fixture.detectChanges();

    const sections = () =>
      Array.from<HTMLElement>(
        fixture.nativeElement.querySelectorAll(
          'section[aria-label="Needed"], section[aria-label="Usually at home"]',
        ),
      );
    expect(sections()).toHaveLength(2);
    expect(sections()[0].querySelector('h3')?.textContent).toBe('Needed');
    expect(sections()[0].textContent).toContain('Pasta');
    expect(sections()[0].textContent).not.toContain('Salt');
    expect(
      Array.from(sections()[1].querySelectorAll('li > span:first-child')).map((name) =>
        name.textContent?.trim(),
      ),
    ).toEqual(['Salt', 'Oil']);

    component.profile.set(recipe.profiles[1]);
    fixture.detectChanges();
    expect(sections()).toHaveLength(0);
    expect(fixture.nativeElement.textContent).toContain('No groceries added to this profile.');

    component.profile.set({
      ...recipe.profiles[1],
      products: [{ id: 'rice', name: 'Rice', quantity: 1, atHome: false }],
    });
    fixture.detectChanges();
    expect(sections()).toHaveLength(1);
    expect(sections()[0].getAttribute('aria-label')).toBe('Needed');
    expect(sections()[0].querySelector('h3')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('No groceries added to this profile.');

    component.profile.set({
      ...recipe.profiles[1],
      products: [{ id: 'salt', name: 'Salt', quantity: 1, atHome: true }],
    });
    fixture.detectChanges();
    expect(sections()).toHaveLength(1);
    expect(sections()[0].getAttribute('aria-label')).toBe('Usually at home');
    expect(sections()[0].querySelector('h3')?.textContent).toBe('Usually at home');
  });

  function createRecipe(): Recipe {
    return {
      id: 'recipe-1',
      name: 'Pasta',
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      images: [],
      ingredients: [],
      steps: [],
      profiles: [
        { id: 'profile-1', name: 'Default', servings: 2, products: [] },
        { id: 'profile-2', name: 'Family', servings: 4, products: [] },
      ],
    };
  }
});
