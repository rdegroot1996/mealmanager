import { Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-indicator',
  templateUrl: './loading-indicator.html',
})
export class LoadingIndicator {
  message = input($localize`:@@shared.loadingIndicator.loading:Loading…`);
  compact = input(false);
  description = input('');
}
