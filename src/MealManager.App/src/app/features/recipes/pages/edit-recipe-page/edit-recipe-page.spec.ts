import { ComponentFixture, TestBed } from '@angular/core/testing';

import { EditRecipePage } from './edit-recipe-page';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { of } from 'rxjs';

describe('EditRecipePage', () => {
  let component: EditRecipePage;
  let fixture: ComponentFixture<EditRecipePage>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [EditRecipePage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(EditRecipePage);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
    http.expectOne('/api/recipes/tags').flush([]);
  });

  afterEach(() => {
    http.match('/api/recipes/tags').forEach((request) => {
      if (!request.cancelled) request.flush([]);
    });
    http.verify();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('offers Other as a recipe category', () => {
    component.ngOnInit();
    fixture.detectChanges();

    const category = fixture.nativeElement.querySelector(
      'select[aria-label="Category"]',
    ) as HTMLSelectElement;
    expect([...category.options].map((option) => option.value)).toContain('Other');
  });

  it('associates the servings label with the number input without changing servings', () => {
    component.ngOnInit();
    fixture.detectChanges();

    const label = fixture.nativeElement.querySelector(
      'label[for="recipe-base-servings"]',
    ) as HTMLLabelElement;
    const input = fixture.nativeElement.querySelector('#recipe-base-servings') as HTMLInputElement;
    const servings = component.recipe()!.baseServings;

    expect(label.control).toBe(input);
    label.click();
    expect(component.recipe()!.baseServings).toBe(servings);
  });

  it('blocks an invalid recipe save with focused validation feedback', () => {
    component.ngOnInit();

    component.saveRecipe();

    expect(component.validationErrors()).toContain('Recipe name is required.');
    expect(component.saving()).toBe(false);
  });

  it('allows a recipe without ingredients or preparation steps', () => {
    component.ngOnInit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No ingredients have been added yet.');
    expect(fixture.nativeElement.textContent).toContain(
      'No preparation steps have been added yet.',
    );

    component.recipe()!.name = 'Takeaway night';
    const savedRecipe = { ...component.recipe()!, id: 'recipe-1' };
    const save = vi.spyOn(component.recipeStore, 'saveRecipe').mockReturnValue(of(savedRecipe));
    vi.spyOn(component.router, 'navigate').mockResolvedValue(true);

    component.saveRecipe();

    expect(component.validationErrors()).toEqual([]);
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ ingredients: [], steps: [] }));
  });

  it('renumbers steps after a drag-and-drop reorder', () => {
    component.recipe.set({
      id: 'recipe-1',
      name: 'Soup',
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      images: [],
      ingredients: [],
      profiles: [],
      steps: [
        { id: 'first', description: 'First', order: 0 },
        { id: 'second', description: 'Second', order: 1 },
      ],
    });

    component.dropStep({ previousIndex: 1, currentIndex: 0 } as never);

    expect(component.recipe()!.steps).toEqual([
      { id: 'second', description: 'Second', order: 0 },
      { id: 'first', description: 'First', order: 1 },
    ]);
  });

  it('submits steps in their displayed order after removal and adding a replacement', () => {
    component.ngOnInit();
    component.recipe()!.name = 'Soup';
    component.recipe()!.steps = [
      { id: 'first', description: 'Boil', order: 0 },
      { id: 'second', description: 'Season', order: 1 },
      { id: 'third', description: 'Serve', order: 2 },
    ];

    component.removeStep(1);
    component.addStep();
    component.recipe()!.steps[2].description = 'Enjoy';
    component.saveRecipe();

    const save = http.expectOne('/api/recipes');
    expect(save.request.body.steps).toEqual([
      { id: 'first', description: 'Boil' },
      { id: 'third', description: 'Serve' },
      { id: expect.any(String), description: 'Enjoy' },
    ]);
    save.flush({}, { status: 503, statusText: 'Unavailable' });
  });

  it('supports keyboard step reordering and keeps the focused handle attached to its step', async () => {
    component.ngOnInit();
    component.recipe()!.steps = [
      { id: 'first', description: 'First', order: 0 },
      { id: 'second', description: 'Second', order: 1 },
    ];
    fixture.detectChanges();
    const handle = fixture.nativeElement.querySelector(
      'button[aria-label^="Reorder step 1"]',
    ) as HTMLButtonElement;
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.recipe()!.steps.map(({ id, order }) => ({ id, order }))).toEqual([
      { id: 'second', order: 0 },
      { id: 'first', order: 1 },
    ]);
    expect(document.activeElement).toBe(handle);
    expect(handle.getAttribute('aria-label')).toContain('Reorder step 2');
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect(component.recipe()!.steps[1].id).toBe('first');
  });

  it('renumbers ingredients after a drag-and-drop reorder', () => {
    component.recipe.set({
      id: 'recipe-1',
      name: 'Soup',
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      images: [],
      ingredients: [
        { id: 'first', name: 'Water', quantity: 1, unit: 'l', order: 0 },
        { id: 'second', name: 'Salt', quantity: 1, unit: 'tsp', order: 1 },
      ],
      profiles: [],
      steps: [],
    });

    component.dropIngredient({ previousIndex: 1, currentIndex: 0 } as never);

    expect(component.recipe()!.ingredients).toEqual([
      { id: 'second', name: 'Salt', quantity: 1, unit: 'tsp', order: 0 },
      { id: 'first', name: 'Water', quantity: 1, unit: 'l', order: 1 },
    ]);
  });

  it('supports keyboard ingredient reordering from an accessible handle', async () => {
    component.recipe.set({
      id: 'recipe-1',
      name: 'Soup',
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      images: [],
      ingredients: [
        { id: 'first', name: 'Water', quantity: 1, unit: 'l', order: 0 },
        { id: 'second', name: 'Salt', quantity: 1, unit: 'tsp', order: 1 },
      ],
      profiles: [],
      steps: [],
    });
    fixture.detectChanges();

    const handle = fixture.nativeElement.querySelector(
      'button[aria-label^="Reorder Water"]',
    ) as HTMLButtonElement;
    handle.focus();
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.recipe()!.ingredients.map(({ name, order }) => ({ name, order }))).toEqual([
      { name: 'Salt', order: 0 },
      { name: 'Water', order: 1 },
    ]);
    expect(document.activeElement).toBe(handle);
  });

  it('keeps the editor open and shows a save error from the API', () => {
    component.recipe.set({
      id: '',
      name: 'Soup',
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      images: [],
      profiles: [],
      ingredients: [{ id: 'ingredient-1', name: 'Water', quantity: 1, unit: 'l', order: 0 }],
      steps: [{ id: 'step-1', description: 'Boil', order: 0 }],
    });

    component.saveRecipe();

    http
      .expectOne('/api/recipes')
      .flush(
        { detail: 'Recipe name is already in use.' },
        { status: 400, statusText: 'Bad Request' },
      );
    expect(component.saving()).toBe(false);
    expect(component.saveError()).toBe('Recipe name is already in use.');
  });

  it('requires the first save before photos can be added', () => {
    component.ngOnInit();
    fixture.detectChanges();

    const addImage = [...fixture.nativeElement.querySelectorAll('button')].find(
      (button: HTMLButtonElement) => button.textContent?.includes('Add image'),
    ) as HTMLButtonElement;
    expect(addImage.disabled).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Save the recipe first, then add photos.');
    expect(fixture.nativeElement.querySelector('input[type="file"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'JPEG, PNG, WebP, GIF, HEIC or HEIF. Maximum 10 MB.',
    );
  });

  it('keeps a newly saved recipe open and uploads a selected photo immediately', () => {
    component.ngOnInit();
    fixture.detectChanges();
    component.recipe()!.name = 'Soup';
    const savedRecipe = { ...component.recipe()!, id: 'recipe-1' };
    vi.spyOn(component.recipeStore, 'saveRecipe').mockReturnValue(of(savedRecipe));
    const navigate = vi.spyOn(component.router, 'navigate').mockResolvedValue(true);

    component.saveRecipe();
    fixture.detectChanges();
    expect(component.recipe()!.id).toBe('recipe-1');
    expect(navigate).toHaveBeenCalledWith(['/recipes', 'recipe-1', 'edit'], {
      replaceUrl: true,
    });
    expect(fixture.nativeElement.textContent).not.toContain('Save the recipe first');

    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['photo'], 'soup.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', {
      value: { 0: file, length: 1, item: () => file },
    });

    component.uploadImage({ target: input } as unknown as Event);
    fixture.detectChanges();

    expect(component.imageUploading()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Uploading photo 1 of 1…');
    expect(navigate).toHaveBeenCalledOnce();
    http.expectOne('/api/recipes/recipe-1/images').flush({
      id: 'image-1',
      url: '/uploads/soup.jpg',
      order: 0,
    });

    expect(component.imageUploading()).toBe(false);
    expect(component.photoItems()).toEqual([{ id: 'image-1', url: '/uploads/soup.jpg' }]);
    expect(component.recipe()!.images).toEqual([
      { id: 'image-1', url: '/uploads/soup.jpg', order: 0 },
    ]);
    expect(navigate).toHaveBeenCalledOnce();
  });

  it('reports progress while uploading multiple photos in order', () => {
    component.ngOnInit();
    component.recipe.set({ ...component.recipe()!, id: 'recipe-1', name: 'Soup' });
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const first = new File(['first'], 'first.jpg', { type: 'image/jpeg' });
    const second = new File(['second'], 'second.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', {
      value: { 0: first, 1: second, length: 2, item: (index: number) => [first, second][index] },
    });

    component.uploadImage({ target: input } as unknown as Event);
    expect(component.uploadStatus()).toBe('Uploading photo 1 of 2…');
    expect(component.imagesPending()).toBe(true);
    http.expectOne('/api/recipes/recipe-1/images').flush({
      id: 'first',
      url: '/first.jpg',
      order: 0,
    });
    expect(component.uploadStatus()).toBe('Uploading photo 2 of 2…');
    http.expectOne('/api/recipes/recipe-1/images').flush({
      id: 'second',
      url: '/second.jpg',
      order: 1,
    });
    expect(component.imagesPending()).toBe(false);
    expect(component.photoItems().map(({ id }) => id)).toEqual(['first', 'second']);
  });

  it('shows upload failure and allows selecting the photo again', () => {
    component.ngOnInit();
    component.recipe.set({ ...component.recipe()!, id: 'recipe-1', name: 'Soup' });
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['photo'], 'soup.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', {
      value: { 0: file, length: 1, item: () => file },
    });
    component.uploadImage({ target: input } as unknown as Event);
    http
      .expectOne('/api/recipes/recipe-1/images')
      .flush({ detail: 'Photo rejected.' }, { status: 400, statusText: 'Bad Request' });

    expect(component.recipe()!.id).toBe('recipe-1');
    expect(component.photoItems()).toHaveLength(0);
    expect(component.imageError()).toContain('Photo rejected.');
    expect(component.imageError()).toContain('Select the photo again to retry.');
    expect(component.saving()).toBe(false);
    component.uploadImage({ target: input } as unknown as Event);
    http.expectOne('/api/recipes/recipe-1/images').flush({
      id: 'image-1',
      url: '/uploads/soup.jpg',
      order: 0,
    });
    expect(component.imageError()).toBe('');
    expect(component.photoItems()).toHaveLength(1);
  });

  it('adds blank rows and focuses their primary control', async () => {
    component.ngOnInit();
    fixture.detectChanges();

    component.addIngredient();
    fixture.detectChanges();
    await fixture.whenStable();
    expect((document.activeElement as HTMLElement).id).toBe('ingredient-name-0');

    component.addStep();
    fixture.detectChanges();
    await fixture.whenStable();
    expect(component.recipe()!.steps[0].description).toBe('');
    expect((document.activeElement as HTMLElement).id).toBe('step-description-0');
  });

  it('saves and resets the editor for rapid entry of another recipe', async () => {
    component.ngOnInit();
    fixture.detectChanges();
    component.recipe()!.name = 'Soup';
    const savedRecipe = { ...component.recipe()!, id: 'recipe-1' };
    vi.spyOn(component.recipeStore, 'saveRecipe').mockReturnValue(of(savedRecipe));
    const success = vi.spyOn(component.toast, 'success');

    component.saveRecipe(true);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(component.recipe()).toEqual(
      expect.objectContaining({ id: '', name: '', category: 'Meals', baseServings: 2 }),
    );
    expect(component.hasUnsavedChanges()).toBe(false);
    expect((document.activeElement as HTMLElement).id).toBe('recipe-name');
    expect(success).toHaveBeenCalledWith('Recipe saved. Ready for another.');
  });

  it('shows an actionable image error from the API', () => {
    component.recipe.set({
      id: 'recipe-1',
      name: 'Soup',
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      images: [],
      profiles: [],
      ingredients: [{ id: 'ingredient-1', name: 'Water', quantity: 1, unit: 'l', order: 0 }],
      steps: [{ id: 'step-1', description: 'Boil', order: 0 }],
    });
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['not an image'], 'recipe.svg', { type: 'image/svg+xml' });
    Object.defineProperty(input, 'files', {
      value: {
        0: file,
        length: 1,
        item: (index: number) => (index === 0 ? file : null),
      },
    });

    component.uploadImage({ target: input } as unknown as Event);

    expect(component.imageUploading()).toBe(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Uploading photo 1 of 1…');

    const message =
      "We couldn't read this image. Choose a JPEG, PNG, WebP, GIF, HEIC, or HEIF image, or export it as JPEG.";
    http
      .expectOne('/api/recipes/recipe-1/images')
      .flush({ detail: message }, { status: 400, statusText: 'Bad Request' });
    expect(component.imageUploading()).toBe(false);
    fixture.detectChanges();

    expect(component.imageError()).toContain(message);
    expect(component.imageError()).toContain('Select the photo again to retry.');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(message);
  });

  it('shows a not-found state for a missing recipe', () => {
    component.loadRecipe('missing');
    http.expectOne('/api/recipes/missing').flush({}, { status: 404, statusText: 'Not Found' });
    fixture.detectChanges();

    expect(component.notFound()).toBe(true);
    expect(fixture.nativeElement.textContent).toContain('Recipe not found');
  });

  it('detects editable changes for navigation protection', () => {
    component.ngOnInit();
    expect(component.hasUnsavedChanges()).toBe(false);

    component.recipe()!.name = 'Changed';

    expect(component.hasUnsavedChanges()).toBe(true);
  });

  it('keeps the chosen photo order and stays in the editor when saving its order fails', () => {
    component.recipe.set({
      id: 'recipe-1',
      name: 'Soup',
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      images: [
        { id: 'a', url: '/a.jpg', order: 0 },
        { id: 'b', url: '/b.jpg', order: 1 },
      ],
      ingredients: [],
      profiles: [],
      steps: [],
    });
    component.photoItems.set([
      { id: 'a', url: '/a.jpg' },
      { id: 'b', url: '/b.jpg' },
    ]);
    component.moveImage(0, 1);
    vi.spyOn(component.recipeStore, 'saveRecipe').mockReturnValue(of(component.recipe()!));
    const navigate = vi.spyOn(component.router, 'navigate').mockResolvedValue(true);

    component.saveRecipe();

    http
      .expectOne('/api/recipes/recipe-1/images/order')
      .flush({}, { status: 500, statusText: 'Error' });

    expect(component.photoItems().map(({ id }) => id)).toEqual(['b', 'a']);
    expect(component.photoOrderDirty()).toBe(true);
    expect(component.imagesPending()).toBe(false);
    expect(component.saving()).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reorders an uploaded photo with existing photos, then persists their final order', () => {
    component.recipe.set({
      id: 'recipe-1',
      name: 'Soup',
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      images: [{ id: 'stored', url: '/stored.jpg', order: 0 }],
      ingredients: [],
      profiles: [],
      steps: [],
    });
    component.photoItems.set([{ id: 'stored', url: '/stored.jpg' }]);
    fixture.detectChanges();
    const input = fixture.nativeElement.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['photo'], 'new.jpg', { type: 'image/jpeg' });
    Object.defineProperty(input, 'files', {
      value: { 0: file, length: 1, item: () => file },
    });
    component.uploadImage({ target: input } as unknown as Event);
    http.expectOne('/api/recipes/recipe-1/images').flush({
      id: 'uploaded',
      url: '/uploaded.jpg',
      order: 1,
    });

    component.moveImage(1, 0);

    expect(component.photoItems().map(({ id }) => id)).toEqual(['uploaded', 'stored']);
    vi.spyOn(component.recipeStore, 'saveRecipe').mockReturnValue(of(component.recipe()!));
    vi.spyOn(component.router, 'navigate').mockResolvedValue(true);
    component.saveRecipe();
    const reorder = http.expectOne('/api/recipes/recipe-1/images/order');
    expect(reorder.request.body).toEqual({ imageIds: ['uploaded', 'stored'] });
    reorder.flush([
      { id: 'uploaded', url: '/uploaded.jpg', order: 0 },
      { id: 'stored', url: '/stored.jpg', order: 1 },
    ]);

    expect(component.photoItems().map(({ id }) => id)).toEqual(['uploaded', 'stored']);
    expect(component.photoOrderDirty()).toBe(false);
  });

  it('associates the visible Unit label with the selector free-text input', () => {
    component.ngOnInit();
    component.addIngredient();
    fixture.detectChanges();
    const label = fixture.nativeElement.querySelector(
      'label[for="ingredient-unit-0"]',
    ) as HTMLLabelElement;
    expect(label.control?.tagName).toBe('INPUT');
    expect(label.control?.getAttribute('list')).toBeNull();
    expect(
      fixture.nativeElement.querySelector('[aria-label="Choose a common unit"]'),
    ).not.toBeNull();
  });

  it('uses the styled dialog to confirm in-app navigation with unsaved changes', async () => {
    component.ngOnInit();
    fixture.detectChanges();
    component.recipe()!.name = 'Changed';
    const modal = component.discardChangesModal()!;
    const open = vi.spyOn(modal, 'open').mockResolvedValue(true);

    const decision = component.canDeactivate();

    expect(open).toHaveBeenCalledOnce();
    await expect(decision).resolves.toBe(true);
  });

  it('warns before leaving during a photo upload', async () => {
    component.ngOnInit();
    fixture.detectChanges();
    component.imageUploading.set(true);
    const open = vi.spyOn(component.discardChangesModal(), 'open').mockResolvedValue(false);

    await expect(component.canDeactivate()).resolves.toBe(false);
    expect(open).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Leave while photos upload?' }),
    );
  });
  it('shows popular unselected tags without a query and keeps catalog state intact', () => {
    component.recipe()!.tags = [{ id: 'selected', name: 'Quick' }];
    component.recipeStore.summaries.set([]);
    component.loadTagSuggestions();
    http.expectOne('/api/recipes/tags').flush([
      { name: 'Quick', recipeCount: 5 },
      { name: 'Baking', recipeCount: 3 },
    ]);
    fixture.detectChanges();
    expect(component.tagSuggestions()).toEqual(['Baking']);
    expect(component.recipeStore.summaries()).toEqual([]);
    expect(
      fixture.nativeElement.querySelector('[aria-label="Tag suggestions"]').textContent,
    ).toContain('Baking');
  });

  it('includes notes in unsaved-change detection and saved content', () => {
    component.ngOnInit();
    vi.spyOn(component.router, 'navigate').mockResolvedValue(true);
    component.recipe()!.name = 'Bread';
    component.recipe()!.notes = 'Book, page 10\nFamily favorite';
    const save = vi
      .spyOn(component.recipeStore, 'saveRecipe')
      .mockReturnValue(of({ ...component.recipe()!, id: 'bread' }));
    component.saveRecipe();
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ notes: 'Book, page 10\nFamily favorite' }),
    );
    component.recipe()!.notes = 'Changed';
    expect(component.hasUnsavedChanges()).toBe(true);
  });
});
