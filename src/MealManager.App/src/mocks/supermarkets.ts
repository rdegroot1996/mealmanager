import { ApiPicnicConnection } from '../app/api/models/api-picnic';
import { http, HttpResponse } from 'msw';
import { ApiShoppingList } from '../app/api/models/api-shopping-list';
import {
  SupermarketProviderId,
  ApiSupermarketProduct,
  ApiSupermarketReview,
  ApiSupermarketSelection,
  ApiSupermarketSend,
} from '../app/api/models/api-supermarkets';

export const mockSupermarketProducts: ApiSupermarketProduct[] = [
  {
    id: 's1001',
    name: 'Picnic Woknoedels',
    pack: '250 g',
    priceCents: 199,
    currency: 'EUR',
    imageUrl: '/mock-products/noodles.svg',
    availability: 'Available',
    maxQuantity: 20,
  },
  {
    id: 's1002',
    name: 'Conimex Woknoedels',
    pack: '248 g',
    priceCents: 259,
    currency: 'EUR',
    imageUrl: null,
    availability: 'Available',
    maxQuantity: 20,
  },
  {
    id: 's1003',
    name: 'Picnic Melk',
    pack: '1 l',
    priceCents: 119,
    currency: 'EUR',
    imageUrl: '/mock-products/milk.svg',
    availability: 'Available',
    maxQuantity: 20,
  },
  {
    id: 's1004',
    name: 'Picnic Zout',
    pack: '500 g',
    priceCents: 89,
    currency: 'EUR',
    imageUrl: null,
    availability: 'Unavailable',
    maxQuantity: 0,
  },
  {
    id: 's-rejected',
    name: 'Test geweigerd',
    pack: '1 stuk',
    priceCents: 100,
    currency: 'EUR',
    imageUrl: null,
    availability: 'Available',
    maxQuantity: 20,
  },
  {
    id: 's-uncertain',
    name: 'Test onzeker',
    pack: '1 stuk',
    priceCents: 100,
    currency: 'EUR',
    imageUrl: null,
    availability: 'Available',
    maxQuantity: 20,
  },
];
let connection: ApiPicnicConnection;
let account = '';
let generation = '';
let mappings: Record<string, ApiSupermarketProduct>;
let verificationExpires = 0;
let codeRequested = 0;
export function resetSupermarkets() {
  connection = { status: 'Connected', accountLabel: 'picnic@example.test', countryCode: 'NL' };
  mappings = {};
  account = 'picnic@example.test';
  generation = crypto.randomUUID();
  verificationExpires = 0;
  codeRequested = 0;
}
resetSupermarkets();
const problem = (code: string, detail: string, status = 400) =>
  HttpResponse.json({ code, detail }, { status });
