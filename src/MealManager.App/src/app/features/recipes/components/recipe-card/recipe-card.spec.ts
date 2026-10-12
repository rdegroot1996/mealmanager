import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RecipeCard } from './recipe-card';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

describe('RecipeCard', () => {
  let component: RecipeCard;
  let fixture: ComponentFixture<RecipeCard>;
  let http: HttpTestingController;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeCard],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeCard);
    fixture.componentRef.setInput('recipe', {
      id: 'recipe-1',
      name: 'Test recipe',
      category: 'Meals',
      tags: [],
      imageUrl: null,
      isFavorite: false,
    });
    component = fixture.componentInstance;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('uses the shared recipe placeholder for a missing image', () => {
    fixture.detectChanges();
    const placeholder = fixture.nativeElement.querySelector(
      '[data-testid="recipe-image-placeholder"]',
    ) as HTMLElement;

    expect(placeholder.classList).toContain('aspect-[1.18]');
    expect(placeholder.classList).toContain('app-recipe-placeholder');
    expect(placeholder.classList).not.toContain('bg-base-200');
    expect(placeholder.classList).not.toContain('bg-base-100');
  });

  it('uses a width-relative image ratio', () => {
    fixture.detectChanges();

    const placeholder = fixture.nativeElement.querySelector(
      '[data-testid="recipe-image-placeholder"]',
    ) as HTMLElement;

    expect(placeholder.classList).toContain('aspect-[1.18]');
    expect(placeholder.classList).not.toContain('h-48');
  });

  it('groups the icon-led category with the title and keeps labels compact', () => {
    fixture.componentRef.setInput('recipe', {
      id: 'recipe-1',
      name: 'Test recipe',
      category: 'Meals',
      tags: [{ id: 'tag-1', name: 'Quick' }],
      imageUrl: null,
      isFavorite: false,
    });
    fixture.detectChanges();

    const body = fixture.nativeElement.querySelector('a > div') as HTMLElement;
    const heading = body.querySelector('[data-testid="recipe-heading"]') as HTMLElement;
    const title = heading.querySelector('h2') as HTMLElement;
    const category = heading.querySelector('[data-testid="recipe-category"]') as HTMLElement;
    const tags = body.querySelector('[data-testid="recipe-tags"]') as HTMLElement;
    const tag = tags.querySelector('span') as HTMLElement;

    expect(title.nextElementSibling).toBe(category);
    expect(heading.nextElementSibling).toBe(tags);
    expect(title.classList).toContain('line-clamp-2');
    expect(title.classList).toContain('text-sm');
    expect(category.querySelector('app-icon[name="restaurant"]')).toBeTruthy();
    expect(tags.classList).not.toContain('mt-auto');
    expect(tag.classList).toContain('badge');
    expect(tag.classList).toContain('badge-secondary');
    expect(tags.textContent).toContain('Quick');
  });

  it('uses the persisted favorite endpoint and exposes pressed state', () => {
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    expect(button.getAttribute('aria-pressed')).toBe('false');

    button.click();
    const request = http.expectOne('/api/recipes/recipe-1/favorite');
    expect(request.request.body).toEqual({ isFavorite: true });
    request.flush({
      id: 'recipe-1',
      name: 'Test recipe',
      category: 'Meals',
      tags: [],
      imageUrl: null,
      isFavorite: true,
    });
  });

  it('fills the heart when the recipe is a favorite', () => {
    fixture.componentRef.setInput('recipe', {
      id: 'recipe-1',
      name: 'Test recipe',
      category: 'Meals',
      tags: [],
      imageUrl: null,
      isFavorite: true,
    });
    fixture.detectChanges();

    const icon = fixture.nativeElement.querySelector('app-icon[name="favorite"] svg');
    expect(icon.classList).toContain('fill-current');
    expect(icon.classList).not.toContain('fill-none');
  });
});
