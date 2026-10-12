import { LOCALE_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { LanguageSwitcher } from './language-switcher';

describe('LanguageSwitcher', () => {
  afterEach(() => TestBed.resetTestingModule());

  it('selects English by default', () => {
    TestBed.configureTestingModule({
      imports: [LanguageSwitcher],
      providers: [{ provide: LOCALE_ID, useValue: 'en-GB' }],
    });

    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('select') as HTMLSelectElement).value).toBe(
      'en-GB',
    );
  });

  it('selects the active stored locale after bootstrap', () => {
    TestBed.configureTestingModule({
      imports: [LanguageSwitcher],
      providers: [{ provide: LOCALE_ID, useValue: 'nl-NL' }],
    });

    const fixture = TestBed.createComponent(LanguageSwitcher);
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('select') as HTMLSelectElement).value).toBe(
      'nl-NL',
    );
  });

  it('associates each form label with its own select', () => {
    TestBed.configureTestingModule({
      imports: [LanguageSwitcher],
      providers: [{ provide: LOCALE_ID, useValue: 'en-GB' }],
    });
    const first = TestBed.createComponent(LanguageSwitcher);
    const second = TestBed.createComponent(LanguageSwitcher);
    first.detectChanges();
    second.detectChanges();
    const firstSelect = first.nativeElement.querySelector('select') as HTMLSelectElement;
    const secondSelect = second.nativeElement.querySelector('select') as HTMLSelectElement;
    expect(first.nativeElement.querySelector('label').htmlFor).toBe(firstSelect.id);
    expect(second.nativeElement.querySelector('label').htmlFor).toBe(secondSelect.id);
    expect(firstSelect.id).not.toBe(secondSelect.id);
  });
});
