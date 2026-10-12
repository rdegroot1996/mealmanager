import { of, Subject } from 'rxjs';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AddMealModal } from './add-meal-modal';

describe('AddMealModal', () => {
  let component: AddMealModal;
  let fixture: ComponentFixture<AddMealModal>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AddMealModal],
    }).compileComponents();

    fixture = TestBed.createComponent(AddMealModal);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('ignores a recipe error after its modal session has ended', () => {
    const response = new Subject<never>();
    vi.spyOn(component.recipesStore, 'loadRecipe').mockReturnValue(response);
    component.selectRecipe({
      id: 'recipe-1',
      name: 'Pasta',
      category: 'Meals',
      tags: [],
      imageUrl: null,
      isFavorite: false,
    });
    component.endSession();
    response.error(new Error('Offline'));
    expect(component.error()).toBe('');
  });

  it('uses the shared recipe placeholder in search and selected recipe summaries', () => {
    component.recipesStore.summaries.set([
      {
        id: 'recipe-1',
        name: 'Pasta',
        category: 'Meals',
        tags: [],
        imageUrl: null,
        isFavorite: false,
      },
    ]);
    fixture.detectChanges();

    let placeholder = fixture.nativeElement.querySelector(
      '[data-testid="recipe-image-placeholder"]',
    ).parentElement as HTMLElement;
    expect(placeholder.classList).toContain('app-recipe-placeholder');
    expect(placeholder.classList).not.toContain('bg-base-100');

    component.selectedRecipe.set({
      id: 'recipe-1',
      name: 'Pasta',
      category: 'Meals',
      baseServings: 4,
      isFavorite: false,
      tags: [],
      images: [],
      ingredients: [],
      steps: [],
      profiles: [{ id: 'profile-1', name: 'Default', servings: 4, products: [] }],
    });
    fixture.detectChanges();

    placeholder = fixture.nativeElement.querySelector('[data-testid="recipe-image-placeholder"]')
      .parentElement as HTMLElement;
    expect(placeholder.classList).toContain('app-recipe-placeholder');
    expect(placeholder.classList).not.toContain('bg-base-100');
  });

  it('shows explicit loading, empty, and failed recipe-search states', () => {
    component.searching.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Loading recipes…');

    component.searching.set(false);
    component.recipesStore.summaries.set([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No matching recipes found.');

    component.searchError.set('Recipes could not be loaded. Please retry your search.');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Recipes could not be loaded.',
    );
    expect(fixture.nativeElement.querySelector('.alert button')?.textContent).toContain('Retry');
  });
});
