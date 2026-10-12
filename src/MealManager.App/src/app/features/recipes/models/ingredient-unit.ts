export type IngredientUnit = 'g' | 'kg' | 'ml' | 'l' | 'tsp' | 'tbsp' | 'pcs';

export function displayIngredientUnit(unit: string): string {
  switch (unit) {
    case 'tsp':
      return $localize`:@@units.teaspoonAbbreviation:tsp`;
    case 'tbsp':
      return $localize`:@@units.tablespoonAbbreviation:tbsp`;
    case 'pcs':
      return $localize`:@@units.piecesAbbreviation:pcs`;
    default:
      return unit;
  }
}
