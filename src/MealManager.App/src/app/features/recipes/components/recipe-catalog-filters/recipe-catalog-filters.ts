import { Component, computed, input, output, viewChild } from '@angular/core';
import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { Modal } from '../../../../shared/components/modal/modal';
import {
  RecipeCatalogFilterForm,
  RecipeCatalogFiltersValue,
} from '../recipe-catalog-filter-form/recipe-catalog-filter-form';

@Component({
  selector: 'app-recipe-catalog-filters',
  imports: [AppIcon, Modal, RecipeCatalogFilterForm],
  templateUrl: './recipe-catalog-filters.html',
  host: { class: 'block min-w-0' },
})
export class RecipeCatalogFilters {
  readonly filterLabel = $localize`:@@recipes.filters:Filters`;
  readonly filterSubtitle = $localize`:@@recipes.filterSubtitle:Refine your recipes`;
  readonly resetLabel = $localize`:@@common.reset:Reset`;
  readonly applyLabel = $localize`:@@common.apply:Apply`;
  readonly filters = input.required<RecipeCatalogFiltersValue>();
  readonly availableTags = input<readonly string[]>([]);
  readonly applied = output<RecipeCatalogFiltersValue>();

  readonly activeFilterCount = computed(() => {
    const filters = this.filters();
    return (filters.category ? 1 : 0) + filters.tags.length + (filters.favoriteOnly ? 1 : 0);
  });

  readonly form = viewChild.required<RecipeCatalogFilterForm>('form');
  readonly modal = viewChild.required<Modal>('modal');

  open() {
    this.form().resetTo(this.filters());
    this.modal().open();
  }

  apply() {
    this.applied.emit(this.form().value());
    this.modal().close();
  }
}
