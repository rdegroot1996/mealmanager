import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { viewRecipeLabel } from '../../../core/i18n/labels';
import { AppIcon } from '../app-icon/app-icon';

@Component({
  selector: 'app-recipe-summary',
  host: { class: 'block min-w-0' },
  imports: [RouterLink, AppIcon],
  templateUrl: './recipe-summary.html',
})
export class RecipeSummary {
  readonly viewRecipeLabel = viewRecipeLabel;
  name = input.required<string>();
  imageUrl = input<string | null | undefined>();
  category = input<string | null>(null);
  profile = input<{ name: string; servings: number } | null>(null);
  recipeLink = input<(string | number)[] | null>(null);
  imageSize = input<'sm' | 'thumbnail' | 'md' | 'lg'>('md');
}
