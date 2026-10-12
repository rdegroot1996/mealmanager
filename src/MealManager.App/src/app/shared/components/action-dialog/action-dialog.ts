import {
  afterNextRender,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { AppIcon } from '../app-icon/app-icon';
import { Modal } from '../modal/modal';

@Component({
  selector: 'app-action-dialog',
  imports: [AppIcon, Modal],
  templateUrl: './action-dialog.html',
})
export class ActionDialog {
  label = input.required<string>();
  title = input('');
  disabled = input(false);
  compact = input(false);
  triggerIcon = input('more_vert');
  modal = viewChild.required<Modal>('modal');
  actions = viewChild.required<ElementRef<HTMLElement>>('actions');
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    afterNextRender(() => {
      const actions = this.actions().nativeElement;
      const closeBeforeAction = (event: MouseEvent) => {
        const action = (event.target as HTMLElement).closest<HTMLButtonElement | HTMLAnchorElement>(
          'button, a',
        );
        if (
          !action ||
          !actions.contains(action) ||
          action.matches(':disabled, [aria-disabled="true"]')
        )
          return;
        this.modal().close();
      };
      // Close the options sheet before the projected action opens an editing dialog.
      actions.addEventListener('click', closeBeforeAction, true);
      this.destroyRef.onDestroy(() =>
        actions.removeEventListener('click', closeBeforeAction, true),
      );
    });
  }

  open() {
    if (!this.disabled()) this.modal().open();
  }
}
