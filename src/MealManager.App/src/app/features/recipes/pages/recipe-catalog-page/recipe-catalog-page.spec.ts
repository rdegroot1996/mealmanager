import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeCatalogPage } from './recipe-catalog-page';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('RecipeCatalogPage', () => {
  let component: RecipeCatalogPage;
  let fixture: ComponentFixture<RecipeCatalogPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeCatalogPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeCatalogPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('restores available tags after retry and retains them when filters narrow the results', () => {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne('/api/recipes').flush({}, { status: 503, statusText: 'Unavailable' });
    expect(component.error()).toBeTruthy();

    component.applyFilters();
    http
      .expectOne('/api/recipes')
      .flush([{ id: 'recipe-1', name: 'Pasta', tags: [{ id: 'tag-1', name: 'Quick' }] }]);

    expect(component.recipeStore.summaries()).toHaveLength(1);
    expect(component.error()).toBe('');
    expect(component.allTags()).toEqual(['Quick']);

    component.updateFilters({ category: 'Meals', tags: ['Quick'], favoriteOnly: false });
    http.expectOne('/api/recipes?category=Meals&tags=Quick').flush([]);
    expect(component.recipeStore.summaries()).toEqual([]);
    expect(component.allTags()).toEqual(['Quick']);
    http.verify();
  });

  it('offers the complete category filter in the single filter dialog', () => {
    fixture.detectChanges();

    const categories = [
      ...fixture.nativeElement.querySelectorAll('app-recipe-catalog-filter-form select option'),
    ] as HTMLOptionElement[];
    expect(categories.map((category) => category.value)).toEqual([
      '',
      'Meals',
      'Baking',
      'Desserts',
      'Snacks',
      'Other',
    ]);
  });

  it('keeps search above separated filter and sort controls', () => {
    fixture.detectChanges();
    const toolbar = fixture.nativeElement.querySelector(
      '[data-testid="catalog-toolbar"]',
    ) as HTMLElement;
    const controls = [...toolbar.children] as HTMLElement[];

    expect(controls.map((control) => control.tagName.toLowerCase())).toEqual([
      'app-search-field',
      'app-recipe-catalog-filters',
      'div',
    ]);
    expect(toolbar.classList).toContain('grid-cols-[auto_minmax(0,1fr)]');
    expect(controls[0].classList).toContain('col-span-2');
    expect(controls[1].classList).toContain('justify-self-start');
    expect(controls[2].querySelector('app-icon[name="sort"]')).toBeTruthy();
    expect(controls[2].classList).toContain('justify-self-end');
    expect(controls[2].querySelector('select[aria-label="Recipe sort order"]')).toBeTruthy();
    expect(controls[2].classList).toContain('max-w-full');
    expect(
      controls[2].querySelector('select[aria-label="Recipe sort order"]')?.classList,
    ).toContain('w-full');
  });

  it('updates the sizing label with each selected native sort option', () => {
    fixture.detectChanges();
    const select = fixture.nativeElement.querySelector(
      'select[aria-label="Recipe sort order"]',
    ) as HTMLSelectElement;
    for (const option of [...select.options]) {
      component.sortOrder.set(option.value as ReturnType<typeof component.sortOrder>);
      fixture.detectChanges();
      expect(
        select.parentElement?.querySelector('span[aria-hidden="true"]')?.textContent?.trim(),
      ).toBe(option.textContent?.trim());
    }
  });

  it('provides a named recipe creation action', () => {
    fixture.detectChanges();
    const action = fixture.nativeElement.querySelector('a[aria-label="Add recipe"]');
    expect(action?.getAttribute('href')).toBe('/recipes/new');
  });

  it('offers favorite and planning-history filters', () => {
    fixture.detectChanges();

    const sort = fixture.nativeElement.querySelector(
      'select[aria-label="Recipe sort order"]',
    ) as HTMLSelectElement;
    expect([...sort.options].map((option) => option.value)).toEqual([
      'Name',
      'MostPlanned',
      'MostRecentlyPlanned',
      'LeastPlanned',
      'LeastRecentlyPlanned',
    ]);
    expect(fixture.nativeElement.textContent).toContain('Favorites only');
  });

  it('applies filters together and shows removable active filters', () => {
    vi.spyOn(component, 'applyFilters').mockImplementation(() => undefined);

    component.updateFilters({ category: 'Meals', tags: ['Quick'], favoriteOnly: true });
    fixture.detectChanges();

    const activeFilters = fixture.nativeElement.querySelector(
      '[data-testid="active-filters"]',
    ) as HTMLElement;
    expect(activeFilters.textContent).toContain('Meals');
    expect(activeFilters.textContent).toContain('Quick');
    expect(activeFilters.textContent).toContain('Favorites');
    expect(component.applyFilters).toHaveBeenCalledOnce();
  });

  it('shows two columns on phones and three from the tablet breakpoint', () => {
    component.loading.set(false);
    fixture.detectChanges();

    const recipeGrid = fixture.nativeElement.querySelector(
      '[data-testid="recipe-grid"]',
    ) as HTMLElement;

    expect(recipeGrid.classList).toContain('grid-cols-2');
    expect(recipeGrid.classList).not.toContain('grid-cols-1');
    expect(recipeGrid.classList).toContain('min-[600px]:grid-cols-3');
    expect(recipeGrid.classList).not.toContain('xl:grid-cols-3');
  });
});
