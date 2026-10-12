import { Component, input } from '@angular/core';

@Component({
  selector: 'app-form-field',
  templateUrl: './form-field.html',
})
export class FormField {
  controlId = input.required<string>();
  label = input.required<string>();
  hint = input<string | null>(null);
  error = input<string | null>(null);
  required = input(false);
}
