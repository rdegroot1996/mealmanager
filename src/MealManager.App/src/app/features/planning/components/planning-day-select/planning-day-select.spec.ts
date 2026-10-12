import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PlanningDaySelect } from './planning-day-select';

@Component({
  imports: [PlanningDaySelect],
  template:
    '<app-planning-day-select [days]="days" [(selectedDate)]="selectedDate" placeholder="Choose a day" />',
})
class HostComponent {
  days = [{ date: '2026-08-10', weekday: 'Mon', shortDate: 'Aug 10' }];
  selectedDate = signal('');
}

describe('PlanningDaySelect', () => {
  let fixture: ComponentFixture<HostComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
  });

  it('updates the selected date', () => {
    const select = fixture.nativeElement.querySelector('select') as HTMLSelectElement;
    select.value = '2026-08-10';
    select.dispatchEvent(new Event('change'));
    expect(fixture.componentInstance.selectedDate()).toBe('2026-08-10');
  });
});
