import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RecipeSummary } from './recipe-summary';
describe('RecipeSummary', () => {
  let fixture: ComponentFixture<RecipeSummary>;
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    fixture = TestBed.createComponent(RecipeSummary);
    fixture.componentRef.setInput('name', 'Pasta');
  });
  it('supports a category without a profile', () => {
    fixture.componentRef.setInput('category', 'Meals');
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Meals');
    expect(fixture.nativeElement.querySelector('[data-testid="recipe-meal-meta"]')).toBeNull();
  });
  it('renders noninteractive profile metadata', () => {
    fixture.componentRef.setInput('profile', { name: 'Family', servings: 4 });
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Family');
    expect(fixture.nativeElement.textContent).toContain('4');
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });
  it('names navigation independently of decorative image content', () => {
    fixture.componentRef.setInput('recipeLink', ['/recipes', 'pasta']);
    fixture.componentRef.setInput('imageUrl', '/pasta.jpg');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a').getAttribute('aria-label')).toBe(
      'View recipe Pasta',
    );
    expect(fixture.nativeElement.querySelector('a').getAttribute('href')).toBe('/recipes/pasta');
    expect(fixture.nativeElement.querySelector('img').alt).toBe('');
  });
  it('provides an image fallback', () => {
    fixture.detectChanges();
    const placeholder = fixture.nativeElement.querySelector(
      '[data-testid="recipe-image-placeholder"]',
    ).parentElement as HTMLElement;
    expect(placeholder.classList).toContain('app-recipe-placeholder');
  });
  it('wraps long recipe names to at most two lines', () => {
    fixture.componentRef.setInput('name', 'A deliberately long recipe name for a narrow meal row');
    fixture.detectChanges();
    const title = fixture.nativeElement.querySelector('.line-clamp-2') as HTMLElement;
    expect(title.classList).toContain('overflow-hidden');
    expect(title.classList).toContain('text-ellipsis');
    expect(title.classList).toContain('break-words');
  });
  it('uses the supplied photo without placeholder styling', () => {
    fixture.componentRef.setInput('imageUrl', '/pasta.jpg');
    fixture.detectChanges();
    const image = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    expect(image.getAttribute('src')).toBe('/pasta.jpg');
    expect(image.parentElement?.classList).not.toContain('app-recipe-placeholder');
  });
});
