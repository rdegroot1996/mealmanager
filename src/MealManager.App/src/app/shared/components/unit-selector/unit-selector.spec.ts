import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { UnitSelector } from './unit-selector';

@Component({
  imports: [UnitSelector],
  template: '<app-unit-selector [(unit)]="unit" />',
})
class HostComponent {
  unit = signal('pcs');
}

describe('UnitSelector', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('updates the selected unit', () => {
    const input = fixture.nativeElement.querySelector('input') as HTMLInputElement;
    input.value = 'pinch';
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect(fixture.componentInstance.unit()).toBe('pinch');
  });

  it('stores the canonical unit when a common option is chosen', async () => {
    const tablespoon = [...fixture.nativeElement.querySelectorAll('li button')].find(
      (button: HTMLButtonElement) => button.textContent?.trim() === 'tbsp',
    ) as HTMLButtonElement;
    tablespoon.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.componentInstance.unit()).toBe('tbsp');
    expect((fixture.nativeElement.querySelector('input') as HTMLInputElement).value).toBe('tbsp');
  });
});
