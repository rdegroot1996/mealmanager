import { Injectable, signal } from '@angular/core';

@Injectable()
export class CookingScreenLock {
  enabled = signal(false);
  state = signal<'off' | 'requesting' | 'active' | 'paused' | 'unavailable'>('off');
  reason = signal('');
  private lock: WakeLockSentinel | null = null;
  private generation = 0;
  private destroyed = false;
  private visibilityChanged = () => {
    if (!this.enabled()) return;
    if (document.visibilityState === 'visible') void this.acquire();
    else {
      ++this.generation;
      this.release();
      this.state.set('paused');
    }
  };

  constructor() {
    document.addEventListener('visibilitychange', this.visibilityChanged);
  }

  setEnabled(enabled: boolean) {
    if (this.destroyed) return;
    this.enabled.set(enabled);
    if (enabled) void this.acquire();
    else {
      ++this.generation;
      this.release();
      this.state.set('off');
      this.reason.set('');
    }
  }

  private async acquire() {
    if (this.destroyed || !this.enabled() || this.lock) return;
    const generation = ++this.generation;
    this.reason.set('');
    if (!window.isSecureContext || !('wakeLock' in navigator)) {
      this.state.set('unavailable');
      this.reason.set(
        !window.isSecureContext
          ? $localize`:@@cooking.httpsRequired:Keeping the screen awake requires HTTPS. You can still use cooking mode.`
          : $localize`:@@cooking.unsupported:This browser cannot keep the screen awake. You can still use cooking mode.`,
      );
      return;
    }
    if (document.visibilityState !== 'visible') {
      this.state.set('paused');
      return;
    }
    this.state.set('requesting');
    try {
      const lock = await navigator.wakeLock.request('screen');
      if (
        this.destroyed ||
        generation !== this.generation ||
        !this.enabled() ||
        document.visibilityState !== 'visible'
      ) {
        void lock.release().catch(() => {});
        return;
      }
      this.lock = lock;
      if (lock.released) {
        this.lock = null;
        this.state.set('paused');
        return;
      }
      this.state.set('active');
      lock.addEventListener(
        'release',
        () => {
          if (this.lock !== lock) return;
          this.lock = null;
          this.state.set(this.enabled() ? 'paused' : 'off');
        },
        { once: true },
      );
    } catch {
      if (this.destroyed || generation !== this.generation) return;
      this.state.set('unavailable');
      this.reason.set(
        $localize`:@@cooking.denied:The device or browser could not keep the screen awake. Check battery-saving settings or try again.`,
      );
    }
  }

  private release() {
    const lock = this.lock;
    this.lock = null;
    if (lock) void lock.release().catch(() => {});
  }
  ngOnDestroy() {
    this.destroyed = true;
    ++this.generation;
    this.enabled.set(false);
    this.release();
    document.removeEventListener('visibilitychange', this.visibilityChanged);
  }
}