export function supermarketHandlers(context: {
  lists: () => Record<string, ApiShoppingList>;
  access: (admin: boolean) => boolean;
  group: (id: string | null) => string;
  unreviewed: (cycle: string) => number;
}) {
  const denied = (admin = false) =>
    context.access(admin) ? null : new HttpResponse(null, { status: admin ? 403 : 401 });
  const listItems = (id: string) => {
    const list = context.lists()[id];
    return list
      ? [
          ...list.mealGroups.flatMap((x) => [...x.items].sort((a, b) => a.order - b.order)),
          ...[...list.items].sort((a, b) => a.order - b.order),
        ]
      : null;
  };
  const revision = async (id: string) => {
    const bytes = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(
        JSON.stringify(
          listItems(id)?.map((x) => [
            x.id,
            x.name,
            x.quantity,
            x.checked,
            x.recipeProfileGroceryItemId,
          ]),
        ),
      ),
    );
    return [...new Uint8Array(bytes)]
      .map((x) => x.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase();
  };
  const needConnection = () =>
    problem('SupermarketConnectionRequired', 'Connect or reconnect Picnic in Settings.');
  return [
    http.get(
      '/api/integrations/picnic/connection',
      () =>
        denied(true) ??
        HttpResponse.json({
          ...connection,
          status:
            connection.status === 'VerificationRequired' && verificationExpires <= Date.now()
              ? 'Disconnected'
              : connection.status,
        }),
    ),
    http.get(
      '/api/supermarkets',
      () =>
        denied() ??
        HttpResponse.json([
          {
            provider: 'picnic',
            name: 'Picnic',
            accountLabel: connection.accountLabel,
            status:
              connection.status === 'VerificationRequired' ? 'Disconnected' : connection.status,
          },
        ]),
    ),
    http.post('/api/integrations/picnic/connect', async ({ request }) => {
      const no = denied(true);
      if (no) return no;
      const data = (await request.json()) as {
        email: string;
        password: string;
        countryCode: 'NL' | 'DE' | 'FR';
        resetProductMappings: boolean;
      };
      if (!['NL', 'DE', 'FR'].includes(data.countryCode))
        return problem('ValidationError', 'Choose a supported country.');
      if (data.countryCode !== connection.countryCode && !data.resetProductMappings)
        return problem(
          'SupermarketSelectionInvalid',
          'Confirm resetting saved Picnic products before changing country.',
        );
      if (
        !['picnic@example.test', 'other@example.test'].includes(data.email?.trim()) ||
        data.password !== 'Picnic123!'
      )
        return problem('SupermarketAuthentication', 'Check your supermarket email and password.');
      if (data.countryCode !== connection.countryCode) mappings = {};
      account = data.email.trim();
      generation = crypto.randomUUID();
      connection = {
        status: 'VerificationRequired',
        accountLabel: null,
        countryCode: data.countryCode,
      };
      verificationExpires = Date.now() + 10 * 60 * 1000;
      codeRequested = 0;
      return HttpResponse.json(connection);
    }),
    http.post('/api/integrations/picnic/verification-code', () => {
      const no = denied(true);
      if (no) return no;
      if (connection.status !== 'VerificationRequired' || verificationExpires <= Date.now())
        return problem(
          'SupermarketAuthentication',
          'Start a new supermarket connection before verifying.',
        );
      if (codeRequested > Date.now() - 30000)
        return problem(
          'SupermarketAuthentication',
          'Wait before requesting another verification code.',
        );
      codeRequested = Date.now();
      return HttpResponse.json(connection);
    }),
    http.post('/api/integrations/picnic/verify', async ({ request }) => {
      const no = denied(true);
      if (no) return no;
      const data = (await request.json()) as { code: string };
      if (
        connection.status !== 'VerificationRequired' ||
        verificationExpires <= Date.now() ||
        data.code !== '123456'
      )
        return problem('SupermarketAuthentication', 'The verification code is invalid.');
      connection.status = 'Connected';
      connection.accountLabel = account;
      return HttpResponse.json(connection);
    }),
    http.delete('/api/integrations/picnic/connection', () => {
      const no = denied(true);
      if (no) return no;
      connection = { ...connection, status: 'Disconnected', accountLabel: null };
      account = '';
      generation = crypto.randomUUID();
      return new HttpResponse(null, { status: 204 });
    }),
    http.get('/api/supermarkets/:provider/products', ({ params, request }) => {
      const no = denied();
      if (no) return no;
      if (params['provider'] !== 'picnic') return new HttpResponse(null, { status: 404 });
      if (connection.status !== 'Connected') return needConnection();
      const query = new URL(request.url).searchParams.get('query')?.trim().toLowerCase() ?? '';
      if (!query || query.length > 200) return HttpResponse.json([]);
      const matches = mockSupermarketProducts.filter((x) => x.name.toLowerCase().includes(query));
      return HttpResponse.json(matches.length ? matches : mockSupermarketProducts);
    }),
    http.get('/api/supermarkets/cycles/:cycle/review', async ({ params, request }) => {
      const no = denied();
      if (no) return no;
      if (new URL(request.url).searchParams.get('provider') !== 'picnic')
        return new HttpResponse(null, { status: 404 });
      if (connection.status !== 'Connected') return needConnection();
      const cycle = String(params['cycle']);
      const items = listItems(cycle);
      if (!items) return new HttpResponse(null, { status: 404 });
      const review: ApiSupermarketReview = {
        provider: 'picnic',
        accountId: account,
        connectionGeneration: generation,
        revision: await revision(cycle),
        unreviewedMeals: context.unreviewed(cycle),
        items: items.map((x) => ({
          shoppingListItemId: x.id,
          recipeProfileGroceryItemId: x.recipeProfileGroceryItemId ?? null,
          name: x.name,
          quantity: x.quantity,
          checked: x.checked,
          group: context.group(x.plannedMealId),
          product: x.recipeProfileGroceryItemId
            ? (mappings[x.recipeProfileGroceryItemId] ?? null)
            : null,
        })),
      };
      return HttpResponse.json(review);
    }),
    http.post('/api/supermarkets/cycles/:cycle/send', async ({ params, request }) => {
      const no = denied();
      if (no) return no;
      const cycle = String(params['cycle']);
      const groceries = listItems(cycle);
      const data = (await request.json()) as {
        provider: SupermarketProviderId;
        accountId: string;
        connectionGeneration: string;
        revision: string;
        items: ApiSupermarketSelection[];
        totals: { productId: string; quantity: number }[];
      };
      if (!groceries) return new HttpResponse(null, { status: 404 });
      if (data.provider !== 'picnic') return new HttpResponse(null, { status: 404 });
      if (
        connection.status !== 'Connected' ||
        data.accountId !== account ||
        data.connectionGeneration !== generation
      )
        return needConnection();
      if (data.revision !== (await revision(cycle)))
        return problem('SupermarketReviewChanged', 'The groceries changed. Reopen the review.');
      const invalid = () =>
        problem('SupermarketSelectionInvalid', 'Select valid products and whole pack quantities.');
      if (
        !data.items?.length ||
        data.items.length > 500 ||
        new Set(data.items.map((x) => x.shoppingListItemId)).size !== data.items.length ||
        data.items.some(
          (x) =>
            !groceries.some((g) => g.id === x.shoppingListItemId) ||
            !Number.isInteger(x.quantity) ||
            x.quantity < 1 ||
            x.quantity > 999,
        )
      )
        return invalid();
      const ids = [...new Set(data.items.map((x) => x.productId))];
      if (
        data.totals?.length !== ids.length ||
        new Set(data.totals.map((x) => x.productId)).size !== ids.length ||
        data.totals.some(
          (x) =>
            !ids.includes(x.productId) ||
            !Number.isInteger(x.quantity) ||
            x.quantity < 1 ||
            x.quantity > 999 ||
            !mockSupermarketProducts.some(
              (p) =>
                p.id === x.productId &&
                p.availability === 'Available' &&
                x.quantity <= (p.maxQuantity ?? 999),
            ),
        )
      )
        return invalid();
      const remembered = new Map<string, string>();
      for (const selection of data.items) {
        const source = groceries.find((x) => x.id === selection.shoppingListItemId)!;
        const slot = source.recipeProfileGroceryItemId;
        if (slot && (selection.remember || !mappings[slot])) {
          if (remembered.has(slot) && remembered.get(slot) !== selection.productId)
            return invalid();
          remembered.set(slot, selection.productId);
        }
      }
      const result: ApiSupermarketSend = {
        planningCycleId: cycle,
        provider: data.provider,
        accountId: account,
        accountLabel: account,
        connectionGeneration: generation,
        lines: [],
      };
      let stopped = false;
      for (const total of data.totals) {
        const product = mockSupermarketProducts.find((x) => x.id === total.productId)!;
        const outcome = stopped
          ? 'NotAttempted'
          : product.id.startsWith('s-rejected')
            ? 'Failed'
            : product.id === 's-uncertain'
              ? 'Unknown'
              : 'Added';
        const sources = data.items.filter((x) => x.productId === product.id);
        result.lines.push({
          productId: product.id,
          productName: product.name,
          pack: product.pack,
          quantity: total.quantity,
          outcome,
          reason: outcome === 'Added' ? null : outcome === 'Failed' ? 'Rejected' : 'Uncertain',
          shoppingListItemIds: sources.map((x) => x.shoppingListItemId),
          localWarning: null,
        });
        if (outcome === 'Unknown') stopped = true;
        if (outcome === 'Added')
          for (const source of sources) {
            const item = groceries.find((x) => x.id === source.shoppingListItemId)!;
            item.checked = true;
            if (
              item.recipeProfileGroceryItemId &&
              (source.remember || !mappings[item.recipeProfileGroceryItemId])
            )
              mappings[item.recipeProfileGroceryItemId] = product;
          }
      }
      return HttpResponse.json(result);
    }),
  ];
}
