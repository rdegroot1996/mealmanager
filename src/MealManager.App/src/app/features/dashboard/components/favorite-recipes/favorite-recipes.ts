import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { RecipesStore } from '../../../recipes/state/recipes.store';
import { RouterLink } from '@angular/router';
import { openRecipeLabel } from '../../../../core/i18n/labels';
import { RecipeFavoriteButton } from '../../../recipes/components/recipe-favorite-button/recipe-favorite-button';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';

import { Subscription } from 'rxjs';

@Component({
  selector: 'app-favorite-recipes',
  imports: [RouterLink, AppIcon, RecipeFavoriteButton],
  templateUrl: './favorite-recipes.html',
})
export class FavoriteRecipes implements OnInit {
  readonly openRecipeLabel = openRecipeLabel;
  recipeStore = inject(RecipesStore);

  favoriteRecipes = this.recipeStore.favoriteSummaries;
  carousel = viewChild<ElementRef<HTMLElement>>('carousel');
  currentPage = signal(0);
  pageCount = computed(() => Math.ceil(this.favoriteRecipes().length / 4));
  pages = computed(() => Array.from({ length: this.pageCount() }, (_, index) => index));
  recipePages = computed(() => {
    const recipes = this.favoriteRecipes();
    return this.pages().map((page) => recipes.slice(page * 4, (page + 1) * 4));
  });

  constructor() {
    effect(() => {
      const lastPage = this.pageCount() - 1;
      if (lastPage >= 0 && this.currentPage() > lastPage) this.goToPage(lastPage);
    });
    effect((onCleanup) => {
      const carousel = this.carousel()?.nativeElement;
      if (!carousel || typeof ResizeObserver === 'undefined') return;
      const observer = new ResizeObserver(() => {
        const page = this.pageElements()[this.currentPage()];
        if (page)
          carousel.scrollTo({ left: page.offsetLeft - carousel.offsetLeft, behavior: 'instant' });
        this.updateCurrentPage();
      });
      observer.observe(carousel);
      onCleanup(() => observer.disconnect());
    });
  }

  loading = signal(false);
  error = signal('');
  private request?: Subscription;
  ngOnInit() {
    this.load();
  }
  ngOnDestroy() {
    this.request?.unsubscribe();
  }
  load() {
    this.request?.unsubscribe();
    this.loading.set(true);
    this.error.set('');
    this.request = this.recipeStore.loadFavorites().subscribe({
      next: () => this.loading.set(false),
      error: () => {
        this.loading.set(false);
        this.error.set(
          $localize`:@@dashboard.favoriteRecipes.recipesCouldNotBeLoaded:Recipes could not be loaded.`,
        );
      },
    });
  }

  updateCurrentPage() {
    const carousel = this.carousel()?.nativeElement;
    if (!carousel?.clientWidth) return;
    this.currentPage.set(
      Math.min(
        this.pageCount() - 1,
        Math.max(
          0,
          this.pageElements().reduce(
            (best, element, index, pages) =>
              Math.abs(element.offsetLeft - carousel.offsetLeft - carousel.scrollLeft) <
              Math.abs(pages[best].offsetLeft - carousel.offsetLeft - carousel.scrollLeft)
                ? index
                : best,
            0,
          ),
        ),
      ),
    );
  }

  private pageElements(): HTMLElement[] {
    return Array.from(
      this.carousel()?.nativeElement.querySelectorAll<HTMLElement>(
        '[data-testid="favorite-page"]',
      ) ?? [],
    );
  }

  goToPage(page: number) {
    const carousel = this.carousel()?.nativeElement;
    if (!carousel) return;
    const nextPage = Math.min(this.pageCount() - 1, Math.max(0, page));
    this.currentPage.set(nextPage);
    const element = this.pageElements()[nextPage];
    if (element) carousel.scrollTo({ left: element.offsetLeft - carousel.offsetLeft });
  }
}
