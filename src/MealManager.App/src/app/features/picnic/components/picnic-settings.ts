import { AppIcon } from '../../../shared/components/app-icon/app-icon';
import {
  afterNextRender,
  Component,
  inject,
  Injector,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Observable, of, Subscription, switchMap, tap } from 'rxjs';
import { ApiPicnicConnection } from '../../../api/models/api-picnic';
import { PicnicStore } from '../state/picnic.store';
import { apiErrorMessage } from '../../../shared/services/api-error-message';
import { FormField } from '../../../shared/components/form-field/form-field';
import { Modal } from '../../../shared/components/modal/modal';
import { ConfirmationModal } from '../../../shared/components/confirmation-modal/confirmation-modal';

@Component({
  selector: 'app-picnic-settings',
  imports: [FormsModule, FormField, Modal, AppIcon, ConfirmationModal],
  templateUrl: './picnic-settings.html',
})
export class PicnicSettings implements OnInit, OnDestroy {
  readonly discardModal = viewChild.required<ConfirmationModal>('discardModal');
  readonly beforeDismiss = () => {
    const changed =
      this.connection()?.status === 'VerificationRequired'
        ? !!this.code.trim()
        : this.editing() &&
          (!!this.email.trim() ||
            !!this.password ||
            this.resetProductMappings ||
            this.countryCode !== (this.connection()?.countryCode ?? 'NL'));
    return !changed || this.discardModal().confirmDiscard();
  };
  private store = inject(PicnicStore);
  private readonly injector = inject(Injector);
  connection = signal<ApiPicnicConnection | null>(null);
  busy = signal(false);
  error = signal('');
  editing = signal(false);
  email = '';
  password = '';
  code = '';
  countryCode = 'NL';
  resetProductMappings = false;
  connectLabel = $localize`:@@supermarkets.connect:Connect`;
  reconnectLabel = $localize`:@@supermarkets.reconnect:Reconnect`;
  private requests = new Subscription();
  management = viewChild<Modal>('management');
  manage() {
    if (this.busy()) return;
    this.error.set('');
    if (this.connection()?.status === 'Disconnected') this.start();
    this.management()?.open();
  }
  closeManagement() {
    this.email = '';
    this.password = '';
    this.code = '';
    this.resetProductMappings = false;
    this.editing.set(false);
  }
  ngOnInit() {
    this.run(this.store.connection(), (x) => this.connection.set(x));
  }
  ngOnDestroy() {
    this.requests.unsubscribe();
    this.password = '';
  }
  status(provider: ApiPicnicConnection) {
    switch (provider.status) {
      case 'Connected':
        return $localize`:@@supermarkets.connected:Connected`;
      case 'VerificationRequired':
        return $localize`:@@supermarkets.verifyRequired:Verification required`;
      case 'ReconnectRequired':
        return $localize`:@@supermarkets.reconnectRequired:Reconnect required`;
      default:
        return $localize`:@@supermarkets.disconnected:Disconnected`;
    }
  }
  start() {
    this.editing.set(true);
    this.error.set('');
    this.email = '';
    this.password = '';
    this.code = '';
    this.countryCode = this.connection()?.countryCode ?? 'NL';
    this.resetProductMappings = false;
    this.focusManagement();
  }
  connect() {
    const password = this.password;
    this.password = '';
    this.run(
      this.store.connect(this.email, password, this.countryCode, this.resetProductMappings).pipe(
        tap((result) => this.update(result)),
        switchMap((result) =>
          result.status === 'VerificationRequired' ? this.store.requestCode() : of(result),
        ),
      ),
      (x) => this.update(x),
    );
  }
  verify() {
    this.run(this.store.verify(this.code), (x) => {
      this.update(x);
      this.code = '';
    });
  }
  resend() {
    this.run(this.store.requestCode(), (x) => this.update(x));
  }
  disconnect() {
    this.run(this.store.disconnect().pipe(switchMap(() => this.store.connection())), (x) => {
      this.connection.set(x);
      this.editing.set(false);
      this.management()?.close();
    });
  }
  private update(provider: ApiPicnicConnection) {
    const previousStatus = this.connection()?.status;
    this.connection.set(provider);
    if (provider.status === 'Connected') {
      this.editing.set(false);
      this.management()?.close();
    } else if (provider.status === 'VerificationRequired' && previousStatus !== provider.status) {
      this.focusManagement();
    }
  }
  private focusManagement() {
    afterNextRender(() => this.management()?.focusFirstControl(), { injector: this.injector });
  }
  private run<T>(request: Observable<T>, next: (value: T) => void) {
    if (this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.requests.add(
      request.subscribe({
        next: (value) => {
          next(value);
          this.busy.set(false);
          // Code requests can temporarily disable the newly rendered SMS field.
          if (this.connection()?.status === 'VerificationRequired') this.focusManagement();
        },
        error: (error) => {
          this.error.set(apiErrorMessage(error));
          this.busy.set(false);
        },
      }),
    );
  }
}
