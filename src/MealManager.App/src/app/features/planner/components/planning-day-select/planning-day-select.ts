import { Component, input, model } from '@angular/core';
import { FormsModule } from '@angular/forms';

export interface PlanningDayOption {
  date: string;
  weekday: string;
  shortDate: string;
}

@Component({
  selector: 'app-planning-day-select',
  imports: [FormsModule],
  templateUrl: './planning-day-select.html',
})
export class PlanningDaySelect {
  days = input.required<PlanningDayOption[]>();
  selectedDate = model.required<string>();
  disabled = input(false);
  label = input($localize`:@@common.day:Day`);
  placeholder = input<string | null>(null);
}
