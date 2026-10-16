import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { RecipesStore } from './recipes.store';

describe('RecipesStore', () => {
  let store: RecipesStore;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    store = TestBed.inject(RecipesStore);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads filtered summaries and stores them', () => {
    store.loadSummaries({ category: 'Meals', tags: ['quick'], search: 'pasta' }).subscribe();
    const request = http.expectOne('/api/recipes?category=Meals&tags=quick&search=pasta');
    expect(request.request.method).toBe('GET');
    request.flush([
      {
        id: 'recipe-1',
        name: 'Pasta',
        imageUrl: null,
        category: 'Meals',
        tags: [],
        isFavorite: false,
      },
    ]);

    expect(store.summaries()).toEqual([
      {
        id: 'recipe-1',
        name: 'Pasta',
        imageUrl: null,
        category: 'Meals',
        tags: [],
        isFavorite: false,
      },
    ]);
  });

  it('creates recipes and maps their profiles for the editor', () => {
    store
      .saveRecipe({
        id: '',
        name: 'Pasta',
        category: 'Meals',
        baseServings: 2,
        isFavorite: false,
        tags: [{ id: 'tag-1', name: 'quick' }],
        ingredients: [{ id: 'ingredient-1', name: 'Pasta', quantity: 200, unit: 'g', order: 0 }],
        steps: [],
        profiles: [],
        images: [],
      })
      .subscribe();

    const request = http.expectOne('/api/recipes');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      name: 'Pasta',
      notes: null,
      category: 'Meals',
      baseServings: 2,
      tags: ['quick'],
      ingredients: [{ id: 'ingredient-1', name: 'Pasta', quantity: 200, unit: 'g' }],
      steps: [],
    });
    request.flush({
      id: 'recipe-1',
      name: 'Pasta',
      category: 'Meals',
      baseServings: 2,
      isFavorite: false,
      tags: [],
      ingredients: [{ id: 'ingredient-1', name: 'Pasta', quantity: 200, unit: 'g', order: 0 }],
      steps: [],
      profiles: [{ id: 'profile-1', name: 'Default', servings: 2 }],
      images: [],
    });

    expect(store.activeRecipe()?.profiles[0].groceries).toEqual([]);
  });

  it('loads the catalog with favorite and planning-history filters', () => {
    store
      .loadSummaries({
        category: 'Meals',
        tags: ['quick'],
        search: 'pasta',
        favorite: true,
        sort: 'LeastPlanned',
      })
      .subscribe();

    const request = http.expectOne(
      '/api/recipes?category=Meals&tags=quick&search=pasta&favorite=true&sort=LeastPlanned',
    );
    expect(request.request.method).toBe('GET');
    request.flush([]);
    expect(store.summaries()).toEqual([]);
  });

  it('persists a favorite and keeps catalog and dashboard state aligned', () => {
    const recipe = {
      id: 'recipe-1',
      name: 'Pasta',
      imageUrl: null,
      category: 'Meals',
      tags: [],
      isFavorite: false,
    };
    store.summaries.set([recipe]);

    store.setFavorite(recipe.id, true).subscribe();
    const request = http.expectOne('/api/recipes/recipe-1/favorite');
    expect(request.request.body).toEqual({ isFavorite: true });
    request.flush({ ...recipe, isFavorite: true });

    http.expectOne('/api/recipes?favorite=true&sort=RecentPlanningPopularity').flush([
      { ...recipe, id: 'popular', name: 'Zucchini', isFavorite: true },
      { ...recipe, isFavorite: true },
    ]);
    expect(store.summaries()[0].isFavorite).toBe(true);
    expect(store.favoriteSummaries().map((item) => item.id)).toEqual(['popular', 'recipe-1']);
  });

  it('loads only persisted favorites for the dashboard', () => {
    store.loadFavorites().subscribe();
    const request = http.expectOne('/api/recipes?favorite=true&sort=RecentPlanningPopularity');
    request.flush([
      {
        id: 'recipe-1',
        name: 'Pasta',
        imageUrl: null,
        category: 'Meals',
        tags: [],
        isFavorite: true,
      },
    ]);

    expect(store.favoriteSummaries()[0].isFavorite).toBe(true);
  });

  it.each(['save', 'delete'])(
    'preserves a newly selected recipe when an earlier %s finishes',
    (operation) => {
      const recipe = {
        id: 'first',
        name: 'Pasta',
        category: 'Meals' as const,
        baseServings: 2,
        isFavorite: false,
        tags: [],
        ingredients: [],
        steps: [],
        profiles: [],
        images: [],
      };
      store.activeRecipe.set(recipe);
      if (operation === 'save') store.saveRecipe(recipe).subscribe();
      else store.deleteRecipe(recipe.id).subscribe();
      const mutation = http.expectOne('/api/recipes/first');
      store.loadRecipe('second').subscribe();
      http.expectOne('/api/recipes/second').flush({ ...recipe, id: 'second', name: 'Rice' });
      mutation.flush(operation === 'save' ? { ...recipe, name: 'Edited pasta' } : null);
      expect(store.activeRecipe()?.id).toBe('second');
      expect(store.activeRecipe()?.name).toBe('Rice');
    },
  );

  it('keeps the newer server-ranked list when favorite reads finish out of order', () => {
    const url = '/api/recipes?favorite=true&sort=RecentPlanningPopularity';
    store.loadFavorites().subscribe();
    const earlier = http.expectOne(url);
    store.loadFavorites().subscribe();
    http.expectOne(url).flush([
      {
        id: 'latest',
        name: 'Rice',
        category: 'Meals',
        tags: [],
        imageUrl: null,
        isFavorite: true,
      },
    ]);
    earlier.flush([]);
    expect(store.favoriteSummaries().map((recipe) => recipe.id)).toEqual(['latest']);
  });
});
