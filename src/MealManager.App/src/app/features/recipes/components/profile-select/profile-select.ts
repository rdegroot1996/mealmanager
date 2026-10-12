import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface RecipeProfileOption {
  id: string;
  name: string;
  servings: number;
}

@Component({
  selector: 'app-profile-select',
  imports: [FormsModule],
  templateUrl: './profile-select.html',
})
export class ProfileSelect {
  profiles = input.required<RecipeProfileOption[]>();
  selectedProfileId = model.required<string>();
  disabled = input(false);
  label = input($localize`:@@common.profile:Profile`);
  showLabel = input(true);
  placeholder = input<string | null>(null);
}
