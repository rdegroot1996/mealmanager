# Localization

[Frontend guide](README.md) · [Frontend setup](../README.md)

## Interface languages

The app has one build and one set of language-neutral routes (currently named in English). The language switcher is in the account menu and on the sign-in/setup screens. A selection is kept in browser storage and takes effect after a reload. On first use, the app matches the browser's preferred languages against the supported-locale registry, falling back to the default locale. User-entered recipe and household content is displayed as entered.

`src/app/core/i18n/locale.ts` lists supported locales, their self-names for the switcher, and loaders for Angular locale data. English (`en-GB`) is currently the default and the language of the source strings; Dutch (`nl-NL`) is the first translated locale. The default uses source strings without a catalog fetch. At startup, any other selected locale loads `/i18n/messages.<locale>.json` and its Angular locale data before Angular bootstraps. This gives each language a separate resource file and locale-data chunk, while keeping one application build. If a catalog cannot be loaded, startup falls back to the default locale.

Static text uses Angular template `i18n` markers or `$localize` with readable IDs. Common phrases share IDs such as `common.cancel`; feature-specific messages use IDs such as `recipes.removeIngredient`. Source strings are extracted to `src/locale/messages.en-GB.json`; each translated locale has a separate `src/locale/messages.<locale>.json`. To add a locale, add an entry to `SUPPORTED_LOCALES` with its BCP 47 ID, native display name, and Angular locale-data import; add and translate its catalog using the same message IDs and placeholders; then run `npm run i18n:check`, `npm test`, and `npm run build`. The checker compares extracted source messages with the source catalog and checks every translated catalog for missing, unused, or mismatched messages. The `angular.json` asset glob copies all catalogs into `/i18n` automatically.

To add a message, mark the template or code, run `npm run i18n:extract`, add the new ID to every translated catalog, and run `npm run i18n:check`. Keep the source-language setting in `angular.json` aligned with `DEFAULT_LOCALE` and the source catalog if the default ever changes. Do not translate user-created data or change stored unit codes. Formatting uses Angular locale data, Luxon, and `Intl`; ingredient quantity input accepts the selected locale's decimal separator and digits.
