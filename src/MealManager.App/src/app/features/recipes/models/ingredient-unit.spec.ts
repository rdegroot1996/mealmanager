import { displayIngredientUnit } from './ingredient-unit';

describe('ingredient unit labels', () => {
  it('keeps stable source units and custom unit text', () => {
    expect(displayIngredientUnit('tsp')).toBe('tsp');
    expect(displayIngredientUnit('pcs')).toBe('pcs');
    expect(displayIngredientUnit('pinch')).toBe('pinch');
  });
});
