import { Injectable } from '@angular/core';
import { Params } from '@angular/router';

/** Return context for the catalog; filters themselves are represented in the URL. */
@Injectable({ providedIn: 'root' })
export class RecipeCatalogContext {
  queryParams: Params = {};
  scroll: { key: string; top: number } | null = null;
}
