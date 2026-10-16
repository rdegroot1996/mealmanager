import { ApplicationRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router, Scroll } from '@angular/router';
import { Subject } from 'rxjs';
import { RecipeReturnContext } from './recipe-return-context';

describe('RecipeReturnContext', () => {
  it.each([true, false])(
    'restores only after both loaded content and router scrolling (data first: %s)',
    async (dataFirst) => {
      const events = new Subject<NavigationStart | Scroll>();
      const router = { url: '/planner', events };
      const previousWidth = window.innerWidth;
      const previousTop = window.scrollY;
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
      Object.defineProperty(window, 'scrollY', { configurable: true, value: 2277 });
      const scroll = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
      TestBed.configureTestingModule({
        providers: [
          { provide: Router, useValue: router },
          { provide: ApplicationRef, useValue: { whenStable: () => Promise.resolve() } },
        ],
      });
      try {
        const context = TestBed.inject(RecipeReturnContext);
        events.next(new NavigationStart(1, '/recipes/recipe'));
        router.url = '/recipes/recipe';
        expect(context.route).toBe('/planner');
        events.next(new NavigationStart(2, '/planner'));
        router.url = '/planner';
        const routerScroll = () =>
          events.next(new Scroll(new NavigationEnd(2, '/planner', '/planner'), null, null));
        if (dataFirst) context.restore('/planner');
        else routerScroll();
        await Promise.resolve();
        expect(scroll).not.toHaveBeenCalled();
        if (dataFirst) routerScroll();
        else context.restore('/planner');
        await Promise.resolve();
        expect(scroll).toHaveBeenCalledExactlyOnceWith(0, 2277);
      } finally {
        scroll.mockRestore();
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: previousWidth });
        Object.defineProperty(window, 'scrollY', { configurable: true, value: previousTop });
      }
    },
  );
});
