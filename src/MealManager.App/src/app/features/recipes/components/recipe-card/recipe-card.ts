import { Component, input } from '@angular/core';
import { ApiRecipeSummary } from '../../../../api/models/api-recipe-summary';
import { RouterLink } from '@angular/router';
import { recipeCategoryLabel } from '../../models/recipe-category';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { RecipeFavoriteButton } from '../recipe-favorite-button/recipe-favorite-button';

@Component({
  selector: 'app-recipe-card',
  imports: [RouterLink, AppIcon, RecipeFavoriteButton],
  templateUrl: './recipe-card.html',
})
export class RecipeCard {
  readonly categoryLabel = recipeCategoryLabel;
  recipe = input.required<ApiRecipeSummary>();
}
