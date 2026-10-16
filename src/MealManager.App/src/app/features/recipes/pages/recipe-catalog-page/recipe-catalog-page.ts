import {
  ApplicationRef,
  Component,
  computed,
  ElementRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RecipesStore } from '../../state/recipes.store';
import { ActivatedRoute, NavigationStart, Params, Router, RouterLink } from '@angular/router';
import { RecipeCatalogContext } from '../../state/recipe-catalog-context';
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
import {
  recipeCategories,
  RecipeCategory,
  recipeCategoryLabel,
} from '../../models/recipe-category';

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
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private context = inject(RecipeCatalogContext);
  private element = inject<ElementRef<HTMLElement>>(ElementRef);
  private application = inject(ApplicationRef);
  private routeRequest?: Subscription;
  private navigationRequest?: Subscription;
  private tagsRequest?: Subscription;
  private restoreScroll = true;
  private destroyed = false;

  private request?: Subscription;
  error = signal('');
  loading = signal(false);
  ngOnDestroy() {
    this.destroyed = true;
    this.request?.unsubscribe();
    this.routeRequest?.unsubscribe();
    this.navigationRequest?.unsubscribe();
    this.tagsRequest?.unsubscribe();
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
    this.navigationRequest = this.router.events.subscribe((event) => {
      if (!(event instanceof NavigationStart) || event.url.split(/[?#]/)[0] === '/recipes') return;
      const main = this.element.nativeElement.closest('main');
      this.context.scroll = {
        key: JSON.stringify(this.catalogParams()),
        top: window.innerWidth >= 800 && main ? main.scrollTop : window.scrollY,
      };
    });
    let initialized = false;
    this.routeRequest = this.route.queryParamMap.subscribe((params) => {
      const previous = JSON.stringify(this.catalogParams());
      this.searchQuery.set(params.get('q') ?? '');
      const category = params.get('category') ?? '';
      this.categoryFilter.set(
        recipeCategories.includes(category as RecipeCategory) ? category : '',
      );
      this.selectedTags.set([
        ...new Set(
          params
            .getAll('tag')
            .map((tag) => tag.trim())
            .filter(Boolean),
        ),
      ]);
      this.favoriteOnly.set(params.get('favorite') === '1');
      const sort = params.get('sort');
      this.sortOrder.set(
        [
          'Name',
          'MostPlanned',
          'LeastPlanned',
          'MostRecentlyPlanned',
          'LeastRecentlyPlanned',
        ].includes(sort ?? '')
          ? (sort as RecipeSearchSort)
          : 'Name',
      );
      this.context.queryParams = this.catalogParams();
      if (!initialized || previous !== JSON.stringify(this.catalogParams())) this.loadRecipes();
      initialized = true;
    });
  }

  changeSearch(query: string) {
    this.request?.unsubscribe();
    this.searchQuery.set(query);
    this.loading.set(true);
  }

  applyFilters() {
    this.restoreScroll = false;
    this.context.scroll = null;
    this.context.queryParams = this.catalogParams();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: this.context.queryParams,
      replaceUrl: true,
    });
    this.loadRecipes();
  }

  private catalogParams(): Params {
    const params: Params = {};
    if (this.searchQuery()) params['q'] = this.searchQuery();
    if (this.categoryFilter()) params['category'] = this.categoryFilter();
    if (this.selectedTags().length) params['tag'] = this.selectedTags();
    if (this.favoriteOnly()) params['favorite'] = '1';
    if (this.sortOrder() !== 'Name') params['sort'] = this.sortOrder();
    return params;
  }

  private loadRecipes() {
    this.request?.unsubscribe();
    this.error.set('');
    this.loading.set(true);
    const unfiltered = !this.searchQuery() && !this.hasActiveFilters();
    if (!unfiltered && !this.allTags().length && !this.tagsRequest) {
      this.tagsRequest = this.recipeStore.loadTags().subscribe({
        next: (tags) =>
          this.allTags.set(tags.map((tag) => tag.name).sort((a, b) => a.localeCompare(b))),
        error: () => {
          this.tagsRequest = undefined;
        },
      });
    }
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
          if (this.restoreScroll) {
            this.restoreScroll = false;
            const scroll = this.context.scroll;
            if (scroll?.key === JSON.stringify(this.catalogParams())) {
              // Wait for both the result view and the router's own scroll reset.
              void this.application.whenStable().then(() => {
                if (
                  this.destroyed ||
                  this.context.scroll !== scroll ||
                  scroll.key !== JSON.stringify(this.catalogParams())
                )
                  return;
                const main = this.element.nativeElement.closest('main');
                if (window.innerWidth >= 800 && main) main.scrollTop = scroll.top;
                else window.scrollTo(0, scroll.top);
              });
            }
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
