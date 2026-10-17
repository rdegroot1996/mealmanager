import { TestBed } from '@angular/core/testing';
import { CookingView } from './cooking-view';

describe('CookingView', () => {
  it('requests screen awake on entry, offers a standard return, and releases on destruction', async () => {
    const secure = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
    const wake = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
    const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    const release = vi.fn(async () => {});
    const request = vi.fn(async () =>
      Object.assign(new EventTarget(), { released: false, release }),
    );
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    TestBed.configureTestingModule({ imports: [CookingView] });
    const fixture = TestBed.createComponent(CookingView);
    const profile = { id: 'p', name: 'Default', servings: 2, groceries: [] };
    fixture.componentRef.setInput('recipe', {
      id: 'r',
      name: 'Soup',
      category: 'Meals',
      baseServings: 2,
      tags: [],
      isFavorite: false,
      ingredients: [],
      steps: [{ id: 's', description: 'Heat and serve.\nKeep warm.', order: 0 }],
      images: [],
      profiles: [profile],
    });
    fixture.componentRef.setInput('profile', profile);
    fixture.componentRef.setInput('ingredients', []);
    try {
      await fixture.whenStable();
      expect(request).toHaveBeenCalledExactlyOnceWith('screen');
      expect(fixture.nativeElement.querySelector('[role="status"]').textContent).toContain(
        'Your screen stays on while cooking mode is open.',
      );
      expect(fixture.nativeElement.querySelector('ol p').textContent).toBe(
        'Heat and serve.\nKeep warm.',
      );
      fixture.componentInstance.screen.state.set('unavailable');
      fixture.componentInstance.screen.reason.set('This browser cannot keep the screen awake.');
      await fixture.whenStable();
      const statuses = fixture.nativeElement.querySelectorAll('[role="status"]');
      expect(statuses).toHaveLength(1);
      expect(statuses[0].textContent).toContain('the screen may turn off.');
      expect(statuses[0].textContent).toContain('This browser cannot keep the screen awake.');
      expect(fixture.nativeElement.querySelector('input')).toBeNull();
      const closed = vi.fn();
      fixture.componentInstance.closed.subscribe(closed);
      const back = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
      expect(back.textContent).toContain('Back to recipe');
      back.click();
      expect(closed).toHaveBeenCalledOnce();
      fixture.destroy();
      expect(release).toHaveBeenCalledOnce();
    } finally {
      if (!fixture.componentRef.hostView.destroyed) fixture.destroy();
      for (const [target, key, descriptor] of [
        [window, 'isSecureContext', secure],
        [navigator, 'wakeLock', wake],
        [document, 'visibilityState', visibility],
      ] as const) {
        if (descriptor) Object.defineProperty(target, key, descriptor);
        else Reflect.deleteProperty(target, key);
      }
    }
  });
});
