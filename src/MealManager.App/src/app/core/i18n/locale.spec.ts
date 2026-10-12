import { DEFAULT_LOCALE, isAppLocale, resolveLocale, SUPPORTED_LOCALES } from './locale';
import { formatDecimal, parseDecimal } from './decimal';

describe('language and ingredient quantities', () => {
  it('uses a saved language before browser preferences', () => {
    expect(resolveLocale('nl-NL', ['en-US'])).toBe('nl-NL');
    expect(resolveLocale(null, ['nl-BE', 'en-US'])).toBe('nl-NL');
    expect(resolveLocale('unknown', ['fr-FR'])).toBe('en-GB');
    expect(resolveLocale(null, ['NL-nl'])).toBe('nl-NL');
    expect(isAppLocale(SUPPORTED_LOCALES[1].id)).toBe(true);
    expect(isAppLocale('fr-FR')).toBe(false);
    expect(SUPPORTED_LOCALES[0].id).toBe(DEFAULT_LOCALE);
  });

  it('parses decimal quantities according to the selected locale', () => {
    expect(parseDecimal('1,5', 'nl-NL')).toBe(1.5);
    expect(parseDecimal('1.5', 'en-GB')).toBe(1.5);
    expect(Number.isNaN(parseDecimal('1.5', 'nl-NL'))).toBe(true);
    expect(Number.isNaN(parseDecimal('1,2345', 'nl-NL'))).toBe(true);
    expect(formatDecimal(1.5, 'nl-NL')).toBe('1,5');
    expect(formatDecimal(1.5, 'en-GB')).toBe('1.5');
    const arabic = formatDecimal(1.5, 'ar-EG');
    expect(parseDecimal(arabic, 'ar-EG')).toBe(1.5);
  });
});
