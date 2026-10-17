import { TestBed } from '@angular/core/testing';
import { CookingScreenLock } from './cooking-screen-lock';

describe('CookingScreenLock', () => {
  let service: CookingScreenLock;
  let request: ReturnType<typeof vi.fn>;
  const secure = Object.getOwnPropertyDescriptor(window, 'isSecureContext');
  const wake = Object.getOwnPropertyDescriptor(navigator, 'wakeLock');
  const visibility = Object.getOwnPropertyDescriptor(document, 'visibilityState');
  function visible(value: 'visible' | 'hidden') {
    Object.defineProperty(document, 'visibilityState', { configurable: true, value });
    document.dispatchEvent(new Event('visibilitychange'));
  }
  function sentinel() {
    const lock = Object.assign(new EventTarget(), {
      released: false,
      release: vi.fn(async () => {
        lock.released = true;
        lock.dispatchEvent(new Event('release'));
      }),
    });
    return lock;
  }
  beforeEach(() => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    request = vi.fn();
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    TestBed.configureTestingModule({ providers: [CookingScreenLock] });
    service = TestBed.inject(CookingScreenLock);
  });
  afterEach(() => {
    TestBed.resetTestingModule();
    for (const [target, key, descriptor] of [
      [window, 'isSecureContext', secure],
      [navigator, 'wakeLock', wake],
      [document, 'visibilityState', visibility],
    ] as const) {
      if (descriptor) Object.defineProperty(target, key, descriptor);
      else Reflect.deleteProperty(target, key);
    }
  });
  it('requests only after opt-in and releases on disable and destruction', async () => {
    const first = sentinel(),
      second = sentinel();
    request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    expect(request).not.toHaveBeenCalled();
    service.setEnabled(true);
    expect(service.state()).toBe('requesting');
    await Promise.resolve();
    expect(request).toHaveBeenCalledWith('screen');
    expect(service.state()).toBe('active');
    service.setEnabled(false);
    expect(first.release).toHaveBeenCalledOnce();
    expect(service.state()).toBe('off');
    service.setEnabled(true);
    await Promise.resolve();
    service.ngOnDestroy();
    expect(second.release).toHaveBeenCalledOnce();
    visible('visible');
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('pauses on hiding and reacquires only while still enabled', async () => {
    const first = sentinel(),
      second = sentinel();
    request.mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    service.setEnabled(true);
    await Promise.resolve();
    visible('hidden');
    expect(service.state()).toBe('paused');
    expect(first.release).toHaveBeenCalledOnce();
    visible('visible');
    await Promise.resolve();
    expect(service.state()).toBe('active');
    second.dispatchEvent(new Event('release'));
    expect(service.state()).toBe('paused');
    service.setEnabled(false);
    visible('hidden');
    visible('visible');
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('releases a late grant after disabling or destroying the view', async () => {
    let resolve!: (lock: unknown) => void;
    request.mockReturnValue(new Promise((done) => (resolve = done)));
    service.setEnabled(true);
    service.setEnabled(false);
    const late = sentinel();
    resolve(late);
    await Promise.resolve();
    expect(late.release).toHaveBeenCalledOnce();
    expect(service.state()).toBe('off');
  });
  it('reports insecure, unsupported, and rejected requests without claiming an active lock', async () => {
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: false });
    service.setEnabled(true);
    expect(service.state()).toBe('unavailable');
    expect(service.reason()).toContain('HTTPS');
    expect(request).not.toHaveBeenCalled();
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    Reflect.deleteProperty(navigator, 'wakeLock');
    service.setEnabled(true);
    expect(service.reason()).toContain('browser');
    Object.defineProperty(navigator, 'wakeLock', { configurable: true, value: { request } });
    request.mockRejectedValue(new Error('power policy'));
    service.setEnabled(true);
    await Promise.resolve();
    expect(service.state()).toBe('unavailable');
    expect(service.reason()).toContain('battery');
  });
});
