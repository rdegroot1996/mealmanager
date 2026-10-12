import { setupServer } from 'msw/node';
import { ApiGroceryList, ApiGroceryItem } from '../app/api/models/api-groceries';
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
  beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
  beforeEach(() => resetMockData());
  afterAll(() => server.close());

  it('returns mock products when a grocery name has no matching supermarket products', async () => {
    const response = await api('/api/supermarkets/picnic/products?query=Tomatoes');
    expect(response.status).toBe(200);
    const products = (await response.json()) as ApiSupermarketProduct[];
    expect(products.length).toBeGreaterThan(0);
    expect(products.some((product) => product.availability === 'Available')).toBe(true);
  });

  it('keeps matching product searches focused on the query', async () => {
    const products = await (await api('/api/supermarkets/picnic/products?query=%20mELk%20')).json();
    expect(products).toEqual([expect.objectContaining({ id: 's1003' })]);
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
    const planning = await (await api(`/api/planning/cycle/${cycle.id}`)).json();
    const recipe = await (await api('/api/recipes/r1')).json();
    const meal = await (
      await api('/api/planning-meals', 'POST', {
        planningId: planning.id,
        recipeId: recipe.id,
        recipeProfileId: recipe.profiles[0].id,
        date: cycle.startDate,
      })
    ).json();
    expect(
      (
        await api(`/api/planning-meals/${meal.id}/groceries`, 'POST', {
          groceries: [{ name: 'Noodles', quantity: 1 }],
        })
      ).status,
    ).toBe(201);
    const sauce = (await (
      await api(`/api/planning-meals/${meal.id}/groceries/items`, 'POST', {
        name: 'Sauce',
        quantity: 1,
      })
    ).json()) as ApiGroceryItem;
    for (const name of ['Milk', 'Bread']) {
      expect(
        (
          await api(`/api/grocery-lists/cycle/${cycle.id}/items`, 'POST', {
            name,
            quantity: 1,
          })
        ).status,
      ).toBe(201);
    }
    const getList = async () =>
      (await (await api(`/api/grocery-lists/cycle/${cycle.id}`)).json()) as ApiGroceryList;
    let list = await getList();
    const mealItems = list.planningMealGroceries.find(
      (group) => group.planningMeal.id === meal.id,
    )!.groceries;
    for (const [planningMealId, itemIds] of [
      [
        meal.id,
        [sauce.id, ...mealItems.filter((item) => item.id !== sauce.id).map((item) => item.id)],
      ],
      [null, [...list.groceries].reverse().map((item) => item.id)],
    ]) {
      expect(
        (
          await api(`/api/grocery-lists/${list.id}/items/order`, 'PUT', {
            planningMealId,
            itemIds,
          })
        ).status,
      ).toBe(200);
    }
    list = await getList();
    const review = (await (
      await api(`/api/supermarkets/cycles/${cycle.id}/review?provider=picnic`)
    ).json()) as ApiSupermarketReview;
    const expected = [
      ...list.planningMealGroceries.flatMap((group) => group.groceries),
      ...list.groceries,
    ];
    expect(expected[0].id).toBe(sauce.id);
    expect(review.items.map((item) => item.groceryItemId)).toEqual(expected.map((item) => item.id));
  });

  it('remembers a first product choice for later groceries from the same recipe profile', async () => {
    const cycle = await (await api('/api/planning-cycles/current')).json();
    const planning = await (await api(`/api/planning/cycle/${cycle.id}`)).json();
    const recipe = await (await api('/api/recipes/r1')).json();
    const profile = await (await api(`/api/recipe-profiles/${recipe.profiles[0].id}`)).json();
    const addGroceries = async () => {
      const meal = await (
        await api('/api/planning-meals', 'POST', {
          planningId: planning.id,
          recipeId: recipe.id,
          recipeProfileId: profile.id,
          date: cycle.startDate,
        })
      ).json();
      const response = await api(`/api/planning-meals/${meal.id}/groceries`, 'POST', {
        groceries: [
          { recipeProfileProductId: profile.products[0].id, name: 'Noodles', quantity: 1 },
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
    const products = (await (
      await api(`/api/supermarkets/picnic/products?query=${encodeURIComponent(item.name)}`)
    ).json()) as ApiSupermarketProduct[];
    const product = products.find((candidate) => candidate.availability === 'Available')!;
    expect(product).toBeDefined();
    const sent = await api(`/api/supermarkets/cycles/${cycle.id}/send`, 'POST', {
      provider: initial.provider,
      accountId: initial.accountId,
      connectionGeneration: initial.connectionGeneration,
      revision: initial.revision,
      items: [
        { groceryItemId: item.groceryItemId, productId: product.id, quantity: 1, remember: false },
      ],
      totals: [{ productId: product.id, quantity: 1 }],
    });
    expect((await sent.json()).lines[0].outcome).toBe('Added');
    await addGroceries();
    const later = await review();
    expect(later.items).toHaveLength(2);
    expect(later.items.every((row) => row.product?.id === product.id)).toBe(true);
    expect(later.items.find((row) => row.groceryItemId === item.groceryItemId)?.checked).toBe(true);
    expect(later.items.find((row) => row.groceryItemId !== item.groceryItemId)?.checked).toBe(
      false,
    );
  });
});
