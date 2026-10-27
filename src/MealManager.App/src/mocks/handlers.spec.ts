/// <reference types="node" />
import { setupServer } from 'msw/node';
import { File as NodeFile } from 'node:buffer';
import { handlers, resetMockData } from './handlers';

describe('mock meal plan contracts', () => {
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

  it('returns upcoming entries across cycles with bounded calendar dates and input validation', async () => {
    const previous = await (await api('/api/meal-plans/cycle/c1')).json();
    const middle = await (await api('/api/meal-plans/cycle/c2')).json();
    const currentCycle = await (await api('/api/planning-cycles/current')).json();
    const current = await (await api(`/api/meal-plans/cycle/${currentCycle.id}`)).json();
    const all = [...previous.entries, ...middle.entries, ...current.entries].sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
    const fromDate = all[0].date;
    const result = await (await api(`/api/meal-plans/upcoming?fromDate=${fromDate}`)).json();
    expect(result.entries.map((entry: { id: string }) => entry.id)).toEqual(
      all.slice(0, 3).map((entry) => entry.id),
    );
    expect(result.plannedDates).toContain(fromDate);
    expect((await api('/api/meal-plans/upcoming')).status).toBe(422);
    expect((await api('/api/meal-plans/upcoming?fromDate=invalid')).status).toBe(422);
    expect((await api('/api/meal-plans/upcoming?fromDate=9999-12-31')).status).toBe(400);
    expect(
      (await (await api('/api/meal-plans/upcoming?fromDate=9999-12-25')).json()).entries,
    ).toEqual([]);
  });

  it('suggests retained shopping names across cycles and validates bounds', async () => {
    const current = await (await api('/api/planning-cycles/current')).json();
    await api('/api/shopping-lists/cycle/c1/items', 'POST', { name: 'WC papier', quantity: 1 });
    await api(`/api/shopping-lists/cycle/${current.id}/items`, 'POST', {
      name: 'wc papier',
      quantity: 1,
    });
    await api(`/api/shopping-lists/cycle/${current.id}/items`, 'POST', {
      name: 'vochtig wc papier',
      quantity: 1,
    });
    expect(await (await api('/api/shopping-lists/suggestions?search=WC')).json()).toEqual([
      'WC papier',
      'vochtig wc papier',
    ]);
    expect(await (await api('/api/shopping-lists/suggestions?search=wc&limit=1')).json()).toEqual([
      'WC papier',
    ]);
    expect(await (await api('/api/shopping-lists/suggestions?search=')).json()).toEqual([]);
    expect((await api('/api/shopping-lists/suggestions?search=wc&limit=21')).status).toBe(400);
  });

  it('returns not found for an unknown cycle meal plan', async () => {
    expect((await api('/api/meal-plans/cycle/missing')).status).toBe(404);
    expect((await api('/api/shopping-lists/cycle/missing')).status).toBe(404);
  });

  it('trims recipe search and treats punctuation as literal text', async () => {
    const source = await (await api('/api/recipes/r1')).json();
    const changed = await api('/api/recipes/r1', 'PUT', {
      ...source,
      name: 'Één %_.*[ dish',
      tags: [],
    });
    expect(changed.status).toBe(200);
    const matches = await (
      await api('/api/recipes?search=' + encodeURIComponent('  éÉN %_.*[  '))
    ).json();
    expect(matches.map((recipe: { id: string }) => recipe.id)).toEqual(['r1']);
  });

  it('requires replacement after an administrator reset before household access', async () => {
    const created = await api('/api/users', 'POST', {
      displayName: 'Member',
      email: 'member@example.test',
      password: 'Member123!',
      isAdmin: false,
    });
    const member = await created.json();
    expect(
      (
        await api(`/api/users/${member.id}/reset-password`, 'POST', {
          temporaryPassword: 'Temporary123!',
        })
      ).status,
    ).toBe(204);
    expect(
      (
        await api('/api/authentication/login', 'POST', {
          email: member.email,
          password: 'Temporary123!',
        })
      ).status,
    ).toBe(204);
    expect(await (await api('/api/users/me')).json()).toMatchObject({ mustChangePassword: true });
    const blocked = await api('/api/recipes');
    expect(blocked.status).toBe(403);
    expect(await blocked.json()).toMatchObject({ code: 'PasswordChangeRequired' });
    expect((await api('/api/users/me', 'PUT', { displayName: 'Blocked' })).status).toBe(403);
    expect(
      (
        await api('/api/authentication/change-password', 'POST', {
          currentPassword: 'Temporary123!',
          newPassword: 'Personal123!',
        })
      ).status,
    ).toBe(204);
    expect((await api('/api/recipes')).status).toBe(200);
  });

  it('allows historical content and shopping edits while retaining cycle structure protection', async () => {
    expect((await api('/api/planning-cycles/c1', 'DELETE')).status).toBe(400);
    expect(
      (await api('/api/planned-meals/m-prev-1/groceries', 'POST', { groceries: [] })).status,
    ).toBe(201);
    expect((await api('/api/planned-meals/m-prev-1', 'DELETE')).status).toBe(204);
    expect(
      (await api('/api/shopping-lists/cycle/c1/items', 'POST', { name: 'Milk', quantity: 1 }))
        .status,
    ).toBe(201);
  });

  it('rejects an out-of-range meal and accepts an explicit empty review', async () => {
    const cycle = await (await api('/api/planning-cycles/current')).json();
    const mealPlan = await (await api(`/api/meal-plans/cycle/${cycle.id}`)).json();
    const meal = {
      mealPlanId: mealPlan.id,
      recipeId: 'r1',
      recipeProfileId: 'r1-p1',
      date: '2000-01-01',
    };
    expect((await api('/api/planned-meals', 'POST', meal)).status).toBe(400);
    const response = await api('/api/planned-meals', 'POST', { ...meal, date: cycle.startDate });
    expect(response.status).toBe(201);
    const created = await response.json();
    const review = await api(`/api/planned-meals/${created.id}/groceries`, 'POST', {
      groceries: [],
    });
    expect(review.status).toBe(201);
    expect(await review.json()).toMatchObject({ meal: { id: created.id }, items: [] });
    const updated = await (await api(`/api/meal-plans/cycle/${cycle.id}`)).json();
    expect(
      updated.entries.find((entry: { id: string }) => entry.id === created.id).hasReviewedGroceries,
    ).toBe(true);
  });

  it('rejects shrinking a cycle around an existing entry', async () => {
    const cycle = await (await api('/api/planning-cycles/current')).json();
    const mealPlan = await (await api(`/api/meal-plans/cycle/${cycle.id}`)).json();
    await api('/api/planned-meals', 'POST', {
      mealPlanId: mealPlan.id,
      recipeId: 'r1',
      recipeProfileId: 'r1-p1',
      date: cycle.endDate,
    });
    expect(
      (
        await api(`/api/planning-cycles/${cycle.id}`, 'PUT', {
          startDate: cycle.startDate,
          endDate: cycle.startDate,
        })
      ).status,
    ).toBe(400);
  });

  it('normalizes and preserves submitted recipe ingredient order', async () => {
    const recipe = (await (await api('/api/recipes/r1')).json()) as {
      name: string;
      category: string;
      baseServings: number;
      tags: { name: string }[];
      ingredients: { id: string; name: string; quantity: number; unit: string; order: number }[];
      steps: unknown[];
    };
    const ingredients = [...recipe.ingredients].reverse();

    const response = await api('/api/recipes/r1', 'PUT', {
      name: recipe.name,
      category: recipe.category,
      baseServings: recipe.baseServings,
      tags: recipe.tags.map((tag) => tag.name),
      ingredients,
      steps: recipe.steps,
    });

    expect(response.status).toBe(200);
    const reloaded = (await (await api('/api/recipes/r1')).json()) as typeof recipe;
    expect(reloaded.ingredients.map(({ name, order }) => ({ name, order }))).toEqual(
      ingredients.map((ingredient, order) => ({ name: ingredient.name, order })),
    );
  });

  it('rejects unreadable uploads without mutating images and allows retry with a PNG', async () => {
    // Undici captures Node's File before jsdom replaces the global constructor.
    // Keep its multipart parser in the same realm for this HTTP contract check.
    const browserFile = globalThis.File;
    vi.stubGlobal('File', NodeFile);
    try {
      const initial = await (await api('/api/recipes/r1')).json();
      const upload = async (image: Uint8Array) => {
        const prefix = new TextEncoder().encode(
          '--qa-image\r\nContent-Disposition: form-data; name="image"; filename="photo.png"\r\nContent-Type: image/png\r\n\r\n',
        );
        const suffix = new TextEncoder().encode('\r\n--qa-image--\r\n');
        const body = new Uint8Array(prefix.length + image.length + suffix.length);
        body.set(prefix);
        body.set(image, prefix.length);
        body.set(suffix, prefix.length + image.length);
        const request = new Request(new URL('/api/recipes/r1/images', document.baseURI), {
          method: 'POST',
          headers: { 'Content-Type': 'multipart/form-data; boundary=qa-image' },
          body,
        });
        return fetch(request);
      };
      for (const image of [new Uint8Array(), new TextEncoder().encode('not an image')]) {
        expect((await upload(image)).status).toBe(400);
        expect((await (await api('/api/recipes/r1')).json()).images).toEqual(initial.images);
      }
      const png = Uint8Array.from(
        atob(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a0K0AAAAASUVORK5CYII=',
        ),
        (character) => character.charCodeAt(0),
      );
      const response = await upload(png);
      expect(response.status).toBe(201);
      expect((await response.json()).url).toBe('/icons/app-icon-192.png');
      expect((await (await api('/api/recipes/r1')).json()).images).toHaveLength(
        initial.images.length + 1,
      );
    } finally {
      vi.stubGlobal('File', browserFile);
    }
  });

  it('resets authentication, users and setup state together with the household data', async () => {
    const original = await (await api('/api/users')).json();
    expect(
      (
        await api('/api/users', 'POST', {
          email: 'extra@example.test',
          displayName: 'Extra',
          isAdmin: false,
          password: 'Pass123!',
        })
      ).status,
    ).toBe(201);
    await api('/api/authentication/logout', 'POST');
    expect((await api('/api/users/me')).status).toBe(401);
    expect((await api('/api/users')).status).toBe(401);
    resetMockData();
    expect(await (await api('/api/users')).json()).toEqual(original);
    expect(await (await api('/api/authentication/session')).json()).toEqual({
      isAuthenticated: true,
    });
    expect((await api('/api/config/initialize', 'POST')).status).toBe(400);
    expect((await api('/api/users/missing', 'DELETE')).status).toBe(404);
  });

  it('rejects duplicate and foreign recipe rows and recipes used by meal plans', async () => {
    const recipe = await (await api('/api/recipes/r1')).json();
    const other = await (await api('/api/recipes/r2')).json();
    const body = { ...recipe, tags: recipe.tags.map((tag: { name: string }) => tag.name) };
    expect(
      (
        await api('/api/recipes/r1', 'PUT', {
          ...body,
          ingredients: [recipe.ingredients[0], recipe.ingredients[0]],
        })
      ).status,
    ).toBe(400);
    expect((await api('/api/recipes/r1', 'PUT', { ...body, steps: [other.steps[0]] })).status).toBe(
      400,
    );
    expect((await api('/api/recipes/r1', 'DELETE')).status).toBe(400);
    expect((await api('/api/recipe-profiles/r1-p1', 'DELETE')).status).toBe(400);
    expect((await (await api('/api/recipes/r1')).json()).name).toBe(recipe.name);
  });

  it('uses server-created grocery IDs and consistent grocery name validation', async () => {
    const draft = {
      recipeId: 'r1',
      name: 'New',
      servings: 2,
      groceries: [{ id: 'draft', name: 'Rice', quantity: 1, atHome: false }],
    };
    const created = await api('/api/recipe-profiles', 'POST', draft);
    expect(created.status).toBe(201);
    const profile = await created.json();
    expect(profile.groceries[0].id).not.toBe('draft');
    expect(profile.groceries[0].order).toBe(0);
    expect(
      (
        await api('/api/recipe-profiles', 'POST', {
          ...draft,
          groceries: [{ ...draft.groceries[0], name: 'a'.repeat(201) }],
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await api('/api/recipe-profiles/' + profile.id, 'PUT', {
          ...profile,
          groceries: [profile.groceries[0], profile.groceries[0]],
        })
      ).status,
    ).toBe(400);
  });
  it('rejects fractional profile servings and purchase quantities on create and update', async () => {
    const profile = await (await api('/api/recipe-profiles/r1-p1')).json();
    for (const invalid of [
      { ...profile, servings: 1.5 },
      { ...profile, groceries: [{ name: 'Rice', quantity: 1.5, atHome: false }] },
    ]) {
      expect(
        (await api('/api/recipe-profiles', 'POST', { ...invalid, recipeId: 'r1' })).status,
      ).toBe(400);
      expect((await api('/api/recipe-profiles/r1-p1', 'PUT', invalid)).status).toBe(400);
    }
  });
});
