import { Component, input } from '@angular/core';
import { LanguageSwitcher } from '../../../core/i18n/language-switcher';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-auth-shell',
  imports: [LanguageSwitcher, AppIcon],
  templateUrl: './auth-shell.html',
})
export class AuthShell {
  title = input.required<string>();
  description = input.required<string>();
}
