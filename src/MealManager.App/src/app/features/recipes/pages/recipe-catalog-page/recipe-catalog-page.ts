import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { RecipesStore } from '../../state/recipes.store';
import { RouterLink } from '@angular/router';
import { RecipeCard } from '../../components/recipe-card/recipe-card';
import { FormsModule } from '@angular/forms';
import { PageHeader } from '../../../../shared/components/page-header/page-header';
import { EmptyState } from '../../../../shared/components/empty-state/empty-state';
import { SearchField } from '../../../../shared/components/search-field/search-field';
import { LoadingIndicator } from '../../../../shared/components/loading-indicator/loading-indicator';

import { Subscription } from 'rxjs';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { RecipeSearchSort } from '../../../../api/models/api-recipe-search-result';
import { RecipeCatalogFilters } from '../../components/recipe-catalog-filters/recipe-catalog-filters';
import { RecipeCatalogFiltersValue } from '../../components/recipe-catalog-filter-form/recipe-catalog-filter-form';
import { RecipeCategory, recipeCategoryLabel } from '../../models/recipe-category';

@Component({
  selector: 'app-recipe-catalog-page',
  imports: [
    RouterLink,
    RecipeCard,
    FormsModule,
    PageHeader,
    EmptyState,
    SearchField,
    LoadingIndicator,
    AppIcon,
    RecipeCatalogFilters,
  ],
  templateUrl: './recipe-catalog-page.html',
})
export class RecipeCatalogPage implements OnInit {
  readonly title = $localize`:@@navigation.recipes:Recipes`;
  readonly categoryLabel = recipeCategoryLabel;
  readonly sortAriaLabel = $localize`:@@recipes.recipeCatalogPage.sort.ariaLabel:Recipe sort order`;
  readonly sortNameLabel = $localize`:@@recipes.recipeCatalogPage.sort.name:Name`;
  readonly sortLeastPlannedLabel = $localize`:@@recipes.recipeCatalogPage.sort.leastPlanned:Least planned`;
  readonly sortLeastRecentlyPlannedLabel = $localize`:@@recipes.recipeCatalogPage.sort.leastRecentlyPlanned:Longest ago planned`;
  readonly sortMostPlannedLabel = $localize`:@@recipes.sort.mostPlanned:Most planned`;
  readonly sortMostRecentlyPlannedLabel = $localize`:@@recipes.sort.mostRecentlyPlanned:Most recently planned`;
  readonly activeFiltersLabel = $localize`:@@recipes.activeFilters:Active filters`;
  readonly favoritesLabel = $localize`:@@recipes.favorites:Favorites`;
  readonly clearAllLabel = $localize`:@@common.clearAll:Clear all`;
  readonly addRecipeLabel = $localize`:@@recipes.addRecipe:Add recipe`;
  recipeStore = inject(RecipesStore);

  private request?: Subscription;
  error = signal('');
  loading = signal(false);
  ngOnDestroy() {
    this.request?.unsubscribe();
  }
  searchQuery = signal('');
  categoryFilter = signal('');
  favoriteOnly = signal(false);
  sortOrder = signal<RecipeSearchSort>('Name');
  selectedSortLabel = computed(() => {
    switch (this.sortOrder()) {
      case 'MostPlanned':
        return this.sortMostPlannedLabel;
      case 'MostRecentlyPlanned':
        return this.sortMostRecentlyPlannedLabel;
      case 'LeastPlanned':
        return this.sortLeastPlannedLabel;
      case 'LeastRecentlyPlanned':
        return this.sortLeastRecentlyPlannedLabel;
      default:
        return this.sortNameLabel;
    }
  });
  selectedTags = signal<string[]>([]);
  allTags = signal<string[]>([]);
  filters = computed<RecipeCatalogFiltersValue>(() => ({
    category: this.categoryFilter() as RecipeCategory | '',
    tags: this.selectedTags(),
    favoriteOnly: this.favoriteOnly(),
  }));
  hasActiveFilters = computed(
    () => !!this.categoryFilter() || this.selectedTags().length > 0 || this.favoriteOnly(),
  );

  ngOnInit() {
    this.applyFilters();
  }

  applyFilters() {
    this.request?.unsubscribe();
    this.error.set('');
    this.loading.set(true);
    const unfiltered = !this.searchQuery() && !this.hasActiveFilters();
    this.request = this.recipeStore
      .loadSummaries({
        search: this.searchQuery() || undefined,
        category: this.categoryFilter() || undefined,
        tags: this.selectedTags(),
        favorite: this.favoriteOnly(),
        sort: this.sortOrder(),
      })
      .subscribe({
        next: (recipes) => {
          this.loading.set(false);
          if (unfiltered) {
            this.allTags.set(
              [...new Set(recipes.flatMap((recipe) => recipe.tags.map((tag) => tag.name)))].sort(
                (a, b) => a.localeCompare(b),
              ),
            );
          }
        },
        error: () => {
          this.loading.set(false);
          this.error.set(
            $localize`:@@recipes.recipeCatalogPage.recipesCouldNotBeLoadedPleaseRetry:Recipes could not be loaded. Please retry.`,
          );
        },
      });
  }

  updateFilters(filters: RecipeCatalogFiltersValue) {
    this.categoryFilter.set(filters.category);
    this.selectedTags.set([...filters.tags]);
    this.favoriteOnly.set(filters.favoriteOnly);
    this.applyFilters();
  }

  removeCategoryFilter() {
    this.categoryFilter.set('');
    this.applyFilters();
  }

  removeTagFilter(tag: string) {
    this.selectedTags.update((tags) => tags.filter((selected) => selected !== tag));
    this.applyFilters();
  }

  removeFavoriteFilter() {
    this.favoriteOnly.set(false);
    this.applyFilters();
  }

  clearFilters() {
    this.categoryFilter.set('');
    this.selectedTags.set([]);
    this.favoriteOnly.set(false);
    this.applyFilters();
  }

  removeFilterLabel(filter: string) {
    return $localize`:@@recipes.removeFilter:Remove ${filter}:filter: filter`;
  }
}
