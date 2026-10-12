import {
  ApplicationRef,
  DestroyRef,
  Directive,
  ElementRef,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { NavigationEnd, Router, Scroll } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/** Reveals the mobile app bar on upward scroll without moving page content. */
@Directive({
  selector: '[appMobileAppBar]',
  host: { '[class]': "hidden() ? 'max-[800px]:-translate-y-full' : ''" },
})
export class MobileAppBar {
  readonly hidden = signal(false);
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly element = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly application = inject(ApplicationRef);
  private lastY = 0;
  private travel = 0;
  private restoring = false;
  private navigation = 0;

  constructor() {
    inject(DestroyRef).onDestroy(() => ++this.navigation);
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationEnd || event instanceof Scroll) {
          const navigation = ++this.navigation;
          this.hidden.set(false);
          this.restoring = true;
          const position = event instanceof Scroll ? event.position : null;
          // The loading view may be too short for Back/Forward's saved position.
          if (position && this.window && this.window.innerWidth < 800) {
            void this.application.whenStable().then(() => {
              if (navigation !== this.navigation) return;
              this.window?.scrollTo(position[0], position[1]);
              this.reset();
              this.restoring = false;
            });
          }
          this.window?.requestAnimationFrame(() => {
            if (navigation !== this.navigation) return;
            this.reset();
            if (!position || this.window!.innerWidth >= 800) this.restoring = false;
          });
        }
      });
  }

  @HostListener('window:wheel')
  @HostListener('window:touchstart')
  @HostListener('window:pointerdown')
  @HostListener('window:keydown')
  cancelRestoration() {
    if (!this.restoring) return;
    ++this.navigation;
    this.restoring = false;
    this.reset();
  }

  @HostListener('window:scroll')
  onScroll() {
    const window = this.window;
    if (!window) return;
    const y = Math.max(0, window.scrollY);
    const delta = y - this.lastY;
    this.lastY = y;
    if (
      window.innerWidth >= 800 ||
      y <= 72 ||
      this.restoring ||
      (this.element.nativeElement.contains(window.document.activeElement) &&
        !!window.document.activeElement?.matches(':focus-visible'))
    ) {
      this.hidden.set(false);
      this.travel = 0;
      return;
    }
    this.travel = Math.sign(delta) === Math.sign(this.travel) ? this.travel + delta : delta;
    if (Math.abs(this.travel) >= 8) {
      this.hidden.set(this.travel > 0);
      this.travel = 0;
    }
  }

  @HostListener('focusin')
  @HostListener('window:resize')
  reset() {
    this.lastY = Math.max(0, this.window?.scrollY ?? 0);
    this.travel = 0;
    this.hidden.set(false);
  }
}
