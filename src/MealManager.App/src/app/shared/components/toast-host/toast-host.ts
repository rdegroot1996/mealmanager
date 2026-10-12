import { Component, inject } from '@angular/core';
import { ToastService } from '../../services/toast.service';
import { AppIcon } from '../app-icon/app-icon';

@Component({ selector: 'app-toast-host', imports: [AppIcon], templateUrl: './toast-host.html' })
export class ToastHost {
  readonly toasts = inject(ToastService);
}
