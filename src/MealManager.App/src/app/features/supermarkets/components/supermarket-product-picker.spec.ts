import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { SupermarketProductPicker } from './supermarket-product-picker';
import { SupermarketsStore } from '../state/supermarkets.store';
import { ApiSupermarketProduct } from '../../../api/models/api-supermarkets';
import { mockSupermarketProducts } from '../../../../mocks/supermarkets';

describe('focused supermarket product search', () => {
  let fixture: ComponentFixture<SupermarketProductPicker>;
  let component: SupermarketProductPicker;
  let search: ReturnType<typeof vi.fn>;
  beforeEach(async () => {
    search = vi.fn(() => of(mockSupermarketProducts));
    await TestBed.configureTestingModule({
      imports: [SupermarketProductPicker],
      providers: [{ provide: SupermarketsStore, useValue: { search } }],
    }).compileComponents();
    fixture = TestBed.createComponent(SupermarketProductPicker);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('provider', 'picnic');
    fixture.componentRef.setInput('row', {
      shoppingListItemId: 'a',
      recipeProfileGroceryItemId: 'slot',
      name: 'Noodles',
      quantity: 1,
      checked: false,
      group: 'Meals',
      product: null,
      selected: true,
      remember: false,
      buyQuantity: 1,
    });
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    dialog.showModal = vi.fn(() => {
      dialog.open = true;
    });
    dialog.close = vi.fn(() => {
      dialog.open = false;
      dialog.dispatchEvent(new Event('close'));
    });
  });
  afterEach(() => vi.useRealTimers());

  it('shows a spinner while searching and replaces it with product results', async () => {
    const response = new Subject<ApiSupermarketProduct[]>();
    search.mockReturnValueOnce(response);
    component.search('milk');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role="status"] .loading-spinner')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('Searching products…');
    response.next(mockSupermarketProducts);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.loading-spinner')).toBeNull();
    expect(fixture.nativeElement.querySelectorAll('img')).toHaveLength(2);
  });

  it('prefills and immediately searches the grocery name without showing a sending state', () => {
    expect(search).toHaveBeenCalledWith('picnic', 'Noodles');
    expect(component.query()).toBe('Noodles');
    expect(fixture.nativeElement.textContent).not.toContain('Sending groceries');
    expect(fixture.nativeElement.querySelectorAll('img')).toHaveLength(2);
  });

  it('debounces typing and lets Enter search immediately without a second request', () => {
    vi.useFakeTimers();
    search.mockClear();
    component.search('m', false);
    component.search('milk', false);
    vi.advanceTimersByTime(299);
    expect(search).not.toHaveBeenCalled();
    component.search();
    expect(search).toHaveBeenCalledOnce();
    expect(search).toHaveBeenCalledWith('picnic', 'milk');
    vi.advanceTimersByTime(300);
    expect(search).toHaveBeenCalledOnce();
  });

  it('ignores an old search response and keeps the search field editable', async () => {
    const old = new Subject<ApiSupermarketProduct[]>();
    const latest = new Subject<ApiSupermarketProduct[]>();
    search.mockReturnValueOnce(old).mockReturnValueOnce(latest);
    component.search('old');
    component.search('new');
    old.next([mockSupermarketProducts[0]]);
    expect(component.products()).toEqual([]);
    expect(component.searching()).toBe(true);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input').disabled).toBe(false);
    latest.next([mockSupermarketProducts[2]]);
    expect(component.products()).toEqual([mockSupermarketProducts[2]]);
    expect(component.searching()).toBe(false);
  });

  it('distinguishes empty queries, no results and a retryable search error', async () => {
    component.search('');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Enter a product name');
    search.mockReturnValueOnce(of([]));
    component.search('missing');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Try another search term');
    search.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 500 })));
    component.search('milk');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[role=alert]')).not.toBeNull();
    fixture.nativeElement.querySelector('button:not([aria-label])').click();
    expect(component.error()).toBe('');
    expect(component.products().length).toBeGreaterThan(0);
  });

  it('cannot select unavailable products and only emits mapping intent for recipe groceries', () => {
    const emit = vi.spyOn(component.selected, 'emit');
    component.choose(mockSupermarketProducts[3]);
    expect(emit).not.toHaveBeenCalled();
    component.choose(mockSupermarketProducts[0]);
    expect(emit).toHaveBeenLastCalledWith({ product: mockSupermarketProducts[0], remember: true });
  });

  it('shows availability only for products that cannot be selected', () => {
    const buttons = fixture.nativeElement.querySelectorAll(
      'li button',
    ) as NodeListOf<HTMLButtonElement>;
    const available = [...buttons].find((x) =>
      x.textContent?.includes(mockSupermarketProducts[0].name),
    )!;
    const unavailable = [...buttons].find((x) =>
      x.textContent?.includes(mockSupermarketProducts[3].name),
    )!;
    expect(available.textContent).not.toContain('Available');
    expect(available.disabled).toBe(false);
    expect(unavailable.textContent).toContain('Unavailable');
    expect(unavailable.disabled).toBe(true);
  });

  it('asks how to use a replacement and emits only after an explicit choice', async () => {
    fixture.componentRef.setInput('originalProductId', 's1001');
    fixture.componentRef.setInput('originalProductName', mockSupermarketProducts[0].name);
    await fixture.whenStable();
    const emit = vi.spyOn(component.selected, 'emit');
    component.choose(mockSupermarketProducts[1]);
    await fixture.whenStable();
    expect(emit).not.toHaveBeenCalled();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Use this product next time too?');
    expect(dialog.textContent).toContain(mockSupermarketProducts[0].name);
    expect(dialog.textContent).toContain(mockSupermarketProducts[1].name);
    const button = (name: string) =>
      [...dialog.querySelectorAll('button')].find((x) => x.textContent?.trim() === name)!;
    button('This export only').click();
    expect(emit).toHaveBeenLastCalledWith({ product: mockSupermarketProducts[1], remember: false });
    component.choose(mockSupermarketProducts[1]);
    await fixture.whenStable();
    button('Use next time too').click();
    expect(emit).toHaveBeenLastCalledWith({ product: mockSupermarketProducts[1], remember: true });
    component.choose(mockSupermarketProducts[0]);
    expect(emit).toHaveBeenLastCalledWith({ product: mockSupermarketProducts[0], remember: false });
  });

  it('returns to product selection without changing anything when going back or dismissing', async () => {
    fixture.componentRef.setInput('originalProductId', 's1001');
    await fixture.whenStable();
    const emit = vi.spyOn(component.selected, 'emit');
    component.choose(mockSupermarketProducts[1]);
    await fixture.whenStable();
    const dialog = fixture.nativeElement.querySelector('dialog') as HTMLDialogElement;
    [...dialog.querySelectorAll('button')].find((x) => x.textContent?.trim() === 'Back')!.click();
    await fixture.whenStable();
    expect(dialog.open).toBe(false);
    expect(component.replacement()).toBeNull();
    expect(emit).not.toHaveBeenCalled();
    component.choose(mockSupermarketProducts[1]);
    dialog.close();
    await fixture.whenStable();
    component.confirmReplacement(true);
    expect(emit).not.toHaveBeenCalled();
  });

  it('selects manual groceries immediately without remembering a choice', async () => {
    fixture.componentRef.setInput('row', { ...component.row(), recipeProfileGroceryItemId: null });
    fixture.componentRef.setInput('originalProductId', 's1001');
    await fixture.whenStable();
    const emit = vi.spyOn(component.selected, 'emit');
    component.choose(mockSupermarketProducts[1]);
    expect(emit).toHaveBeenCalledWith({ product: mockSupermarketProducts[1], remember: false });
    expect(component.replacement()).toBeNull();
  });
});
