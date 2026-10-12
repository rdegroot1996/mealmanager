import { ApplicationRef, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { NavigationEnd, Router, Scroll, provideRouter } from '@angular/router';
import { Subject } from 'rxjs';
import { MobileAppBar } from './mobile-app-bar';

@Component({
  imports: [MobileAppBar],
  template: '<header appMobileAppBar><button>Account</button></header>',
})
class Host {}

describe('MobileAppBar', () => {
  const events = new Subject<NavigationEnd | Scroll>();
  let bar: MobileAppBar;
  let fixture: ReturnType<typeof TestBed.createComponent<Host>>;
  let width: number;
  let y: number;

  beforeEach(() => {
    width = window.innerWidth;
    y = window.scrollY;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([]), { provide: Router, useValue: { events } }],
    });
    fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    bar = fixture.debugElement.query(By.directive(MobileAppBar)).injector.get(MobileAppBar);
  });

  afterEach(() => {
    fixture.destroy();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    vi.restoreAllMocks();
  });

  function scroll(y: number) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value: y });
    window.dispatchEvent(new Event('scroll'));
  }

  it('hides after scrolling down, filters small reversals, and reveals upward or near the top', () => {
    scroll(70);
    expect(bar.hidden()).toBe(false);
    scroll(100);
    expect(bar.hidden()).toBe(true);
    scroll(97);
    scroll(94);
    expect(bar.hidden()).toBe(true);
    scroll(92);
    expect(bar.hidden()).toBe(false);
    scroll(104);
    expect(bar.hidden()).toBe(true);
    scroll(-10);
    expect(bar.hidden()).toBe(false);
  });

  it('reveals for keyboard focus and keeps focused controls visible while scrolling', () => {
    scroll(100);
    const button = fixture.nativeElement.querySelector('button') as HTMLButtonElement;
    // jsdom does not track the browser's keyboard focus modality.
    vi.spyOn(button, 'matches').mockImplementation((selector) => selector === ':focus-visible');
    button.focus();
    expect(bar.hidden()).toBe(false);
    scroll(120);
    expect(bar.hidden()).toBe(false);
  });

  it('resets after navigation and ignores restoration movement', () => {
    let restored: FrameRequestCallback | undefined;
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      restored = callback;
      return 1;
    });
    scroll(100);
    events.next(new NavigationEnd(1, '/recipes', '/recipes'));
    expect(bar.hidden()).toBe(false);
    scroll(400);
    expect(bar.hidden()).toBe(false);
    restored!(0);
    scroll(410);
    expect(bar.hidden()).toBe(true);
  });

  it('keeps the desktop bar visible and resets when resizing', () => {
    scroll(100);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    window.dispatchEvent(new Event('resize'));
    expect(bar.hidden()).toBe(false);
    scroll(300);
    expect(bar.hidden()).toBe(false);
  });

  it('restores the saved mobile position after asynchronous content finishes loading', async () => {
    let loaded!: () => void;
    vi.spyOn(TestBed.inject(ApplicationRef), 'whenStable').mockReturnValue(
      new Promise<void>((resolve) => {
        loaded = resolve;
      }),
    );
    const restore = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    events.next(new Scroll(new NavigationEnd(2, '/planning', '/planning'), [0, 300], null));
    expect(restore).not.toHaveBeenCalled();
    loaded();
    await Promise.resolve();
    expect(restore).toHaveBeenCalledWith(0, 300);
    expect(bar.hidden()).toBe(false);
  });

  it('does not jump to a saved position after the user starts scrolling', async () => {
    let loaded!: () => void;
    vi.spyOn(TestBed.inject(ApplicationRef), 'whenStable').mockReturnValue(
      new Promise<void>((resolve) => {
        loaded = resolve;
      }),
    );
    const restore = vi.spyOn(window, 'scrollTo').mockImplementation(() => undefined);
    events.next(new Scroll(new NavigationEnd(2, '/planning', '/planning'), [0, 300], null));
    window.dispatchEvent(new Event('wheel'));
    loaded();
    await Promise.resolve();
    expect(restore).not.toHaveBeenCalled();
  });
});
