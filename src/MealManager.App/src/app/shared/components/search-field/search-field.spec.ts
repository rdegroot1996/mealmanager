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
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));

    expect(component.value()).toBe('Pasta');
    expect(searched).toHaveBeenCalledOnce();
  });
  it('debounces typing, submits Enter immediately, and cancels a pending search on clear', () => {
    vi.useFakeTimers();
    try {
      fixture.componentRef.setInput('autoSearch', true);
      const searched = vi.fn();
      component.searched.subscribe(searched);
      component.change('Pa');
      vi.advanceTimersByTime(100);
      component.change('Pasta');
      vi.advanceTimersByTime(249);
      expect(searched).not.toHaveBeenCalled();
      vi.advanceTimersByTime(1);
      expect(searched).toHaveBeenCalledTimes(1);
      component.change('Soup');
      component.submit();
      vi.advanceTimersByTime(500);
      expect(searched).toHaveBeenCalledTimes(2);
      component.change('Rice');
      component.clear();
      vi.advanceTimersByTime(500);
      expect(component.value()).toBe('');
      expect(searched).toHaveBeenCalledTimes(3);
      component.change('Cake');
      fixture.destroy();
      vi.advanceTimersByTime(500);
      expect(searched).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
