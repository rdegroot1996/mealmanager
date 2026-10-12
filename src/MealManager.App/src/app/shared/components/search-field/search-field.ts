import { Component, model, output, input } from '@angular/core';
import { clearSearchLabel } from '../../../core/i18n/labels';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-search-field',
  imports: [AppIcon],
  templateUrl: './search-field.html',
})
export class SearchField {
  readonly clearSearchLabel = clearSearchLabel;
  value = model('');
  label = input($localize`:@@common.search:Search`);
  placeholder = input($localize`:@@shared.searchField.search:Search...`);
  searched = output<void>();
}
