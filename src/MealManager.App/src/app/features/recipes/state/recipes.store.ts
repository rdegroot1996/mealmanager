import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Recipe } from '../models/recipe';
import { ApiRecipe, ApiRecipeDetails, ApiRecipeProfile } from '../../../api/models/api-recipe';
import { ApiRecipeSummary } from '../../../api/models/api-recipe-summary';
import { filter, map, switchMap, tap } from 'rxjs';
import {
  ApiRecipeSearchResult,
  RecipeSearchSort,
} from '../../../api/models/api-recipe-search-result';

@Injectable({
  providedIn: 'root',
})
export class RecipesStore {
  private http = inject(HttpClient);

  private summaryRequest = 0;
  private recipeRequest = 0;
  private favoriteRequest = 0;
  summaries = signal<ApiRecipeSummary[]>([]);
  favoriteSummaries = signal<ApiRecipeSummary[]>([]);
  activeRecipe = signal<Recipe | null>(null);

  loadSummaries(params?: {
    category?: string;
    tags?: string[];
    search?: string;
    favorite?: boolean;
    sort?: RecipeSearchSort;
  }) {
    const request = ++this.summaryRequest;
    const query = new URLSearchParams();
    if (params?.category) query.set('category', params.category);
    for (const tag of params?.tags ?? []) query.append('tags', tag);
    if (params?.search) query.set('search', params.search);
    if (params?.favorite) query.set('favorite', 'true');
    if (params?.sort && params.sort !== 'Name') query.set('sort', params.sort);

    const qs = query.toString();
    return this.http.get<ApiRecipeSearchResult[]>(`/api/recipes${qs ? '?' + qs : ''}`).pipe(
      tap((data) => {
        if (request === this.summaryRequest) this.summaries.set(data);
      }),
    );
  }

  loadTags(search = '') {
    return this.http.get<{ name: string; recipeCount: number }[]>('/api/recipes/tags', {
      params: search.trim() ? { search: search.trim() } : {},
    });
  }

  loadRecipe(id: string) {
    const request = ++this.recipeRequest;
    return this.http.get<ApiRecipeDetails>(`/api/recipes/${id}`).pipe(
      filter(() => request === this.recipeRequest),
      map((data) => this.toRecipe(data)),
      tap((data) => this.activeRecipe.set(data)),
    );
  }

  loadFavorites() {
    const request = ++this.favoriteRequest;
    return this.http
      .get<ApiRecipeSummary[]>('/api/recipes?favorite=true&sort=RecentPlanningPopularity')
      .pipe(
        tap((data) => {
          if (request === this.favoriteRequest) this.favoriteSummaries.set(data);
        }),
      );
  }

  setFavorite(recipeId: string, isFavorite: boolean) {
    return this.http
      .put<ApiRecipeSummary>(`/api/recipes/${recipeId}/favorite`, { isFavorite })
      .pipe(
        tap((updated) => {
          this.summaries.update((items) =>
            items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)),
          );
          if (this.activeRecipe()?.id === updated.id) {
            this.activeRecipe.update((recipe) => (recipe ? { ...recipe, isFavorite } : recipe));
          }
        }),
        switchMap((updated) => this.loadFavorites().pipe(map(() => updated))),
      );
  }

  saveRecipe(recipe: Recipe) {
    const selection = this.recipeRequest;
    const request = {
      name: recipe.name,
      notes: recipe.notes ?? null,
      category: recipe.category,
      baseServings: recipe.baseServings,
      tags: recipe.tags.map((tag) => tag.name),
      ingredients: recipe.ingredients.map(({ id, name, quantity, unit }) => ({
        id,
        name,
        quantity,
        unit,
      })),
      steps: recipe.steps.map(({ id, description }) => ({ id, description })),
    };

    const save = recipe.id
      ? this.http.put<ApiRecipe>(`/api/recipes/${recipe.id}`, request)
      : this.http.post<ApiRecipe>('/api/recipes', request);
    return save.pipe(
      map((data) => this.toRecipe(data)),
      tap((data) => {
        if (selection === this.recipeRequest) this.activeRecipe.set(data);
      }),
    );
  }

  uploadImage(recipeId: string, image: File) {
    const formData = new FormData();
    formData.append('image', image);
    return this.http.post<{ id: string; url: string; order: number }>(
      `/api/recipes/${recipeId}/images`,
      formData,
    );
  }

  reorderImages(recipeId: string, imageIds: string[]) {
    return this.http.put<{ id: string; url: string; order: number }[]>(
      `/api/recipes/${recipeId}/images/order`,
      { imageIds },
    );
  }

  deleteImage(recipeId: string, imageId: string) {
    return this.http.delete(`/api/recipes/${recipeId}/images/${imageId}`);
  }

  deleteRecipe(recipeId: string) {
    return this.http.delete(`/api/recipes/${recipeId}`).pipe(
      tap(() => {
        if (this.activeRecipe()?.id === recipeId) this.activeRecipe.set(null);
        this.summaries.update((items) => items.filter((item) => item.id !== recipeId));
        this.favoriteSummaries.update((items) => items.filter((item) => item.id !== recipeId));
      }),
    );
  }

  loadProfile(id: string) {
    return this.http.get<ApiRecipeProfile>(`/api/recipe-profiles/${id}`);
  }

  saveProfile(profile: ApiRecipeProfile) {
    const recipeId = this.activeRecipe()?.id;
    const request = {
      name: profile.name,
      servings: profile.servings,
      groceries: profile.groceries.map(({ id, name, quantity, atHome }) => ({
        id,
        name,
        quantity,
        atHome,
      })),
    };
    if (profile.id) {
      return this.http.put<ApiRecipeProfile>(`/api/recipe-profiles/${profile.id}`, request).pipe(
        tap((updated) => {
          const recipe = this.activeRecipe();
          if (!recipe || recipe.id !== recipeId) return;
          const idx = recipe.profiles.findIndex((p) => p.id === updated.id);
          if (idx >= 0) {
            recipe.profiles[idx] = updated;
            this.activeRecipe.set({ ...recipe });
          }
        }),
      );
    } else {
      return this.http
        .post<ApiRecipeProfile>('/api/recipe-profiles', {
          recipeId: this.activeRecipe()!.id,
          ...request,
        })
        .pipe(
          tap((created) => {
            const recipe = this.activeRecipe();
            if (!recipe || recipe.id !== recipeId) return;
            recipe.profiles.push(created);
            this.activeRecipe.set({ ...recipe });
          }),
        );
    }
  }

  deleteProfile(profileId: string) {
    const recipeId = this.activeRecipe()?.id;
    return this.http.delete(`/api/recipe-profiles/${profileId}`).pipe(
      tap(() => {
        const recipe = this.activeRecipe();
        if (!recipe || recipe.id !== recipeId) return;
        this.activeRecipe.set({
          ...recipe,
          profiles: recipe.profiles.filter((profile) => profile.id !== profileId),
        });
      }),
    );
  }

  private toRecipe(data: ApiRecipe): Recipe {
    return {
      ...data,
      category: data.category as Recipe['category'],
      profiles: data.profiles.map((profile) => ({ ...profile, groceries: [] })),
    };
  }
}
