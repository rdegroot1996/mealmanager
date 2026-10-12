import { Component, input } from '@angular/core';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-empty-state',
  imports: [AppIcon],
  templateUrl: './empty-state.html',
})
export class EmptyState {
  title = input.required<string>();
  description = input<string | null>(null);
  icon = input('inbox');
  embedded = input(false);
}
