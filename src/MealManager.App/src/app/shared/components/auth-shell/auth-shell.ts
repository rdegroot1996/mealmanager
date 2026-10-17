import { Component, input } from '@angular/core';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher';
import { AppBrand } from '../app-brand/app-brand';

@Component({
  selector: 'app-auth-shell',
  imports: [LanguageSwitcher, AppBrand],
  templateUrl: './auth-shell.html',
})
export class AuthShell {
  description = input.required<string>();
}
