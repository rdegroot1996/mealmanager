import { ApplicationRef, inject, Injectable } from '@angular/core';
import { NavigationStart, Router, Scroll } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Retains the originating list and position across recipe details/editing. */
@Injectable({ providedIn: 'root' })
export class RecipeReturnContext {
  private router = inject(Router);
  private application = inject(ApplicationRef);
  private origin: { recipe: string; route: '/planner' | '/shopping-list'; top: number } | null =
    null;
  private pending: typeof this.origin = null;
  private dataRoute: string | null = null;
  private scrollRoute: string | null = null;

  constructor() {
    this.router.events.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event instanceof Scroll) {
        this.scrollRoute = (
          'urlAfterRedirects' in event.routerEvent
            ? event.routerEvent.urlAfterRedirects
            : event.routerEvent.url
        ).split(/[?#]/)[0];
        this.tryRestore();
        return;
      }
      if (!(event instanceof NavigationStart)) return;
      this.dataRoute = null;
      this.scrollRoute = null;
      const destination = event.url.split(/[?#]/)[0];
      const source = this.router.url.split(/[?#]/)[0];
      if (this.origin?.route === destination && source.startsWith('/recipes/'))
        this.pending = this.origin;
      if (!/^\/recipes\/[^/]+$/.test(destination) || destination === '/recipes/new') return;
      if (source === '/planner' || source === '/shopping-list') {
        this.origin = {
          recipe: destination,
          route: source,
          top:
            window.innerWidth >= 800
              ? (document.querySelector('main')?.scrollTop ?? 0)
              : window.scrollY,
        };
      } else if (!source.startsWith(destination)) {
        this.origin = null;
      }
    });
  }

  get route() {
    return this.origin?.recipe === this.router.url.split(/[?#]/)[0] ? this.origin.route : null;
  }

  requestRestore() {
    this.pending = this.origin;
  }

  restore(route: '/planner' | '/shopping-list') {
    this.dataRoute = route;
    this.tryRestore();
  }

  private tryRestore() {
    const pending = this.pending;
    if (!pending || pending.route !== this.dataRoute || pending.route !== this.scrollRoute) return;
    this.pending = null;
    void this.application.whenStable().then(() => {
      if (this.router.url.split(/[?#]/)[0] !== pending.route) return;
      if (window.innerWidth >= 800) document.querySelector('main')?.scrollTo(0, pending.top);
      else window.scrollTo(0, pending.top);
    });
  }
}
