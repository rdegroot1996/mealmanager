import { Injectable } from '@angular/core';

export interface RecipePlanningDraft {
  cycleId: string;
  date: string;
  search: string;
  recipeId?: string;
}

/** One browser-session handoff between the meal picker and existing recipe editor. */
@Injectable({ providedIn: 'root' })
export class RecipePlanningContext {
  private key = 'mealmanager.recipe-planning-draft';
  get(): RecipePlanningDraft | null {
    try {
      const draft = JSON.parse(sessionStorage.getItem(this.key) ?? 'null');
      return draft &&
        typeof draft.cycleId === 'string' &&
        typeof draft.date === 'string' &&
        typeof draft.search === 'string'
        ? draft
        : null;
    } catch {
      return null;
    }
  }
  set(draft: RecipePlanningDraft) {
    try {
      sessionStorage.setItem(this.key, JSON.stringify(draft));
    } catch {
      /* Storage may be unavailable. */
    }
    this.fallback = draft;
  }
  private fallback: RecipePlanningDraft | null = null;
  current() {
    return this.get() ?? this.fallback;
  }
  clear() {
    this.fallback = null;
    try {
      sessionStorage.removeItem(this.key);
    } catch {
      /* Storage may be unavailable. */
    }
  }
}
