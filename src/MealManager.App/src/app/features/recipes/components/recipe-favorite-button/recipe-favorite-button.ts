import { Component, inject, input, signal } from '@angular/core';
import { ApiRecipeSummary } from '../../../../api/models/api-recipe-summary';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { ToastService } from '../../../../shared/services/toast.service';
import { RecipesStore } from '../../state/recipes.store';

@Component({
  selector: 'app-recipe-favorite-button',
  imports: [AppIcon],
  host: { class: 'absolute right-3 top-3 z-10' },
  templateUrl: './recipe-favorite-button.html',
})
export class RecipeFavoriteButton {
  private recipeStore = inject(RecipesStore);
  private toast = inject(ToastService);

  recipe = input.required<Pick<ApiRecipeSummary, 'id' | 'name' | 'isFavorite'>>();
  pending = signal(false);

  actionLabel(): string {
    const name = this.recipe().name;
    return this.recipe().isFavorite
      ? $localize`:@@recipes.removeNamedFavorite:Remove ${name}:recipeName: from favorites`
      : $localize`:@@recipes.addNamedFavorite:Add ${name}:recipeName: to favorites`;
  }

  toggle() {
    if (this.pending()) return;
    const recipe = this.recipe();
    this.pending.set(true);
    this.recipeStore.setFavorite(recipe.id, !recipe.isFavorite).subscribe({
      next: () => this.pending.set(false),
      error: () => {
        this.pending.set(false);
        this.toast.error(
          $localize`:@@recipes.recipeCard.favoriteCouldNotBeUpdated:Favorite could not be updated.`,
        );
      },
    });
  }
}
