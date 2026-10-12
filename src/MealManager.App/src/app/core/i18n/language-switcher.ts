import { Component, inject } from '@angular/core';
import { FormField } from '../../shared/components/form-field/form-field';
import { LanguageService } from './language.service';
import { SUPPORTED_LOCALES } from './locale';

@Component({
  selector: 'app-language-switcher',
  imports: [FormField],
  template: `
    <app-form-field [controlId]="controlId" label="Language" i18n-label="@@common.language">
      <select
        [id]="controlId"
        class="select w-full"
        [value]="language.locale"
        (change)="change($event)"
      >
        @for (locale of locales; track locale.id) {
          <option [value]="locale.id" [selected]="locale.id === language.locale">
            {{ locale.name }}
          </option>
        }
      </select>
    </app-form-field>
  `,
})
export class LanguageSwitcher {
  private static nextId = 0;
  readonly controlId = `language-${LanguageSwitcher.nextId++}`;
  readonly language = inject(LanguageService);
  readonly locales = SUPPORTED_LOCALES;

  async change(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (!(await this.language.change(select.value))) select.value = this.language.locale;
  }
}
