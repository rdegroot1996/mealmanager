import { ComponentFixture, TestBed } from '@angular/core/testing';
import { LoadingIndicator } from './loading-indicator';

describe('LoadingIndicator', () => {
  let fixture: ComponentFixture<LoadingIndicator>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [LoadingIndicator] }).compileComponents();
    fixture = TestBed.createComponent(LoadingIndicator);
    fixture.componentRef.setInput('message', 'Loading planner…');
    fixture.detectChanges();
  });

  it('announces its loading message', () => {
    const status = fixture.nativeElement.querySelector('[role="status"]');

    expect(status.textContent).toContain('Loading planner…');
  });

  it('uses the compact modal presentation when requested', () => {
    fixture.componentRef.setInput('compact', true);
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]');
    const spinner = fixture.nativeElement.querySelector('.loading');
    expect(status.classList.contains('py-4')).toBe(true);
    expect(status.classList.contains('text-sm')).toBe(true);
    expect(spinner.classList.contains('loading-sm')).toBe(true);
  });

  it('announces an optional description on a separate line beneath the message', () => {
    fixture.componentRef.setInput('description', 'You can close this window. Adding continues.');
    fixture.detectChanges();
    const lines = fixture.nativeElement.querySelectorAll('[role="status"] div span');
    expect(lines).toHaveLength(2);
    expect(lines[0].textContent).toBe('Loading planner…');
    expect(lines[1].textContent).toBe('You can close this window. Adding continues.');
    expect(lines[1].classList).toContain('block');
  });
});
