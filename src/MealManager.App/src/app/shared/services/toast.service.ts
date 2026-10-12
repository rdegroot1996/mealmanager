import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info';
export interface ToastMessage {
  id: number;
  kind: ToastKind;
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 0;
  messages = signal<ToastMessage[]>([]);
  show(kind: ToastKind, message: string, timeout = 5000) {
    const toast = { id: ++this.nextId, kind, message };
    this.messages.update((messages) => [...messages, toast]);
    window.setTimeout(() => this.dismiss(toast.id), timeout);
  }
  success(message: string) {
    this.show('success', message);
  }
  error(message: string) {
    this.show('error', message, 7000);
  }
  info(message: string) {
    this.show('info', message);
  }
  dismiss(id: number) {
    this.messages.update((messages) => messages.filter((message) => message.id !== id));
  }
}
