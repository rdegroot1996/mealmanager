import { ComponentFixture, TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';

describe('EmptyState', () => {
  let fixture: ComponentFixture<EmptyState>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [EmptyState] }).compileComponents();
    fixture = TestBed.createComponent(EmptyState);
    fixture.componentRef.setInput('title', 'Nothing here');
    fixture.componentRef.setInput('description', 'Add an item to get started.');
    fixture.detectChanges();
  });

  it('renders its title and description', () => {
    expect(fixture.nativeElement.textContent).toContain('Nothing here');
    expect(fixture.nativeElement.textContent).toContain('Add an item to get started.');
    expect(fixture.nativeElement.querySelector('.empty\\:hidden')).not.toBeNull();
  });

  it('uses a standalone surface by default', () => {
    const state = fixture.nativeElement.querySelector('[data-testid="empty-state"]') as HTMLElement;

    expect(state.classList).toContain('app-surface');
    expect(state.classList).toContain('p-8');
  });

  it('can render flat inside an existing surface', () => {
    fixture.componentRef.setInput('embedded', true);
    fixture.detectChanges();
    const state = fixture.nativeElement.querySelector('[data-testid="empty-state"]') as HTMLElement;

    expect(state.classList).toContain('bg-transparent');
    expect(state.classList).toContain('p-4');
    expect(state.classList).not.toContain('app-surface');
  });
});
