import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NumberInput } from './number-input';

describe('number input', () => {
  let fixture: ComponentFixture<NumberInput>;
  let changed = vi.fn<(value: number) => void>();

  beforeEach(async () => {
    fixture = TestBed.createComponent(NumberInput);
    fixture.componentRef.setInput('controlId', 'quantity');
    fixture.componentRef.setInput('label', 'Noodles: order quantity');
    fixture.componentRef.setInput('value', 1);
    fixture.componentRef.setInput('maximum', 3);
    changed = vi.fn();
    fixture.componentInstance.valueChange.subscribe((value) => changed(value));
    await fixture.whenStable();
  });

  it('adjusts one pack at a time and respects both boundaries', async () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('number');
    expect(input.inputMode).toBe('numeric');
    const [minus, plus] = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(minus.disabled).toBe(true);
    expect(plus.getAttribute('aria-label')).toBe('Increase Noodles: order quantity');
    plus.click();
    expect(changed).toHaveBeenLastCalledWith(2);
    fixture.componentRef.setInput('value', 3);
    await fixture.whenStable();
    expect(plus.disabled).toBe(true);
    minus.click();
    expect(changed).toHaveBeenLastCalledWith(2);
  });

  it('preserves invalid typed values and associates the inline error', async () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    for (const value of ['0', '1.5', '4', '']) {
      input.value = value;
      input.dispatchEvent(new Event('input'));
      expect(changed).toHaveBeenLastCalledWith(value ? Number(value) : Number.NaN);
    }
    fixture.componentRef.setInput('value', Number.NaN);
    fixture.componentRef.setInput('invalid', true);
    fixture.componentRef.setInput('describedBy', 'quantity-error');
    await fixture.whenStable();
    expect(input.value).toBe('');
    expect(input.getAttribute('aria-describedby')).toBe('quantity-error');
    expect(input.getAttribute('aria-invalid')).toBe('true');
  });

  it('disables every quantity control while disabled', async () => {
    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    for (const control of fixture.nativeElement.querySelectorAll('input, button')) {
      expect(control.disabled).toBe(true);
    }
  });

  it('supports a different minimum and an optional upper bound', async () => {
    fixture.componentRef.setInput('minimum', 0);
    fixture.componentRef.setInput('maximum', null);
    fixture.componentRef.setInput('value', 0);
    await fixture.whenStable();
    const [minus, plus] = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(minus.disabled).toBe(true);
    plus.click();
    expect(changed).toHaveBeenLastCalledWith(1);
    fixture.componentRef.setInput('value', 999);
    await fixture.whenStable();
    expect(plus.disabled).toBe(false);
    expect(fixture.nativeElement.querySelector('input').hasAttribute('max')).toBe(false);
  });

  it('allows text entry with a full keyboard and keeps text amounts out of arithmetic', async () => {
    fixture.componentRef.setInput('allowText', true);
    fixture.componentRef.setInput('value', null);
    fixture.componentRef.setInput('textValue', 'to taste');
    const typed = vi.fn();
    fixture.componentInstance.textValueChange.subscribe(typed);
    await fixture.whenStable();
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    expect(input.type).toBe('text');
    expect(input.inputMode).toBe('text');
    expect(input.value).toBe('to taste');
    input.value = 'as needed';
    input.dispatchEvent(new Event('input'));
    expect(typed).toHaveBeenCalledWith('as needed');
    for (const button of fixture.nativeElement.querySelectorAll('button')) {
      expect(button.disabled).toBe(true);
      button.click();
    }
    expect(changed).not.toHaveBeenCalled();
  });

  it('starts an empty text-capable amount at one and adjusts decimals without rounding them to whole numbers', async () => {
    fixture.componentRef.setInput('allowText', true);
    fixture.componentRef.setInput('minimum', 0.001);
    fixture.componentRef.setInput('maximum', null);
    fixture.componentRef.setInput('value', null);
    fixture.componentRef.setInput('textValue', '');
    await fixture.whenStable();
    const [minus, plus] = fixture.nativeElement.querySelectorAll(
      'button',
    ) as NodeListOf<HTMLButtonElement>;
    expect(minus.disabled).toBe(true);
    plus.click();
    expect(changed).toHaveBeenLastCalledWith(1);
    fixture.componentRef.setInput('value', 0.125);
    fixture.componentRef.setInput('textValue', '0,125');
    await fixture.whenStable();
    expect(minus.disabled).toBe(true);
    plus.click();
    expect(changed).toHaveBeenLastCalledWith(1.125);
    fixture.componentRef.setInput('value', 1.125);
    await fixture.whenStable();
    minus.click();
    expect(changed).toHaveBeenLastCalledWith(0.125);
  });

  it('keeps invalid numeric drafts editable while disabling their step buttons', async () => {
    fixture.componentRef.setInput('allowText', true);
    fixture.componentRef.setInput('value', Number.NaN);
    fixture.componentRef.setInput('textValue', '1.2345');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('input').value).toBe('1.2345');
    for (const button of fixture.nativeElement.querySelectorAll('button'))
      expect(button.disabled).toBe(true);
  });
});
