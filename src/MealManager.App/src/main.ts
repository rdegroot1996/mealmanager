import { bootstrapApplication } from '@angular/platform-browser';
import { loadTranslations } from '@angular/localize';
import { registerLocaleData } from '@angular/common';
import { startMocks } from './start-mocks';
import {
  DEFAULT_LOCALE,
  isAppLocale,
  LANGUAGE_STORAGE_KEY,
  resolveLocale,
  SUPPORTED_LOCALES,
  type AppLocale,
} from './app/core/i18n/locale';

async function activateLocale(locale: AppLocale) {
  const config = SUPPORTED_LOCALES.find(({ id }) => id === locale);
  if (!config) throw new Error(`Unsupported locale: ${locale}`);
  const localeData = await config.loadData();
  let translations: Record<string, string> | undefined;
  if (locale !== DEFAULT_LOCALE) {
    const response = await fetch(`/i18n/messages.${locale}.json`);
    if (!response.ok) throw new Error(`Translation fetch failed: ${response.status}`);
    const catalog = (await response.json()) as {
      locale?: string;
      translations?: Record<string, string>;
    };
    if (
      catalog.locale !== locale ||
      !catalog.translations ||
      typeof catalog.translations !== 'object'
    ) {
      throw new Error(`Translation file for ${locale} is invalid`);
    }
    translations = catalog.translations;
  }
  registerLocaleData(localeData.default, locale);
  if (translations) loadTranslations(translations);
}

async function bootstrap() {
  let storedLocale: string | null = null;
  try {
    storedLocale = sessionStorage.getItem(LANGUAGE_STORAGE_KEY);
  } catch {
    // Storage may be disabled; try the persistent choice below.
  }
  if (!isAppLocale(storedLocale)) {
    try {
      storedLocale = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    } catch {
      // Browsers can disable storage; the browser language remains the fallback.
    }
  }
  let locale = resolveLocale(storedLocale, navigator.languages);
  try {
    await activateLocale(locale);
  } catch (error) {
    if (locale === DEFAULT_LOCALE) throw error;
    console.error(
      `Translations for ${locale} could not be loaded; using ${DEFAULT_LOCALE}.`,
      error,
    );
    locale = DEFAULT_LOCALE;
    await activateLocale(locale);
  }
  document.documentElement.lang = locale;
  await startMocks();
  const [{ App }, { createAppConfig }] = await Promise.all([
    import('./app/app'),
    import('./app/app.config'),
  ]);
  await bootstrapApplication(App, createAppConfig(locale));
}

bootstrap().catch((err) => console.error(err));
