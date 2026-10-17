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
  autoSearch = input(false);
  searched = output<void>();
  private timer?: ReturnType<typeof setTimeout>;
  change(value: string, composing = false) {
    this.value.set(value);
    clearTimeout(this.timer);
    if (!this.autoSearch() || composing) return;
    if (!value) this.submit();
    else this.timer = setTimeout(() => this.submit(), 250);
  }
  submit(event?: Event) {
    event?.preventDefault();
    clearTimeout(this.timer);
    this.searched.emit();
  }
  clear() {
    this.value.set('');
    this.submit();
  }
  ngOnDestroy() {
    clearTimeout(this.timer);
  }
}
