import { moveGrocery } from './grocery-order';

describe('item ordering', () => {
  const rice = {
    id: 'rice',
    name: 'Rice',
    quantity: 2,
    atHome: false,
    selected: false,
    recipeProfileGroceryItemId: 'profile-rice',
  };
  const oil = { ...rice, id: 'oil', name: 'Oil', atHome: true };

  it('reorders within a section and stops at the outer list boundaries', () => {
    const pasta = { ...rice, id: 'pasta', name: 'Pasta' };
    expect(moveGrocery([rice, pasta], [oil], rice, 1)?.needed.map((item) => item.id)).toEqual([
      'pasta',
      'rice',
    ]);
    expect(moveGrocery([rice], [oil], rice, -1)).toBeNull();
    expect(moveGrocery([rice], [oil], oil, 1)).toBeNull();
  });

  it('crosses section boundaries with arrow keys while retaining selection and source identity', () => {
    const moved = moveGrocery([rice], [oil], rice, 1)!;
    expect(moved.needed).toEqual([]);
    expect(moved.atHome).toEqual([{ ...rice, atHome: true }, oil]);
    expect(rice.atHome).toBe(false);
    const returned = moveGrocery(moved.needed, moved.atHome, moved.atHome[0], -1)!;
    expect(returned.needed).toEqual([rice]);
    expect(returned.atHome).toEqual([oil]);
  });

  it('ignores a item absent from the claimed group', () => {
    expect(moveGrocery([], [oil], rice, 1)).toBeNull();
  });
});
