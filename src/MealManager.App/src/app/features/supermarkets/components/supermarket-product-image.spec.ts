import { TestBed } from '@angular/core/testing';
import { SupermarketProductImage } from './supermarket-product-image';
import { mockSupermarketProducts } from '../../../../mocks/supermarkets';

describe('supermarket product image', () => {
  it('reserves the same image area for missing, available and broken images', async () => {
    const fixture = TestBed.createComponent(SupermarketProductImage);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('app-icon')).not.toBeNull();
    const area = fixture.nativeElement.querySelector('.size-16');
    fixture.componentRef.setInput('product', {
      ...mockSupermarketProducts[0],
      imageUrl: '/product.png',
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('.size-16')).toBe(area);
    fixture.nativeElement.querySelector('img').dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('img')).toBeNull();
    expect(fixture.nativeElement.querySelector('app-icon')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('.size-16')).toBe(area);
    fixture.componentRef.setInput('size', 'large');
    await fixture.whenStable();
    expect(area.classList).toContain('sm:size-20');
  });
});
