import { setupServer } from 'msw/node';
import { ApiShoppingList, ApiShoppingListItem } from '../app/api/models/api-shopping-list';
import { handlers, resetMockData } from './handlers';
import { ApiSupermarketProduct, ApiSupermarketReview } from '../app/api/models/api-supermarkets';

describe('mock supermarket integration', () => {
  const server = setupServer(...handlers);
  const api = (path: string, method = 'GET', body?: unknown) =>
    fetch(new URL(path, document.baseURI), {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
  beforeEach(() => resetMockData());
  afterAll(() => server.close());

  it('returns mock products when a grocery name has no matching supermarket products', async () => {
    const response = await api('/api/supermarkets/picnic/products?query=Tomatoes');
    expect(response.status).toBe(200);
    const groceries = (await response.json()) as ApiSupermarketProduct[];
    expect(groceries.length).toBeGreaterThan(0);
    expect(groceries.some((product) => product.availability === 'Available')).toBe(true);
  });

  it('keeps matching product searches focused on the query', async () => {
    const groceries = await (
      await api('/api/supermarkets/picnic/products?query=%20mELk%20')
    ).json();
    expect(groceries).toEqual([expect.objectContaining({ id: 's1003' })]);
  });

  it.each(['', '   ', 'x'.repeat(201)])(
    'returns no products for an invalid query %j',
    async (query) => {
      const response = await api(
        `/api/supermarkets/picnic/products?query=${encodeURIComponent(query)}`,
      );
      expect(await response.json()).toEqual([]);
    },
  );

  it('starts connected and allows disconnecting and reconnecting through Settings', async () => {
    const connection = await (await api('/api/integrations/picnic/connection')).json();
    expect(connection).toMatchObject({ status: 'Connected', accountLabel: 'picnic@example.test' });
    expect((await api('/api/integrations/picnic/connection', 'DELETE')).status).toBe(204);
    const providers = await (await api('/api/supermarkets')).json();
    expect(providers[0].status).toBe('Disconnected');
    expect((await api('/api/supermarkets/picnic/products?query=Melk')).status).toBe(400);
    const login = await api('/api/integrations/picnic/connect', 'POST', {
      email: 'picnic@example.test',
      password: 'Picnic123!',
      countryCode: 'NL',
      resetProductMappings: false,
    });
    expect((await login.json()).status).toBe('VerificationRequired');
    expect((await api('/api/integrations/picnic/verification-code', 'POST')).status).toBe(200);
    const verified = await api('/api/integrations/picnic/verify', 'POST', { code: '123456' });
    expect((await verified.json()).status).toBe('Connected');
    expect((await api('/api/supermarkets/picnic/products?query=Melk')).status).toBe(200);
  });

  it('reviews meal groups before manual items and preserves reordered groceries', async () => {
    const cycle = await (await api('/api/planning-cycles/current')).json();
    const mealPlan = await (await api(`/api/meal-plans/cycle/${cycle.id}`)).json();
    const recipe = await (await api('/api/recipes/r1')).json();
    const meal = await (
      await api('/api/planned-meals', 'POST', {
        mealPlanId: mealPlan.id,
        recipeId: recipe.id,
        recipeProfileId: recipe.profiles[0].id,
        date: cycle.startDate,
      })
    ).json();
    expect(
      (
        await api(`/api/planned-meals/${meal.id}/groceries`, 'POST', {
          groceries: [{ name: 'Noodles', quantity: 1 }],
        })
      ).status,
    ).toBe(201);
    const sauce = (await (
      await api(`/api/planned-meals/${meal.id}/groceries/items`, 'POST', {
        name: 'Sauce',
        quantity: 1,
      })
    ).json()) as ApiShoppingListItem;
    for (const name of ['Milk', 'Bread']) {
      expect(
        (
          await api(`/api/shopping-lists/cycle/${cycle.id}/items`, 'POST', {
            name,
            quantity: 1,
          })
        ).status,
      ).toBe(201);
    }
    const getList = async () =>
      (await (await api(`/api/shopping-lists/cycle/${cycle.id}`)).json()) as ApiShoppingList;
    let list = await getList();
    const mealItems = list.mealGroups.find((group) => group.meal.id === meal.id)!.items;
    for (const [plannedMealId, itemIds] of [
      [
        meal.id,
        [sauce.id, ...mealItems.filter((item) => item.id !== sauce.id).map((item) => item.id)],
      ],
      [null, [...list.items].reverse().map((item) => item.id)],
    ]) {
      expect(
        (
          await api(`/api/shopping-lists/${list.id}/items/order`, 'PUT', {
            plannedMealId,
            itemIds,
          })
        ).status,
      ).toBe(200);
    }
    list = await getList();
    const review = (await (
      await api(`/api/supermarkets/cycles/${cycle.id}/review?provider=picnic`)
    ).json()) as ApiSupermarketReview;
    const expected = [...list.mealGroups.flatMap((group) => group.items), ...list.items];
    expect(expected[0].id).toBe(sauce.id);
    expect(review.items.map((item) => item.shoppingListItemId)).toEqual(
      expected.map((item) => item.id),
    );
  });

  it('remembers a first product choice for later groceries from the same recipe profile', async () => {
    const cycle = await (await api('/api/planning-cycles/current')).json();
    const mealPlan = await (await api(`/api/meal-plans/cycle/${cycle.id}`)).json();
    const recipe = await (await api('/api/recipes/r1')).json();
    const profile = await (await api(`/api/recipe-profiles/${recipe.profiles[0].id}`)).json();
    const addGroceries = async () => {
      const meal = await (
        await api('/api/planned-meals', 'POST', {
          mealPlanId: mealPlan.id,
          recipeId: recipe.id,
          recipeProfileId: profile.id,
          date: cycle.startDate,
        })
      ).json();
      const response = await api(`/api/planned-meals/${meal.id}/groceries`, 'POST', {
        groceries: [
          { recipeProfileGroceryItemId: profile.groceries[0].id, name: 'Noodles', quantity: 1 },
        ],
      });
      expect(response.status).toBe(201);
      return meal.id;
    };
    const review = async () =>
      (await (
        await api(`/api/supermarkets/cycles/${cycle.id}/review?provider=picnic`)
      ).json()) as ApiSupermarketReview;
    await addGroceries();
    const initial = await review();
    const item = initial.items[0];
    expect(item.product).toBeNull();
    const groceries = (await (
      await api(`/api/supermarkets/picnic/products?query=${encodeURIComponent(item.name)}`)
    ).json()) as ApiSupermarketProduct[];
    const product = groceries.find((candidate) => candidate.availability === 'Available')!;
    expect(product).toBeDefined();
    const sent = await api(`/api/supermarkets/cycles/${cycle.id}/send`, 'POST', {
      provider: initial.provider,
      accountId: initial.accountId,
      connectionGeneration: initial.connectionGeneration,
      revision: initial.revision,
      items: [
        {
          shoppingListItemId: item.shoppingListItemId,
          productId: product.id,
          quantity: 1,
          remember: false,
        },
      ],
      totals: [{ productId: product.id, quantity: 1 }],
    });
    expect((await sent.json()).lines[0].outcome).toBe('Added');
    await addGroceries();
    const later = await review();
    expect(later.items).toHaveLength(2);
    expect(later.items.every((row) => row.product?.id === product.id)).toBe(true);
    expect(
      later.items.find((row) => row.shoppingListItemId === item.shoppingListItemId)?.checked,
    ).toBe(true);
    expect(
      later.items.find((row) => row.shoppingListItemId !== item.shoppingListItemId)?.checked,
    ).toBe(false);
  });
});
