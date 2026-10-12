import { Component, viewChild } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActionDialog } from './action-dialog';

@Component({
  imports: [ActionDialog],
  template: `<app-action-dialog label="Options for Pasta" title="Meal options">
    <p action-context>Pasta · Family</p>
    <li><button type="button" (click)="choose()">Change profile</button></li>
    <li><button type="button" disabled (click)="choose()">Unavailable action</button></li>
  </app-action-dialog>`,
})
class Host {
  actionDialog = viewChild.required(ActionDialog);
  choose = vi.fn();
}

describe('ActionDialog', () => {
  it('opens a named native dialog and closes it before handing off the selected action', async () => {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const component = fixture.componentInstance.actionDialog();
    const dialog = component.modal().dialog().nativeElement;
    dialog.showModal = vi.fn(() => {
      dialog.open = true;
    });
    dialog.close = vi.fn(() => {
      dialog.open = false;
    });
    fixture.componentInstance.choose.mockImplementation(() => expect(dialog.open).toBe(false));
    fixture.nativeElement.querySelector('button[aria-label="Options for Pasta"]').click();
    expect(dialog.open).toBe(true);
    expect(dialog.textContent).toContain('Meal options');
    expect(dialog.textContent).toContain('Pasta · Family');
    dialog.querySelector<HTMLButtonElement>('ul button')!.click();
    expect(dialog.close).toHaveBeenCalledOnce();
    expect(fixture.componentInstance.choose).toHaveBeenCalledOnce();
  });

  it('does not open when disabled or dispatch a disabled action', async () => {
    const fixture = TestBed.createComponent(ActionDialog);
    fixture.componentRef.setInput('label', 'Options');
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    const open = vi.spyOn(fixture.componentInstance.modal(), 'open');
    fixture.componentInstance.open();
    fixture.nativeElement.querySelector('button[aria-label="Options"]').click();
    expect(open).not.toHaveBeenCalled();
    fixture.destroy();
    const host = TestBed.createComponent(Host);
    await host.whenStable();
    const close = vi.spyOn(host.componentInstance.actionDialog().modal(), 'close');
    host.nativeElement.querySelector('ul button[disabled]').click();
    expect(close).not.toHaveBeenCalled();
    expect(host.componentInstance.choose).not.toHaveBeenCalled();
  });
});
