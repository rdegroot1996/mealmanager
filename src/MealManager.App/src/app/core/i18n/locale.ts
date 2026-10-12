export const LANGUAGE_STORAGE_KEY = 'mealmanager.language';

/** The default language uses source strings; other languages load a catalog. */
export const DEFAULT_LOCALE = 'en-GB';

export const SUPPORTED_LOCALES = [
  {
    id: DEFAULT_LOCALE,
    name: 'English',
    loadData: () => import('@angular/common/locales/en-GB'),
  },
  {
    id: 'nl-NL',
    name: 'Nederlands',
    loadData: () => import('@angular/common/locales/nl'),
  },
] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number]['id'];

export function isAppLocale(value: unknown): value is AppLocale {
  return SUPPORTED_LOCALES.some(({ id }) => id === value);
}

export function resolveLocale(
  stored: string | null,
  browserLanguages: readonly string[],
): AppLocale {
  if (isAppLocale(stored)) return stored;
  for (const language of browserLanguages) {
    const normalized = language.toLowerCase();
    const exact = SUPPORTED_LOCALES.find(({ id }) => id.toLowerCase() === normalized);
    if (exact) return exact.id;
    const primary = normalized.split('-')[0];
    const regionalFallback = SUPPORTED_LOCALES.find(
      ({ id }) => id.split('-')[0].toLowerCase() === primary,
    );
    if (regionalFallback) return regionalFallback.id;
  }
  return DEFAULT_LOCALE;
}
