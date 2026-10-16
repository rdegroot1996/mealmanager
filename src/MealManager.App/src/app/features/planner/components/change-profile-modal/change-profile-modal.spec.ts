import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { ChangeProfileModal } from './change-profile-modal';

it('explains shopping-selection invalidation only when changing a reviewed meal', () => {
  TestBed.configureTestingModule({
    imports: [ChangeProfileModal],
    providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
  });
  const fixture = TestBed.createComponent(ChangeProfileModal);
  const component = fixture.componentInstance;
  component.meal.set({
    id: 'meal',
    kind: 'Meal',
    originalMealId: null,
    date: '2026-10-15',
    sortOrder: 0,
    recipe: {
      id: 'recipe',
      name: 'Pasta',
      category: 'Meals',
      imageUrl: null,
      tags: [],
      isFavorite: false,
    },
    recipeProfile: { id: 'original', name: 'Default', servings: 2 },
    hasReviewedGroceries: true,
  });
  component.selectedProfileId.set('original');
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).not.toContain("removes this meal's shopping selection");
  component.selectedProfileId.set('bulk');
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).toContain("removes this meal's shopping selection");
  component.meal.update((meal) => ({ ...meal!, hasReviewedGroceries: false }));
  fixture.detectChanges();
  expect(fixture.nativeElement.textContent).not.toContain("removes this meal's shopping selection");
});
