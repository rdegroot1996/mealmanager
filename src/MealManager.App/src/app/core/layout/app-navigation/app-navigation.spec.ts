import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppNavigation } from './app-navigation';

describe('AppNavigation', () => {
  it('provides labelled links in the desktop and mobile navigation', () => {
    TestBed.configureTestingModule({
      imports: [AppNavigation],
      providers: [provideRouter([])],
    });

    const fixture = TestBed.createComponent(AppNavigation);
    fixture.componentRef.setInput('items', [{ name: 'Dashboard', route: '/', icon: 'home' }]);
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('aside a')?.getAttribute('href')).toBe('/');
    expect(element.querySelector('.app-bottom-nav a')?.getAttribute('aria-label')).toBe(
      'Dashboard',
    );
  });
});
