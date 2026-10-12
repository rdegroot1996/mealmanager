import { DateTime } from 'luxon';
import { DEFAULT_LOCALE } from '../../core/i18n/locale';

export function planningDateParts(
  value: string | DateTime,
  locale: string = DEFAULT_LOCALE,
): {
  weekday: string;
  shortDate: string;
} {
  const date = (typeof value === 'string' ? DateTime.fromISO(value) : value).setLocale(locale);
  return {
    weekday: date.toFormat('ccc'),
    shortDate: date.toLocaleString({ day: 'numeric', month: 'short' }),
  };
}

export function planningDateLabel(
  value: string | DateTime,
  locale: string = DEFAULT_LOCALE,
): string {
  return (typeof value === 'string' ? DateTime.fromISO(value) : value)
    .setLocale(locale)
    .toLocaleString({ weekday: 'short', day: 'numeric', month: 'short' });
}
