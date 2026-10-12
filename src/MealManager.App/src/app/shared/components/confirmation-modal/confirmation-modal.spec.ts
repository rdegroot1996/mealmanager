import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConfirmationModal } from './confirmation-modal';

describe('ConfirmationModal', () => {
  let fixture: ComponentFixture<ConfirmationModal>;
  let component: ConfirmationModal;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [ConfirmationModal] }).compileComponents();
    fixture = TestBed.createComponent(ConfirmationModal);
    component = fixture.componentInstance;
    fixture.detectChanges();
    vi.spyOn(component.modal(), 'open').mockImplementation(() => undefined);
    vi.spyOn(component.modal(), 'close').mockImplementation(() => undefined);
  });

  it('resolves true from the configured confirmation action', async () => {
    const decision = component.open({
      title: 'Remove recipe?',
      message: 'This cannot be undone.',
      confirmLabel: 'Remove recipe',
      destructive: true,
    });
    fixture.detectChanges();

    component.decide(true);

    await expect(decision).resolves.toBe(true);
  });

  it('resolves false when the dialog is dismissed', async () => {
    const decision = component.open({
      title: 'Discard changes?',
      message: 'Unsaved changes will be lost.',
      confirmLabel: 'Discard changes',
    });

    component.onClosed();

    await expect(decision).resolves.toBe(false);
  });

  it('spaces the confirmation actions', () => {
    const actions = fixture.nativeElement.querySelector('[modal-actions]') as HTMLElement;

    expect(actions.classList).toContain('gap-2');
  });
});
