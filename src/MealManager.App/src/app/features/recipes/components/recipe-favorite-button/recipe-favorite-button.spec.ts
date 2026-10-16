import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RecipeFavoriteButton } from './recipe-favorite-button';

describe('RecipeFavoriteButton', () => {
  let fixture: ComponentFixture<RecipeFavoriteButton>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    fixture = TestBed.createComponent(RecipeFavoriteButton);
    fixture.componentRef.setInput('recipe', { id: 'recipe-1', name: 'Pasta', isFavorite: false });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('uses one visible circular surface and persists the favorite state', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;

    expect(button.classList).toContain('btn-circle');
    expect(button.querySelectorAll('app-icon')).toHaveLength(1);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Add Pasta to favorites');
    expect(button.title).toBe('Add Pasta to favorites');
    expect(button.querySelector('app-icon')?.classList).toContain('block');

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
    fixture.componentRef.setInput('recipe', { id: 'recipe-1', name: 'Pasta', isFavorite: true });
    fixture.detectChanges();
    expect(button.getAttribute('aria-label')).toBe('Remove Pasta from favorites');
    expect(button.title).toBe('Remove Pasta from favorites');
  });
});
