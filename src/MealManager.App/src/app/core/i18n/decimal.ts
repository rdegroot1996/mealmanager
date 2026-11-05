export function formatDecimal(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { useGrouping: false, maximumFractionDigits: 3 }).format(
    value,
  );
}

/** Defaults to the editor's three-decimal limit; Infinity recognizes numeric drafts of any precision. */
export function parseDecimal(value: string, locale: string, maximumFractionDigits = 3): number {
  const formatter = new Intl.NumberFormat(locale, { useGrouping: false });
  const decimalSeparator = formatter
    .formatToParts(1.1)
    .find(({ type }) => type === 'decimal')?.value;
  const digits = Array.from({ length: 10 }, (_, digit) => formatter.format(digit));
  let normalized = value.trim();
  for (const [digit, glyph] of digits.entries())
    normalized = normalized.replaceAll(glyph, String(digit));
  normalized = normalized.replace(/^−/, '-');
  const parts = decimalSeparator ? normalized.split(decimalSeparator) : [normalized];
  if (
    parts.length > 2 ||
    !/^[+-]?\d+$/.test(parts[0]) ||
    (parts.length === 2 && (!/^\d+$/.test(parts[1]) || parts[1].length > maximumFractionDigits))
  ) {
    return Number.NaN;
  }
  return Number(parts.join('.'));
}
