export function formatDecimal(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 3 }).format(
    value,
  );
}

/** Ingredient quantities have at most three fractional digits in the API. */
export function parseDecimal(value: string, locale: string): number {
  const formatter = new Intl.NumberFormat(locale, { useGrouping: false });
  const decimalSeparator = formatter
    .formatToParts(1.1)
    .find(({ type }) => type === 'decimal')?.value;
  const digits = Array.from({ length: 10 }, (_, digit) => formatter.format(digit));
  let normalized = value.trim();
  for (const [digit, glyph] of digits.entries())
    normalized = normalized.replaceAll(glyph, String(digit));
  const parts = decimalSeparator ? normalized.split(decimalSeparator) : [normalized];
  if (
    parts.length > 2 ||
    !/^\d+$/.test(parts[0]) ||
    (parts.length === 2 && !/^\d{1,3}$/.test(parts[1]))
  ) {
    return Number.NaN;
  }
  return Number(parts.join('.'));
}
