import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { AppIcon } from '../app-icon/app-icon';
import { ToastService } from '../../services/toast.service';
import { ToastHost } from './toast-host';

describe('ToastHost', () => {
  it('renders one appropriately live message and supports manual dismissal', () => {
    const fixture = TestBed.createComponent(ToastHost);
    const toasts = TestBed.inject(ToastService);
    toasts.error('Move rejected.');
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain('Move rejected.');
    const icon = fixture.debugElement.query(By.directive(AppIcon)).componentInstance as AppIcon;
    expect(icon.name()).toBe('error');
    expect(alert.getAttribute('aria-live')).toBe('assertive');
    expect(alert.parentElement?.hasAttribute('aria-live')).toBe(false);

    (fixture.nativeElement.querySelector('button') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });
});
