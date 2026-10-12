import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormField } from './form-field';

describe('FormField', () => {
  let fixture: ComponentFixture<FormField>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [FormField] }).compileComponents();
    fixture = TestBed.createComponent(FormField);
    fixture.componentRef.setInput('controlId', 'email');
    fixture.componentRef.setInput('label', 'Email');
    fixture.componentRef.setInput('required', true);
    fixture.detectChanges();
  });

  it('renders a label associated with the projected control', () => {
    expect(fixture.nativeElement.textContent.replace(/\s+/g, ' ').trim()).toContain('Email *');
    expect(fixture.nativeElement.querySelector('label')?.htmlFor).toBe('email');
  });
});
