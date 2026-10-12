import { TestBed } from '@angular/core/testing';
import { AppIcon } from './app-icon';

describe('AppIcon', () => {
  it('renders a named icon as a decorative hand-drawn svg', () => {
    const fixture = TestBed.createComponent(AppIcon);
    fixture.componentRef.setInput('name', 'home');
    fixture.detectChanges();

    const host = fixture.nativeElement as HTMLElement;
    const svg = host.querySelector('svg');
    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.querySelector('path')?.getAttribute('d')).toContain('c');
  });

  it('falls back to the restaurant glyph for an unknown name', () => {
    const fallback = TestBed.createComponent(AppIcon);
    fallback.componentRef.setInput('name', 'unknown');
    fallback.detectChanges();

    const restaurant = TestBed.createComponent(AppIcon);
    restaurant.componentRef.setInput('name', 'restaurant');
    restaurant.detectChanges();

    const fallbackPaths = [...fallback.nativeElement.querySelectorAll('path')].map((path) =>
      path.getAttribute('d'),
    );
    const restaurantPaths = [...restaurant.nativeElement.querySelectorAll('path')].map((path) =>
      path.getAttribute('d'),
    );
    expect(fallbackPaths).toEqual(restaurantPaths);
  });

  it('switches between outlined and filled rendering', () => {
    const fixture = TestBed.createComponent(AppIcon);
    fixture.componentRef.setInput('name', 'favorite');
    fixture.componentRef.setInput('filled', true);
    fixture.detectChanges();

    const svg = fixture.nativeElement.querySelector('svg') as SVGElement;
    expect(svg.classList).toContain('fill-current');
    expect(svg.classList).not.toContain('fill-none');
  });

  it('normalizes optically oversized glyphs within the shared view box', () => {
    const fixture = TestBed.createComponent(AppIcon);
    fixture.componentRef.setInput('name', 'skillet');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('g')?.getAttribute('transform')).toContain(
      'scale(0.82)',
    );
  });
});
