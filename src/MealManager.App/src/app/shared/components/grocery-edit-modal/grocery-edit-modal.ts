import { AppIcon } from '../app-icon/app-icon';
import { Component, ElementRef, input, output, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Modal } from '../modal/modal';
import { ConfirmationModal } from '../confirmation-modal/confirmation-modal';
import { FormField } from '../form-field/form-field';
import { NumberInput } from '../number-input/number-input';

export interface GroceryDraft {
  name: string;
  quantity: number;
}

@Component({
  selector: 'app-grocery-edit-modal',
  imports: [ConfirmationModal, AppIcon, Modal, FormsModule, FormField, NumberInput],
  templateUrl: './grocery-edit-modal.html',
})
export class GroceryEditModal {
  private savedDraft = '';
  readonly discardModal = viewChild.required<ConfirmationModal>('discardModal');
  readonly beforeDismiss = () =>
    this.draftSnapshot() === this.savedDraft || this.discardModal().confirmDiscard();
  private draftSnapshot() {
    return JSON.stringify([this.draftName().trim(), this.draftQuantity()]);
  }

  private static nextId = 0;
  private readonly id = ++GroceryEditModal.nextId;
  disabled = input(false);
  closeOnSave = input(true);
  saveError = input<string | null>(null);
  context = input('');
  suggestions = input<string[]>([]);
  suggestionsEnabled = input(false);
  suggestionsLoading = input(false);
  suggestionsError = input(false);
  nameQueryChanged = output<string>();
  saved = output<GroceryDraft>();
  removed = output<void>();
  closed = output<void>();
  readonly modal = viewChild.required<Modal>('modal');
  readonly draftName = signal('');
  readonly draftQuantity = signal(1);
  readonly error = signal('');
  readonly creating = signal(false);
  readonly suggestionsOpen = signal(false);
  readonly nameInput = viewChild.required<ElementRef<HTMLInputElement>>('nameInput');
  private readonly suggestionList = viewChild<ElementRef<HTMLElement>>('suggestionList');
  readonly nameId = `grocery-name-${this.id}`;
  readonly quantityId = `grocery-quantity-${this.id}`;
  readonly formId = `grocery-form-${this.id}`;

  open(item: GroceryDraft, creating = false) {
    if (this.disabled()) return;
    this.creating.set(creating);
    this.draftName.set(item.name);
    this.draftQuantity.set(item.quantity);
    this.error.set('');
    this.suggestionsOpen.set(false);
    this.savedDraft = this.draftSnapshot();
    this.modal().open(creating ? 'control' : 'title');
  }

  openNew() {
    if (this.disabled()) return;
    this.open({ name: '', quantity: 1 }, true);
    this.nameQueryChanged.emit('');
  }

  close() {
    this.modal().close();
  }

  changeName(name: string) {
    this.draftName.set(name);
    this.suggestionsOpen.set(true);
    this.nameQueryChanged.emit(name);
  }

  selectSuggestion(name: string) {
    this.changeName(name);
    this.nameInput().nativeElement.focus();
    this.suggestionsOpen.set(false);
  }

  onNameFocusOut(event: FocusEvent, control: HTMLElement) {
    if (!(event.relatedTarget instanceof Node) || !control.contains(event.relatedTarget))
      this.suggestionsOpen.set(false);
  }

  onNameKeydown(event: KeyboardEvent) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      const buttons = Array.from(
        this.suggestionList()?.nativeElement.querySelectorAll('button') ?? [],
      );
      if (buttons.length) {
        event.preventDefault();
        const index = buttons.indexOf(event.target as HTMLButtonElement);
        const next =
          event.key === 'ArrowDown'
            ? (index + 1) % buttons.length
            : index <= 0
              ? buttons.length - 1
              : index - 1;
        buttons[next].focus();
      }
    }
    if (
      event.key === 'Escape' &&
      this.suggestionsOpen() &&
      this.draftName().trim() &&
      this.suggestionsEnabled()
    ) {
      event.preventDefault();
      event.stopPropagation();
      this.nameInput().nativeElement.focus();
      this.suggestionsOpen.set(false);
    }
  }

  save() {
    if (this.disabled()) return;
    const name = this.draftName().trim();
    const quantity = this.draftQuantity();
    this.error.set('');
    if (name.length > 200) {
      this.error.set(
        $localize`:@@groceries.itemNameTooLong:Item names must be 200 characters or fewer.`,
      );
      return;
    }
    if (!name || !Number.isInteger(quantity) || quantity < 1) {
      this.error.set(
        !name
          ? $localize`:@@shared.inlineGroceryEditor.enterAnItemName:Enter an item name.`
          : $localize`:@@shared.inlineGroceryEditor.quantityMustBeAWholeNumberOf:Quantity must be a whole number of at least 1.`,
      );
      return;
    }
    if (this.closeOnSave()) this.modal().close();
    this.saved.emit({ name, quantity });
  }

  remove() {
    if (this.disabled() || this.creating()) return;
    this.modal().close();
    this.removed.emit();
  }
}
