import { AppIcon } from '../../../../shared/components/app-icon/app-icon';
import { Component, inject, signal, output, viewChild } from '@angular/core';
import { Modal } from '../../../../shared/components/modal/modal';
import { ConfirmationModal } from '../../../../shared/components/confirmation-modal/confirmation-modal';
import { MealPlanStore } from '../../state/meal-plan.store';
import { PlanningCycleStore } from '../../../planning-cycle/state/planning-cycle.store';
import { FormsModule } from '@angular/forms';
import { FormField } from '../../../../shared/components/form-field/form-field';
import { apiErrorMessage } from '../../../../shared/services/api-error-message';
import { ApiPlanningDayNote } from '../../../../api/models/api-meal-plan';

@Component({
  selector: 'app-add-note-modal',
  imports: [ConfirmationModal, AppIcon, Modal, FormsModule, FormField],
  templateUrl: './add-note-modal.html',
})
export class AddNoteModal {
  private savedDraft = '';
  readonly discardModal = viewChild.required<ConfirmationModal>('discardModal');
  readonly beforeDismiss = () =>
    this.draftSnapshot() === this.savedDraft || this.discardModal().confirmDiscard();
  private draftSnapshot() {
    return JSON.stringify(this.noteText().trim());
  }

  ngOnDestroy() {
    this.endSession();
  }
  private cycleId: string | undefined;
  private session = 0;
  endSession() {
    ++this.session;
  }
  modal = viewChild<Modal>('modal');
  mealPlanStore = inject(MealPlanStore);
  cycleStore = inject(PlanningCycleStore);

  readonly removeRequested = output<string>();
  remove() {
    const noteId = this.editingNoteId();
    if (!noteId || this.saving() || this.cycleStore.currentCycle()?.id !== this.cycleId) return;
    this.modal()?.close();
    this.removeRequested.emit(noteId);
  }

  date = signal('');
  editingNoteId = signal<string | null>(null);
  noteText = signal('');
  saving = signal(false);
  error = signal('');

  open(date: string, note: ApiPlanningDayNote | null = null) {
    this.cycleId = this.cycleStore.currentCycle()?.id;
    ++this.session;
    this.date.set(date);
    this.editingNoteId.set(note?.id ?? null);
    this.noteText.set(note?.text ?? '');
    this.saving.set(false);
    this.error.set('');
    this.savedDraft = this.draftSnapshot();
    this.modal()!.open(note ? 'title' : 'control');
  }

  confirm() {
    if (this.cycleStore.currentCycle()?.id !== this.cycleId) return;
    const session = this.session;
    const cycleId = this.cycleStore.currentCycle()?.id;
    const text = this.noteText().trim();
    if (!cycleId || !text || this.saving()) return;

    this.saving.set(true);
    this.error.set('');
    const noteId = this.editingNoteId();
    const action = noteId
      ? this.mealPlanStore.updateNote(noteId, text)
      : this.mealPlanStore.addNote(this.date(), text);
    action.subscribe({
      next: () => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.modal()?.close();
      },
      error: (error: unknown) => {
        if (session !== this.session) return;
        this.saving.set(false);
        this.error.set(
          apiErrorMessage(
            error,
            noteId
              ? $localize`:@@planner.addNoteModal.theNoteCouldNotBeUpdatedPlease:The note could not be updated. Please try again.`
              : $localize`:@@planner.addNoteModal.theNoteCouldNotBeAddedPlease:The note could not be added. Please try again.`,
          ),
        );
      },
    });
  }
}
