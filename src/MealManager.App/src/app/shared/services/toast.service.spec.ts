import { ToastService } from './toast.service';

describe('ToastService', () => {
  it('adds and dismisses a toast', () => {
    const service = new ToastService();
    service.show('success', 'Saved', 60_000);
    expect(service.messages()).toHaveLength(1);
    service.dismiss(service.messages()[0].id);
    expect(service.messages()).toEqual([]);
  });

  it('automatically dismisses a toast after its timeout', () => {
    vi.useFakeTimers();
    const service = new ToastService();
    service.show('info', 'Saved', 1000);

    vi.advanceTimersByTime(1000);

    expect(service.messages()).toEqual([]);
    vi.useRealTimers();
  });
});
