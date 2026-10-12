import { Injectable, inject, LOCALE_ID } from '@angular/core';
import { AppLocale, isAppLocale, LANGUAGE_STORAGE_KEY } from './locale';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  readonly locale = inject(LOCALE_ID) as AppLocale;
  private beforeSwitch?: () => boolean | Promise<boolean>;
  private beforeReload?: () => void;

  registerBeforeSwitch(
    callback: () => boolean | Promise<boolean>,
    beforeReload?: () => void,
  ): () => void {
    this.beforeSwitch = callback;
    this.beforeReload = beforeReload;
    return () => {
      if (this.beforeSwitch === callback) {
        this.beforeSwitch = undefined;
        this.beforeReload = undefined;
      }
    };
  }

  async change(locale: string): Promise<boolean> {
    if (!isAppLocale(locale) || locale === this.locale) return false;
    if (this.beforeSwitch && !(await this.beforeSwitch())) return false;
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
      try {
        sessionStorage.removeItem(LANGUAGE_STORAGE_KEY);
      } catch {
        try {
          sessionStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
        } catch {
          // Storage access is blocked; the persistent choice remains available.
        }
      }
    } catch {
      try {
        sessionStorage.setItem(LANGUAGE_STORAGE_KEY, locale);
      } catch {
        return false;
      }
    }
    this.beforeReload?.();
    window.location.reload();
    return true;
  }
}
