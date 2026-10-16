import { Component, computed, input, signal } from '@angular/core';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import {
  RecipeCategory,
  recipeCategoryLabel,
  recipeCategories,
} from '../../models/recipe-category';

export interface RecipeCatalogFiltersValue {
  category: RecipeCategory | '';
  tags: string[];
  favoriteOnly: boolean;
}

let nextFilterFormId = 0;

@Component({
  selector: 'app-recipe-catalog-filter-form',
  imports: [AppIcon],
  templateUrl: './recipe-catalog-filter-form.html',
})
export class RecipeCatalogFilterForm {
  readonly availableTags = input<readonly string[]>([]);
  readonly categoryGroupName = `recipe-category-filter-${nextFilterFormId++}`;
  readonly tagSearchId = `${this.categoryGroupName}-tag-search`;
  readonly categoryLabel = recipeCategoryLabel;
  readonly categoryHeading = $localize`:@@recipes.recipeCatalogPage.filter.category:Category`;
  readonly tagsHeading = $localize`:@@recipes.tags:Tags`;
  readonly searchTagsPlaceholder = $localize`:@@recipes.recipeCatalogPage.filter.searchTags:Search tags...`;
  readonly selectedTagsLabel = $localize`:@@recipes.selectedTags:Selected tags`;
  readonly availableTagsLabel = $localize`:@@recipes.availableTags:Available tags`;
  readonly noMatchingTags = $localize`:@@recipes.noMatchingTags:No matching tags.`;
  readonly favoriteOnlyLabel = $localize`:@@recipes.recipeCatalogPage.favoriteOnly:Favorites only`;
  readonly categories: (RecipeCategory | '')[] = ['', ...recipeCategories];

  readonly category = signal<RecipeCategory | ''>('');
  readonly selectedTags = signal<string[]>([]);
  readonly favoriteOnly = signal(false);
  readonly tagSearch = signal('');
  readonly visibleTags = computed(() => {
    const search = this.tagSearch().trim().toLocaleLowerCase();
    return this.availableTags().filter(
      (tag) => !search || tag.toLocaleLowerCase().includes(search),
    );
  });

  resetTo(filters: RecipeCatalogFiltersValue) {
    this.category.set(filters.category);
    this.selectedTags.set([...filters.tags]);
    this.favoriteOnly.set(filters.favoriteOnly);
    this.tagSearch.set('');
  }

  reset() {
    this.resetTo({ category: '', tags: [], favoriteOnly: false });
  }

  value(): RecipeCatalogFiltersValue {
    return {
      category: this.category(),
      tags: [...this.selectedTags()],
      favoriteOnly: this.favoriteOnly(),
    };
  }

  toggleTag(tag: string) {
    this.selectedTags.update((tags) =>
      tags.includes(tag) ? tags.filter((selected) => selected !== tag) : [...tags, tag],
    );
  }

  allCategoriesLabel(category: RecipeCategory | '') {
    return category
      ? this.categoryLabel(category)
      : $localize`:@@recipes.recipeCatalogPage.filter.allCategories:All`;
  }
}
