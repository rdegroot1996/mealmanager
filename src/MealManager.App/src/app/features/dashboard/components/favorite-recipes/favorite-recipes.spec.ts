import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FavoriteRecipes } from './favorite-recipes';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('FavoriteRecipes', () => {
  let component: FavoriteRecipes;
  let fixture: ComponentFixture<FavoriteRecipes>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FavoriteRecipes],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(FavoriteRecipes);
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    fixture.detectChanges();
    http.expectOne('/api/recipes?favorite=true&sort=RecentPlanningPopularity').flush([]);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses card-shaped placeholders while loading', () => {
    component.loading.set(true);
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="favorite-recipes-skeleton"]'),
    ).not.toBeNull();
  });

  it('shows image-led recipe cards and a persistent catalog link', () => {
    component.recipeStore.favoriteSummaries.set([
      {
        id: 'recipe-1',
        name: 'Pasta',
        imageUrl: null,
        category: 'Meals',
        tags: [],
        isFavorite: true,
      },
    ]);

    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('a[href="/recipes/recipe-1"]');
    expect(card).not.toBeNull();
    expect(card.textContent).toContain('Pasta');
    expect(card.textContent).not.toContain('Meals');

    expect(fixture.nativeElement.querySelector('a[href="/recipes"]').textContent).toContain(
      'All recipes',
    );
    expect(card.querySelector('.line-clamp-2')).not.toBeNull();
    const favoriteButton = fixture.nativeElement.querySelector(
      'button[aria-label="Remove Pasta from favorites"]',
    );
    expect(favoriteButton).not.toBeNull();
    expect(card.contains(favoriteButton)).toBe(false);
  });

  it('keeps every favorite in four-card pages at every viewport size', () => {
    component.recipeStore.favoriteSummaries.set(
      ['A', 'B', 'C', 'D', 'E'].map((name, index) => ({
        id: `recipe-${index}`,
        name,
        imageUrl: null,
        category: 'Meals',
        tags: [],
        isFavorite: true,
      })),
    );

    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('a[aria-label^="Open recipe"]')).toHaveLength(5);
    expect(component.pageCount()).toBe(2);
    expect(
      fixture.nativeElement.querySelectorAll('[aria-hidden="true"] .rounded-full'),
    ).toHaveLength(2);
  });

  it('groups four favorites into equal-row two-by-two cards with consistent image proportions', () => {
    component.recipeStore.favoriteSummaries.set(
      ['A', 'B', 'C', 'D', 'E'].map((name, index) => ({
        id: `recipe-${index}`,
        name,
        imageUrl: null,
        category: 'Meals',
        tags: [],
        isFavorite: true,
      })),
    );
    fixture.detectChanges();

    const pages = fixture.nativeElement.querySelectorAll('[data-testid="favorite-page"]');
    expect(pages).toHaveLength(2);
    expect(pages[0].classList).toContain('grid-cols-2');
    expect(pages[0].classList).toContain('auto-rows-max');
    expect(pages[0].classList).toContain('content-start');
    expect(pages[0].classList).toContain('self-start');
    expect(pages[0].classList).toContain('items-stretch');
    expect(pages[0].classList).toContain('w-full');
    expect(pages[0].classList).toContain('max-w-full');
    const firstPageCards = pages[0].querySelectorAll('a[aria-label^="Open recipe"]');
    expect(firstPageCards).toHaveLength(4);
    expect(firstPageCards[0].classList).toContain('h-full');
    expect(
      firstPageCards[0].querySelector('[data-testid="favorite-recipe-image"]').classList,
    ).toContain('aspect-[16/10]');
    expect(firstPageCards[0].querySelector('.aspect-square')).toBeNull();
    expect(firstPageCards[0].querySelector('.line-clamp-2.text-ellipsis')).not.toBeNull();
    expect(pages[1].querySelectorAll('a[aria-label^="Open recipe"]')).toHaveLength(1);
  });
});
