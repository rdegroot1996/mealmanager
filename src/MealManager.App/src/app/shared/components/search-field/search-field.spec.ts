import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SearchField } from './search-field';

describe('SearchField', () => {
  let fixture: ComponentFixture<SearchField>;
  let component: SearchField;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [SearchField] }).compileComponents();
    fixture = TestBed.createComponent(SearchField);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('updates and submits its value', () => {
    const searched = vi.fn();
    component.searched.subscribe(searched);
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;

    input.value = 'Pasta';
    input.dispatchEvent(new Event('input'));
    input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter' }));

    expect(component.value()).toBe('Pasta');
    expect(searched).toHaveBeenCalledOnce();
  });
});
