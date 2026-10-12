import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecipeCatalogFilterForm } from './recipe-catalog-filter-form';

describe('RecipeCatalogFilterForm', () => {
  let component: RecipeCatalogFilterForm;
  let fixture: ComponentFixture<RecipeCatalogFilterForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeCatalogFilterForm],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeCatalogFilterForm);
    fixture.componentRef.setInput('availableTags', ['Asian', 'Quick', 'Vegetarian']);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('copies applied filters into an isolated draft', () => {
    const applied = { category: 'Meals' as const, tags: ['Quick'], favoriteOnly: true };

    component.resetTo(applied);
    component.selectedTags.update((tags) => [...tags, 'Asian']);

    expect(component.value()).toEqual({
      category: 'Meals',
      tags: ['Quick', 'Asian'],
      favoriteOnly: true,
    });
    expect(applied.tags).toEqual(['Quick']);
  });

  it('searches labels inline and resets every draft filter', () => {
    component.resetTo({ category: 'Meals', tags: ['Quick'], favoriteOnly: true });
    component.tagSearch.set('veg');

    expect(component.visibleTags()).toEqual(['Vegetarian']);

    component.reset();

    expect(component.value()).toEqual({ category: '', tags: [], favoriteOnly: false });
    expect(component.tagSearch()).toBe('');
  });
});
