import { ComponentFixture, TestBed } from '@angular/core/testing';
import { RecipeCatalogFilters } from './recipe-catalog-filters';

describe('RecipeCatalogFilters', () => {
  let component: RecipeCatalogFilters;
  let fixture: ComponentFixture<RecipeCatalogFilters>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RecipeCatalogFilters],
    }).compileComponents();

    fixture = TestBed.createComponent(RecipeCatalogFilters);
    fixture.componentRef.setInput('filters', {
      category: 'Meals',
      tags: ['Quick', 'Asian'],
      favoriteOnly: true,
    });
    fixture.componentRef.setInput('availableTags', ['Quick', 'Asian']);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('resets a cancelled draft to the applied filters when reopened', () => {
    vi.spyOn(component.modal(), 'open').mockImplementation(() => undefined);
    const applied = vi.fn();
    component.applied.subscribe(applied);
    component.open();
    component.form().toggleTag('Asian');
    component.modal().close();
    component.open();
    expect(component.form().value().tags).toEqual(['Quick', 'Asian']);
    expect(applied).not.toHaveBeenCalled();
  });

  it('counts each active filter value', () => {
    expect(component.activeFilterCount()).toBe(4);
  });

  it('emits the complete dialog draft once when applied', () => {
    const applied = vi.fn();
    const modal = component.modal();
    const close = vi.spyOn(modal, 'close');
    vi.spyOn(modal, 'open').mockImplementation(() => undefined);
    component.applied.subscribe(applied);
    component.open();
    component.form().toggleTag('Asian');

    component.apply();

    expect(applied).toHaveBeenCalledWith({
      category: 'Meals',
      tags: ['Quick'],
      favoriteOnly: true,
    });
    expect(close).toHaveBeenCalledOnce();
  });
});
