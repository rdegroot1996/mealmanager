import { TestBed } from '@angular/core/testing';
import { ReorderActions } from './reorder-actions';

it('provides direct, named moves while disabling impossible moves', () => {
  const fixture = TestBed.createComponent(ReorderActions);
  fixture.componentRef.setInput('name', 'Rice');
  fixture.componentRef.setInput('canMoveUp', false);
  fixture.detectChanges();
  const moved = vi.fn();
  fixture.componentInstance.moved.subscribe(moved);
  const buttons = [...fixture.nativeElement.querySelectorAll('button')] as HTMLButtonElement[];
  expect(buttons.map((button) => button.getAttribute('aria-label'))).toEqual([
    'Move Rice up',
    'Move Rice down',
  ]);
  expect(fixture.nativeElement.querySelector('dialog')).toBeNull();
  buttons[0].click();
  buttons[1].click();
  expect(moved.mock.calls).toEqual([[1]]);
  fixture.componentRef.setInput('disabled', true);
  fixture.detectChanges();
  buttons[1].click();
  expect(moved).toHaveBeenCalledOnce();
});
