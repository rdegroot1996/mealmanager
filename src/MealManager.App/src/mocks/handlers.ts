import { DateTime } from 'luxon';
import { MockPlanning, MockPlanningLeftover } from './data/mock-planning';
import { http, HttpResponse } from 'msw';
import { recipes, MockRecipe } from './data/recipes';
import { cycles } from './data/planning-cycles';
import { mockImageUploadError } from './image-upload';
import { plannings } from './data/plannings';
import { groceries } from './data/groceries';
import { ApiPlanningCycle } from '../app/api/models/api-planning-cycle';
import { ApiPlanningEntry, ApiPlanningNote } from '../app/api/models/api-planning';
import { ApiGroceryList, ApiGroceryItem } from '../app/api/models/api-groceries';
import { ApiConfig } from '../app/api/models/api-config';
import { ApiUser } from '../app/api/models/api-user';
import { resetSupermarkets, supermarketHandlers } from './supermarkets';

// Deep-clone mutable state so handlers can mutate freely
let recipeDb: MockRecipe[] = structuredClone(recipes);
let cycleDb: ApiPlanningCycle[] = structuredClone(cycles);
let planningDb: Record<string, MockPlanning> = structuredClone(plannings);
let groceryDb: Record<string, ApiGroceryList> = structuredClone(groceries);
let configDb: ApiConfig = { appInitialized: true };

let isAuthenticated = true;
const initialUsers: ApiUser[] = [
  {
    id: '01990c2e-7f00-7000-8000-000000000001',
    email: 'admin@example.test',
    displayName: 'MealManager Admin',
    isAdmin: true,
  },
];
let userDb = structuredClone(initialUsers);
const currentUserId = initialUsers[0].id;

export function resetMockData() {
  resetSupermarkets();
  configDb = { appInitialized: true };
  isAuthenticated = true;
  userDb = structuredClone(initialUsers);
  recipeDb = structuredClone(recipes);
  cycleDb = structuredClone(cycles);
  planningDb = structuredClone(plannings);
  groceryDb = structuredClone(groceries);
}

function userAccess() {
  if (!isAuthenticated) return new HttpResponse(null, { status: 401 });
  if (!userDb.find((user) => user.id === currentUserId)?.isAdmin)
    return new HttpResponse(null, { status: 403 });
  return null;
}

function activeCycle() {
  return [...cycleDb].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
}
function planningAccess(cycleId: string, date?: string) {
  const cycle = cycleDb.find((c) => c.id === cycleId);
  if (!cycle) return new HttpResponse(null, { status: 404 });
  if (cycle.id !== activeCycle()?.id)
    return HttpResponse.json(
      { code: 'HistoricalCycleReadOnly', detail: 'Historical planning cycles are read-only.' },
      { status: 400 },
    );
  if (date && (!DateTime.fromISO(date).isValid || date < cycle.startDate || date > cycle.endDate))
    return HttpResponse.json(
      { code: 'DateOutsideCycle', detail: 'Planning entries must stay inside the cycle.' },
      { status: 400 },
    );
  return null;
}
function validRange(startDate: string, endDate: string) {
  return (
    DateTime.fromISO(startDate).isValid && DateTime.fromISO(endDate).isValid && startDate <= endDate
  );
}

type MockPlanningOrderableEntry = ApiPlanningEntry | MockPlanningLeftover;

function getDayEntries(
  planning: MockPlanning,
  date: string,
  excludedId?: string,
): MockPlanningOrderableEntry[] {
  return [...planning.meals, ...planning.leftovers]
    .filter((entry) => entry.date === date && entry.id !== excludedId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function reindexDay(planning: MockPlanning, date: string) {
  getDayEntries(planning, date).forEach((entry, index) => (entry.sortOrder = index));
}

function movePlanningEntry(
  planning: MockPlanning,
  entry: MockPlanningOrderableEntry,
  targetDate: string,
  targetIndex?: number,
) {
  const sourceDate = entry.date;
  entry.date = targetDate;
  const targetEntries = getDayEntries(planning, targetDate, entry.id);
  targetEntries.splice(
    Math.min(Math.max(targetIndex ?? targetEntries.length, 0), targetEntries.length),
    0,
    entry,
  );
  targetEntries.forEach((target, index) => (target.sortOrder = index));
  if (sourceDate !== targetDate) reindexDay(planning, sourceDate);
}

function toPlanningEntry(
  planning: MockPlanning,
  entry: MockPlanningOrderableEntry,
): ApiPlanningEntry | null {
  if ('recipe' in entry) {
    return {
      ...entry,
      kind: 'Meal',
      originalMealId: null,
      recipe: { ...entry.recipe, isFavorite: !!entry.recipe.isFavorite },
    };
  }

  const original = planning.meals.find((meal) => meal.id === entry.originalMealId);
  return original
    ? {
        ...original,
        id: entry.id,
        kind: 'Leftover',
        originalMealId: original.id,
        date: entry.date,
        sortOrder: entry.sortOrder,
        recipe: { ...original.recipe, isFavorite: !!original.recipe.isFavorite },
      }
    : null;
}

function toPlanningEntries(planning: MockPlanning): ApiPlanningEntry[] {
  return [...planning.meals, ...planning.leftovers]
    .map((entry) => toPlanningEntry(planning, entry))
    .filter((entry): entry is ApiPlanningEntry => entry !== null)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
}

export const handlers = [
  ...supermarketHandlers({
    lists: () => groceryDb,
    access: (admin) =>
      isAuthenticated && (!admin || !!userDb.find((x) => x.id === currentUserId)?.isAdmin),
    group: (id) =>
      id
        ? (Object.values(planningDb)
            .flatMap((x) => x.meals)
            .find((x) => x.id === id)?.recipe.name ?? 'Meal')
        : 'Other items',
    unreviewed: (cycle) => planningDb[cycle]?.meals.filter((x) => !x.hasGroceriesAdded).length ?? 0,
  }),
  // ── Configuration ─────────────────────────────────────────
  http.get('/api/config', () => HttpResponse.json(configDb)),

  http.post('/api/config/initialize', () => {
    if (configDb.appInitialized)
      return HttpResponse.json({ code: 'ApplicationAlreadyInitialized' }, { status: 400 });
    configDb = { appInitialized: true };
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Authentication ────────────────────────────────────────
  http.get('/api/authentication/session', () => HttpResponse.json({ isAuthenticated })),

  http.post('/api/authentication/login', async ({ request }) => {
    const body = (await request.json()) as { email?: string; password?: string };
    if (!body.email || !body.password) return new HttpResponse(null, { status: 401 });
    isAuthenticated = true;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/authentication/logout', () => {
    isAuthenticated = false;
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Users ────────────────────────────────────────────────
  http.get('/api/users/me', () => {
    if (!isAuthenticated) return new HttpResponse(null, { status: 401 });
    const user = userDb.find(({ id }) => id === currentUserId);
    return user ? HttpResponse.json(user) : new HttpResponse(null, { status: 404 });
  }),

  http.get('/api/users', () => userAccess() ?? HttpResponse.json(userDb)),

  http.post('/api/users', async ({ request }) => {
    const denied = userAccess();
    if (denied) return denied;
    const body = (await request.json()) as Omit<ApiUser, 'id'> & { password: string };
    if (userDb.some(({ email }) => email.toLowerCase() === body.email.toLowerCase())) {
      return HttpResponse.json(
        { title: 'A user with this email already exists.' },
        { status: 400 },
      );
    }
    const { password: _password, ...details } = body;
    const user: ApiUser = { ...details, id: crypto.randomUUID() };
    userDb.push(user);
    return HttpResponse.json(user, { status: 201 });
  }),

  http.put('/api/users/:id', async ({ params, request }) => {
    const denied = userAccess();
    if (denied) return denied;
    const index = userDb.findIndex(({ id }) => id === params['id']);
    if (index < 0) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as Pick<ApiUser, 'displayName' | 'isAdmin'>;
    if (userDb[index].id === currentUserId && !body.isAdmin) {
      return HttpResponse.json(
        { code: 'CannotRemoveOwnAdminRole', title: 'Cannot remove admin role from yourself.' },
        { status: 400 },
      );
    }
    userDb[index] = { ...userDb[index], ...body };
    return HttpResponse.json(userDb[index]);
  }),

  http.delete('/api/users/:id', ({ params }) => {
    const denied = userAccess();
    if (denied) return denied;
    if (!userDb.some((user) => user.id === params['id']))
      return new HttpResponse(null, { status: 404 });
    if (params['id'] === currentUserId) {
      return HttpResponse.json(
        { code: 'CannotDeleteSelf', title: 'Cannot delete yourself.' },
        { status: 400 },
      );
    }
    userDb = userDb.filter(({ id }) => id !== params['id']);
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Recipes ────────────────────────────────────────────────
  http.get('/api/recipes', ({ request }) => {
    const url = new URL(request.url);
    const category = url.searchParams.get('category');
    const tags = url.searchParams.getAll('tags');
    const search = url.searchParams.get('search')?.toLowerCase();
    const favorite = url.searchParams.get('favorite');
    const sort = url.searchParams.get('sort') ?? 'Name';
    const today = DateTime.local().toISODate()!;
    const firstRecentDate = new Date();
    firstRecentDate.setDate(firstRecentDate.getDate() - 89);
    const firstRecentDateText = firstRecentDate.toISOString().slice(0, 10);

    const results = recipeDb.filter(
      (recipe) =>
        (!category || recipe.category === category) &&
        (!search || recipe.name.toLowerCase().includes(search)) &&
        (favorite === null || !!recipe.isFavorite === (favorite === 'true')) &&
        tags.every((tag) => recipe.tags.some((recipeTag) => recipeTag.name === tag)),
    );

    const mapped = results.map((recipe) => {
      const plannedDates = Object.values(planningDb)
        .flatMap((planning) => planning.meals)
        .filter((meal) => meal.recipe.id === recipe.id && meal.date <= today)
        .map((meal) => meal.date)
        .sort((left, right) => right.localeCompare(left));
      return {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        baseServings: recipe.baseServings,
        tags: recipe.tags,
        imageUrl: recipe.images.length > 0 ? recipe.images[0].url : null,
        isFavorite: !!recipe.isFavorite,
        ingredients: recipe.ingredients,
        profiles: recipe.profiles.map(({ id, name, servings }) => ({ id, name, servings })),
        upcomingTimesPlanned: Object.values(planningDb)
          .flatMap((planning) => planning.meals)
          .filter((meal) => meal.recipe.id === recipe.id && meal.date > today).length,
        pastTimesPlanned: plannedDates.length,
        lastPastPlanned: plannedDates[0] ?? null,
      };
    });

    mapped.sort((left, right) => {
      const tie = left.name.localeCompare(right.name) || left.id.localeCompare(right.id);
      const frequency = (value: typeof left) => value.pastTimesPlanned + value.upcomingTimesPlanned;
      if (sort === 'MostPlanned') return frequency(right) - frequency(left) || tie;
      if (sort === 'LeastPlanned')
        return (
          frequency(left) - frequency(right) ||
          (left.lastPastPlanned ?? '').localeCompare(right.lastPastPlanned ?? '') ||
          tie
        );
      if (sort === 'MostRecentlyPlanned')
        return (right.lastPastPlanned ?? '').localeCompare(left.lastPastPlanned ?? '') || tie;
      if (sort === 'LeastRecentlyPlanned') {
        if (left.lastPastPlanned === null && right.lastPastPlanned !== null) return -1;
        if (left.lastPastPlanned !== null && right.lastPastPlanned === null) return 1;
        return (
          (left.lastPastPlanned ?? '').localeCompare(right.lastPastPlanned ?? '') ||
          left.name.localeCompare(right.name)
        );
      }
      if (sort === 'RecentPlanningPopularity') {
        const recentCount = (recipeId: string) =>
          Object.values(planningDb)
            .flatMap((planning) => planning.meals)
            .filter(
              (meal) =>
                meal.recipe.id === recipeId &&
                meal.date >= firstRecentDateText &&
                meal.date <= today,
            ).length;
        return recentCount(right.id) - recentCount(left.id) || left.name.localeCompare(right.name);
      }
      return left.name.localeCompare(right.name);
    });

    return HttpResponse.json(mapped);
  }),

  http.get('/api/recipes/tags', ({ request }) => {
    const search = new URL(request.url).searchParams.get('search')?.trim().toLowerCase() ?? '';
    const counts = new Map<string, number>();
    for (const recipe of recipeDb) {
      for (const name of new Set(recipe.tags.map((tag) => tag.name))) {
        if (name.toLowerCase().includes(search)) counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    }
    return HttpResponse.json(
      [...counts]
        .map(([name, recipeCount]) => ({ name, recipeCount }))
        .sort((a, b) => b.recipeCount - a.recipeCount || a.name.localeCompare(b.name))
        .slice(0, 50),
    );
  }),

  http.get('/api/recipes/:id', ({ params }) => {
    const recipe = recipeDb.find((r) => r.id === params['id']);
    if (!recipe) return new HttpResponse(null, { status: 404 });
    const plannedMeals = Object.values(planningDb)
      .flatMap((planning) => planning.meals)
      .filter((meal) => meal.recipe.id === recipe.id);
    const today = DateTime.local().toISODate()!;
    const pastMeals = plannedMeals.filter((meal) => meal.date <= today);
    const lastPlanned = pastMeals
      .map((meal) => meal.date)
      .sort((left, right) => right.localeCompare(left))[0];
    return HttpResponse.json({
      ...recipe,
      ingredients: [...recipe.ingredients].sort((a, b) => a.order - b.order),
      isFavorite: !!recipe.isFavorite,
      profiles: recipe.profiles.map(({ id, name, servings }) => ({ id, name, servings })),
      planningStatistics: {
        timesPlanned: pastMeals.length,
        upcomingTimesPlanned: plannedMeals.length - pastMeals.length,
        lastPlanned: lastPlanned ?? null,
      },
    });
  }),

  http.post('/api/recipes', async ({ request }) => {
    const body = (await request.json()) as Omit<
      MockRecipe,
      'id' | 'images' | 'profiles' | 'tags'
    > & {
      tags: string[];
    };
    if (
      !['Meals', 'Baking', 'Desserts', 'Snacks', 'Other'].includes(body.category) ||
      (body.notes?.length ?? 0) > 4000 ||
      body.tags.some((tag) => !tag.trim())
    )
      return HttpResponse.json(
        { detail: 'Invalid category or notes longer than 4000 characters.' },
        { status: 400 },
      );
    const newRecipe: MockRecipe = {
      ...body,
      ingredients: body.ingredients.map((ingredient, order) => ({
        ...ingredient,
        id: crypto.randomUUID(),
        order,
      })),
      steps: body.steps.map((step, order) => ({ ...step, id: crypto.randomUUID(), order })),
      id: crypto.randomUUID(),
      isFavorite: false,
      images: [],
      profiles: [
        {
          id: crypto.randomUUID(),
          name: 'Default',
          servings: body.baseServings,
          products: [],
        },
      ],
      tags: [...new Set(body.tags)].map((name) => ({ id: crypto.randomUUID(), name })),
    };
    recipeDb.push(newRecipe);
    return HttpResponse.json(newRecipe, { status: 201 });
  }),

  http.put('/api/recipes/:id', async ({ params, request }) => {
    const idx = recipeDb.findIndex((r) => r.id === params['id']);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as Omit<
      MockRecipe,
      'id' | 'images' | 'profiles' | 'tags'
    > & {
      tags: string[];
    };
    if (
      !['Meals', 'Baking', 'Desserts', 'Snacks', 'Other'].includes(body.category) ||
      (body.notes?.length ?? 0) > 4000 ||
      body.tags.some((tag) => !tag.trim())
    )
      return HttpResponse.json(
        { detail: 'Invalid category or notes longer than 4000 characters.' },
        { status: 400 },
      );
    for (const field of ['ingredients', 'steps'] as const) {
      const ids = body[field].map((row) => row.id).filter(Boolean);
      if (
        new Set(ids).size !== ids.length ||
        recipeDb.some(
          (recipe) =>
            recipe.id !== params['id'] && recipe[field].some((row) => ids.includes(row.id)),
        )
      )
        return HttpResponse.json({ code: 'ValidationError' }, { status: 400 });
    }
    recipeDb[idx] = {
      ...body,
      ingredients: body.ingredients.map((ingredient, order) => ({
        ...ingredient,
        id: ingredient.id || crypto.randomUUID(),
        order,
      })),
      steps: body.steps.map((step, order) => ({
        ...step,
        id: step.id || crypto.randomUUID(),
        order,
      })),
      isFavorite: recipeDb[idx].isFavorite,
      id: params['id'] as string,
      images: recipeDb[idx].images,
      profiles: recipeDb[idx].profiles,
      tags: [...new Set(body.tags)].map((name, tagIndex) => ({
        id: recipeDb[idx].tags[tagIndex]?.id ?? crypto.randomUUID(),
        name,
      })),
    };
    return HttpResponse.json({
      ...recipeDb[idx],
      profiles: recipeDb[idx].profiles.map(({ id, name, servings }) => ({ id, name, servings })),
    });
  }),

  http.delete('/api/recipes/:id', ({ params }) => {
    const idx = recipeDb.findIndex((r) => r.id === params['id']);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    if (
      Object.values(planningDb).some((planning) =>
        planning.meals.some((meal) => meal.recipe.id === params['id']),
      )
    )
      return HttpResponse.json({ code: 'RecipeInUse' }, { status: 400 });
    recipeDb.splice(idx, 1);
    return new HttpResponse(null, { status: 204 });
  }),

  http.put('/api/recipes/:id/favorite', async ({ params, request }) => {
    const recipe = recipeDb.find((entry) => entry.id === params['id']);
    if (!recipe) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { isFavorite: boolean };
    recipe.isFavorite = body.isFavorite;
    return HttpResponse.json({
      id: recipe.id,
      name: recipe.name,
      category: recipe.category,
      tags: recipe.tags,
      imageUrl: recipe.images[0]?.url ?? null,
      isFavorite: !!recipe.isFavorite,
    });
  }),

  http.post('/api/recipes/:id/images', async ({ params, request }) => {
    const recipe = recipeDb.find((entry) => entry.id === params['id']);
    if (!recipe) return new HttpResponse(null, { status: 404 });

    let upload: FormDataEntryValue | null;
    try {
      upload = (await request.formData()).get('image');
    } catch {
      upload = null;
    }
    if (!upload || typeof upload === 'string') {
      return HttpResponse.json(
        { detail: 'Upload a non-empty image smaller than 10 MB.' },
        { status: 400 },
      );
    }
    const error = mockImageUploadError(
      upload.size,
      new Uint8Array(await upload.slice(0, 16).arrayBuffer()),
    );
    if (error) return HttpResponse.json({ detail: error }, { status: 400 });

    const imageId = crypto.randomUUID();
    const image = {
      id: imageId,
      url: '/icons/app-icon-192.png',
      order: recipe.images.length,
    };
    recipe.images.push(image);
    return HttpResponse.json(image, { status: 201 });
  }),

  http.put('/api/recipes/:id/images/order', async ({ params, request }) => {
    const recipe = recipeDb.find((entry) => entry.id === params['id']);
    if (!recipe) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { imageIds: string[] };
    if (
      body.imageIds.length !== recipe.images.length ||
      new Set(body.imageIds).size !== recipe.images.length ||
      recipe.images.some((image) => !body.imageIds.includes(image.id))
    ) {
      return new HttpResponse(null, { status: 400 });
    }

    const images = new Map(recipe.images.map((image) => [image.id, image]));
    recipe.images = body.imageIds.map((imageId, order) => ({ ...images.get(imageId)!, order }));
    return HttpResponse.json(recipe.images);
  }),

  http.delete('/api/recipes/:recipeId/images/:imageId', ({ params }) => {
    const recipe = recipeDb.find((entry) => entry.id === params['recipeId']);
    if (!recipe) return new HttpResponse(null, { status: 404 });
    const imageIndex = recipe.images.findIndex((image) => image.id === params['imageId']);
    if (imageIndex === -1) return new HttpResponse(null, { status: 404 });
    recipe.images.splice(imageIndex, 1);
    recipe.images.forEach((image, order) => (image.order = order));
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Recipe Profiles ────────────────────────────────────────
  http.post('/api/recipe-profiles', async ({ request }) => {
    const body = (await request.json()) as {
      recipeId: string;
      name: string;
      servings: number;
      products: { name: string; quantity: number; atHome: boolean; order?: number }[];
    };
    const recipe = recipeDb.find((r) => r.id === body.recipeId);
    if (!recipe) return new HttpResponse(null, { status: 404 });
    body.products ??= [];
    if (
      !body.name.trim() ||
      body.servings < 1 ||
      body.products.some(
        (product) => !product.name.trim() || product.name.length > 200 || product.quantity < 1,
      )
    )
      return HttpResponse.json({ code: 'ValidationError' }, { status: 400 });
    const newProfile = {
      id: crypto.randomUUID(),
      name: body.name,
      servings: body.servings,
      products: body.products.map((p, order) => ({ ...p, id: crypto.randomUUID(), order })),
    };
    recipe.profiles.push(newProfile);
    return HttpResponse.json(newProfile, { status: 201 });
  }),

  http.get('/api/recipe-profiles/:id', ({ params }) => {
    const profileId = params['id'] as string;
    for (const recipe of recipeDb) {
      const profile = recipe.profiles.find((p) => p.id === profileId);
      if (profile) return HttpResponse.json(profile);
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.put('/api/recipe-profiles/:id', async ({ params, request }) => {
    const profileId = params['id'] as string;
    const body = (await request.json()) as {
      name: string;
      servings: number;
      products: {
        id?: string;
        name: string;
        quantity: number;
        atHome: boolean;
        order?: number;
      }[];
    };
    const ids = body.products.map((product) => product.id).filter((id): id is string => !!id);
    if (
      !body.name.trim() ||
      body.servings < 1 ||
      new Set(ids).size !== ids.length ||
      body.products.some(
        (product) => !product.name.trim() || product.name.length > 200 || product.quantity < 1,
      ) ||
      recipeDb.some((recipe) =>
        recipe.profiles.some(
          (profile) =>
            profile.id !== profileId &&
            profile.products.some((product) => ids.includes(product.id)),
        ),
      )
    )
      return HttpResponse.json({ code: 'ValidationError' }, { status: 400 });
    for (const recipe of recipeDb) {
      const idx = recipe.profiles.findIndex((p) => p.id === profileId);
      if (idx !== -1) {
        recipe.profiles[idx] = {
          id: profileId,
          name: body.name,
          servings: body.servings,
          products: body.products.map((product, order) => ({
            ...product,
            id: product.id || crypto.randomUUID(),
            order,
          })),
        };
        return HttpResponse.json(recipe.profiles[idx]);
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.delete('/api/recipe-profiles/:id', ({ params }) => {
    const profileId = params['id'] as string;
    if (
      Object.values(planningDb).some((planning) =>
        planning.meals.some((meal) => meal.recipeProfile.id === profileId),
      )
    )
      return HttpResponse.json({ code: 'RecipeProfileInUse' }, { status: 400 });
    for (const recipe of recipeDb) {
      const idx = recipe.profiles.findIndex((p) => p.id === profileId);
      if (idx !== -1) {
        if (recipe.profiles.length === 1) {
          return HttpResponse.json(
            { code: 'RecipeMustKeepProfile', detail: 'A recipe must have at least one profile.' },
            { status: 400 },
          );
        }
        recipe.profiles.splice(idx, 1);
        return new HttpResponse(null, { status: 204 });
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  // ── Planning Cycles ────────────────────────────────────────
  http.get('/api/planning-cycles/current', () => {
    const cycle = [...cycleDb].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    if (!cycle) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(cycle);
  }),

  http.get('/api/planning-cycles/:id', ({ params }) => {
    const cycle = cycleDb.find((c) => c.id === params['id']);
    if (!cycle) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(cycle);
  }),

  http.post('/api/planning-cycles', async ({ request }) => {
    const body = (await request.json()) as { startDate: string; endDate: string };
    if (!validRange(body.startDate, body.endDate)) return new HttpResponse(null, { status: 400 });
    const latest = [...cycleDb].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    if (latest && body.startDate <= latest.startDate) {
      return HttpResponse.json(
        {
          code: 'CycleMustStartAfterExisting',
          detail: 'A new planning cycle must start after every existing cycle.',
        },
        { status: 400 },
      );
    }
    const previous = [...cycleDb]
      .filter((c) => c.startDate < body.startDate)
      .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
    const newCycle: ApiPlanningCycle = {
      id: crypto.randomUUID(),
      startDate: body.startDate,
      endDate: body.endDate,
      previousPlanningCycleId: previous?.id ?? null,
      nextPlanningCycleId: null,
    };
    if (newCycle.previousPlanningCycleId) {
      const prev = cycleDb.find((c) => c.id === newCycle.previousPlanningCycleId);
      if (prev) prev.nextPlanningCycleId = newCycle.id;
    }
    cycleDb.push(newCycle);
    planningDb[newCycle.id] = {
      id: crypto.randomUUID(),
      planningCycleId: newCycle.id,
      meals: [],
      leftovers: [],
      notes: [],
    };
    groceryDb[newCycle.id] = {
      id: crypto.randomUUID(),
      planningCycleId: newCycle.id,
      planningMealGroceries: [],
      groceries: [],
    };
    return HttpResponse.json(newCycle, { status: 201 });
  }),

  http.put('/api/planning-cycles/:id', async ({ params, request }) => {
    const idx = cycleDb.findIndex((c) => c.id === params['id']);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { startDate: string; endDate: string };
    const access = planningAccess(cycleDb[idx].id);
    if (access) return access;
    const planning = planningDb[cycleDb[idx].id];
    if (
      !validRange(body.startDate, body.endDate) ||
      cycleDb.some((c) => c.id !== cycleDb[idx].id && c.startDate >= body.startDate) ||
      [...planning.meals, ...planning.leftovers, ...planning.notes].some(
        (entry) => entry.date < body.startDate || entry.date > body.endDate,
      )
    )
      return new HttpResponse(null, { status: 400 });
    cycleDb[idx] = { ...cycleDb[idx], startDate: body.startDate, endDate: body.endDate };
    return HttpResponse.json(cycleDb[idx]);
  }),

  http.delete('/api/planning-cycles/:id', ({ params }) => {
    const id = params['id'] as string;
    const idx = cycleDb.findIndex((cycle) => cycle.id === id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });

    const access = planningAccess(id);
    if (access) return access;
    cycleDb.splice(idx, 1);
    delete planningDb[id];
    delete groceryDb[id];
    const orderedCycles = [...cycleDb].sort((a, b) => a.startDate.localeCompare(b.startDate));
    orderedCycles.forEach((cycle, index) => {
      cycle.previousPlanningCycleId = orderedCycles[index - 1]?.id ?? null;
      cycle.nextPlanningCycleId = orderedCycles[index + 1]?.id ?? null;
    });
    return new HttpResponse(null, { status: 204 });
  }),

  // ── Planning ───────────────────────────────────────────────
  http.get('/api/planning/upcoming', ({ request }) => {
    const fromDate = new URL(request.url).searchParams.get('fromDate');
    if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !DateTime.fromISO(fromDate).isValid)
      return new HttpResponse(null, { status: 422 });
    if (fromDate > '9999-12-25') return new HttpResponse(null, { status: 400 });
    const endDate = DateTime.fromISO(fromDate).plus({ days: 6 }).toISODate()!;
    const entries = Object.values(planningDb)
      .flatMap(toPlanningEntries)
      .filter((entry) => entry.date >= fromDate)
      .sort(
        (a, b) =>
          a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
      );
    return HttpResponse.json({
      fromDate,
      entries: entries.slice(0, 3),
      plannedDates: [
        ...new Set(entries.filter((entry) => entry.date <= endDate).map((entry) => entry.date)),
      ].sort(),
    });
  }),
  http.get('/api/planning/cycle/:cycleId', ({ params }) => {
    const planning = planningDb[params['cycleId'] as string];
    if (!planning) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      id: planning.id,
      planningCycleId: planning.planningCycleId,
      entries: toPlanningEntries(planning),
      notes: planning.notes,
    });
  }),

  // ── Planning Meals ─────────────────────────────────────────
  http.post('/api/planning-meals', async ({ request }) => {
    const body = (await request.json()) as {
      planningId: string;
      date: string;
      recipeId: string;
      recipeProfileId: string;
    };
    const recipe = recipeDb.find((r) => r.id === body.recipeId);
    if (!recipe) return new HttpResponse(null, { status: 404 });
    const profile = recipe.profiles.find((p) => p.id === body.recipeProfileId);
    if (!profile) return new HttpResponse(null, { status: 404 });

    // Find planning by id
    const cycleId = Object.keys(planningDb).find((k) => planningDb[k].id === body.planningId);
    if (!cycleId) return new HttpResponse(null, { status: 404 });
    const access = planningAccess(cycleId, body.date);
    if (access) return access;

    const newMeal: ApiPlanningEntry = {
      id: crypto.randomUUID(),
      kind: 'Meal',
      originalMealId: null,
      date: body.date,
      recipe: {
        id: recipe.id,
        name: recipe.name,
        category: recipe.category,
        tags: recipe.tags,
        imageUrl: recipe.images.length > 0 ? recipe.images[0].url : null,
        isFavorite: !!recipe.isFavorite,
      },
      recipeProfile: { id: profile.id, name: profile.name, servings: profile.servings },
      hasGroceriesAdded: false,
      sortOrder:
        Math.max(
          -1,
          ...getDayEntries(planningDb[cycleId], body.date).map((entry) => entry.sortOrder),
        ) + 1,
    };
    planningDb[cycleId].meals.push(newMeal);
    return HttpResponse.json(newMeal, { status: 201 });
  }),

  http.post('/api/planning-meals/:id/move', async ({ params, request }) => {
    const mealId = params['id'] as string;
    const body = (await request.json()) as { targetDate: string; targetIndex?: number };
    for (const planning of Object.values(planningDb)) {
      const meal = planning.meals.find((item) => item.id === mealId);
      if (!meal) {
        const leftovers = planning.leftovers.find((item) => item.id === mealId);
        if (!leftovers) continue;
        const activeCycle = [...cycleDb].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
        const original = planning.meals.find((item) => item.id === leftovers.originalMealId);
        if (
          planning.planningCycleId !== activeCycle?.id ||
          body.targetDate < activeCycle.startDate ||
          body.targetDate > activeCycle.endDate ||
          !original ||
          body.targetDate <= original.date
        ) {
          return new HttpResponse(null, { status: 400 });
        }
        movePlanningEntry(planning, leftovers, body.targetDate, body.targetIndex);
        return HttpResponse.json(toPlanningEntry(planning, leftovers));
      }
      const activeCycle = [...cycleDb].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      if (planning.planningCycleId !== activeCycle?.id) {
        return new HttpResponse(null, { status: 400 });
      }
      if (body.targetDate < activeCycle.startDate || body.targetDate > activeCycle.endDate) {
        return new HttpResponse(null, { status: 400 });
      }
      if (
        planning.leftovers.some(
          (leftover) => leftover.originalMealId === mealId && body.targetDate >= leftover.date,
        )
      ) {
        return new HttpResponse(null, { status: 400 });
      }
      movePlanningEntry(planning, meal, body.targetDate, body.targetIndex);
      return HttpResponse.json(toPlanningEntry(planning, meal));
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.delete('/api/planning-meals/:id', ({ params }) => {
    const mealId = params['id'] as string;
    for (const planning of Object.values(planningDb)) {
      const leftoverIndex = planning.leftovers.findIndex((entry) => entry.id === mealId);
      if (leftoverIndex >= 0) {
        const access = planningAccess(planning.planningCycleId);
        if (access) return access;
        planning.leftovers.splice(leftoverIndex, 1);
        return new HttpResponse(null, { status: 204 });
      }
      const idx = planning.meals.findIndex((m) => m.id === mealId);
      if (idx >= 0) {
        const access = planningAccess(planning.planningCycleId);
        if (access) return access;
        planning.meals.splice(idx, 1);
        planning.leftovers = planning.leftovers.filter(
          (leftover) => leftover.originalMealId !== mealId,
        );
        for (const list of Object.values(groceryDb)) {
          list.planningMealGroceries = list.planningMealGroceries.filter(
            (group) => group.planningMeal.id !== mealId,
          );
        }
        return new HttpResponse(null, { status: 204 });
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.put('/api/planning-meals/:id/profile/:profileId', ({ params }) => {
    const mealId = params['id'] as string;
    const profileId = params['profileId'] as string;
    for (const planning of Object.values(planningDb)) {
      const meal = planning.meals.find((m) => m.id === mealId);
      if (meal) {
        const access = planningAccess(planning.planningCycleId);
        if (access) return access;
        const recipe = recipeDb.find((r) => r.id === meal.recipe.id);
        const profile = recipe?.profiles.find((p) => p.id === profileId);
        if (!profile) return new HttpResponse(null, { status: 404 });
        meal.recipeProfile = { id: profile.id, name: profile.name, servings: profile.servings };
        meal.hasGroceriesAdded = false;
        for (const list of Object.values(groceryDb)) {
          list.planningMealGroceries = list.planningMealGroceries.filter(
            (group) => group.planningMeal.id !== mealId,
          );
        }
        return HttpResponse.json(meal);
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.post('/api/planning-meals/:id/leftovers', async ({ params, request }) => {
    const mealId = params['id'] as string;
    const body = (await request.json()) as { date: string };
    for (const [cycleId, planning] of Object.entries(planningDb)) {
      const meal = planning.meals.find((m) => m.id === mealId);
      if (meal) {
        const access = planningAccess(cycleId, body.date);
        if (access) return access;
        const cycle = cycleDb.find((item) => item.id === cycleId);
        if (
          !cycle ||
          body.date <= meal.date ||
          body.date < cycle.startDate ||
          body.date > cycle.endDate ||
          planning.leftovers.some(
            (leftover) => leftover.originalMealId === mealId && leftover.date === body.date,
          )
        ) {
          return new HttpResponse(null, { status: 400 });
        }
        const id = crypto.randomUUID();
        const sortOrder =
          Math.max(-1, ...getDayEntries(planning, body.date).map((entry) => entry.sortOrder)) + 1;
        const leftover = { id, originalMealId: mealId, date: body.date, sortOrder };
        planning.leftovers.push(leftover);
        return HttpResponse.json(toPlanningEntry(planning, leftover), { status: 201 });
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.get('/api/planning-meals/:id/groceries', ({ params }) => {
    const mealId = params['id'] as string;
    for (const [cycleId, planning] of Object.entries(planningDb)) {
      const meal = planning.meals.find((m) => m.id === mealId);
      if (!meal) continue;
      const list = groceryDb[cycleId];
      const existing = list?.planningMealGroceries.find((g) => g.planningMeal.id === mealId);
      return HttpResponse.json(
        existing ?? {
          planningMeal: {
            id: meal.id,
            date: meal.date,
            recipeId: meal.recipe.id,
            recipeName: meal.recipe.name,
            recipeImageUrl: meal.recipe.imageUrl ?? '',
            profileName: meal.recipeProfile.name,
            profileServings: meal.recipeProfile.servings,
          },
          groceries: [],
        },
      );
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.post('/api/planning-meals/:id/groceries', async ({ params, request }) => {
    const mealId = params['id'] as string;
    const body = (await request.json()) as {
      groceries: { recipeProfileProductId: string | null; name: string; quantity: number }[];
    };

    // Find the meal and its associated planning
    let foundCycleId: string | undefined;
    let foundMeal: ApiPlanningEntry | undefined;
    for (const [cycleId, planning] of Object.entries(planningDb)) {
      const meal = planning.meals.find((m) => m.id === mealId);
      if (meal) {
        foundCycleId = cycleId;
        foundMeal = meal;
        break;
      }
    }
    if (!foundCycleId || !foundMeal) return new HttpResponse(null, { status: 404 });
    const access = planningAccess(foundCycleId);
    if (access) return access;
    if (
      body.groceries.some(
        (item) =>
          !item.name.trim() ||
          item.name.length > 200 ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1,
      )
    )
      return new HttpResponse(null, { status: 400 });
    const selectedProfile = recipeDb
      .find((recipe) => recipe.id === foundMeal.recipe.id)
      ?.profiles.find((profile) => profile.id === foundMeal.recipeProfile.id);
    const sourceIds = body.groceries
      .map((item) => item.recipeProfileProductId)
      .filter((id): id is string => !!id);
    if (
      !selectedProfile ||
      new Set(sourceIds).size !== sourceIds.length ||
      sourceIds.some((id) => selectedProfile.products.every((product) => product.id !== id))
    ) {
      return new HttpResponse(null, { status: 400 });
    }

    // Ensure grocery list exists
    if (!groceryDb[foundCycleId]) {
      groceryDb[foundCycleId] = {
        id: crypto.randomUUID(),
        planningCycleId: foundCycleId,
        planningMealGroceries: [],
        groceries: [],
      };
    }
    const list = groceryDb[foundCycleId];

    // Remove existing entry for this meal
    list.planningMealGroceries = list.planningMealGroceries.filter(
      (g) => g.planningMeal.id !== mealId,
    );

    // Add new entry
    list.planningMealGroceries.push({
      planningMeal: {
        id: foundMeal.id,
        date: foundMeal.date,
        recipeId: foundMeal.recipe.id,
        recipeName: foundMeal.recipe.name,
        recipeImageUrl: foundMeal.recipe.imageUrl ?? '',
        profileName: foundMeal.recipeProfile.name,
        profileServings: foundMeal.recipeProfile.servings,
      },
      groceries: body.groceries.map((g, order) => ({
        id: crypto.randomUUID(),
        name: g.name,
        quantity: g.quantity,
        order,
        checked: false,
        recipeProfileProductId: g.recipeProfileProductId,
        planningMealId: mealId,
      })),
    });

    // The grocery commitment is represented by the persisted grocery group,
    // including when the selected list is empty.
    foundMeal.hasGroceriesAdded = true;

    return HttpResponse.json({ success: true }, { status: 201 });
  }),

  // ── Planning Notes ─────────────────────────────────────────
  http.post('/api/planning-notes', async ({ request }) => {
    const body = (await request.json()) as { planningId: string; date: string; text: string };
    const cycleId = Object.keys(planningDb).find((k) => planningDb[k].id === body.planningId);
    if (!cycleId) return new HttpResponse(null, { status: 404 });
    const access = planningAccess(cycleId, body.date);
    if (access) return access;

    const newNote: ApiPlanningNote = {
      id: crypto.randomUUID(),
      date: body.date,
      text: body.text,
    };
    planningDb[cycleId].notes.push(newNote);
    return HttpResponse.json(newNote, { status: 201 });
  }),

  http.put('/api/planning-notes/:id', async ({ params, request }) => {
    const noteId = params['id'] as string;
    const body = (await request.json()) as { text: string };
    if (!body.text.trim()) return new HttpResponse(null, { status: 400 });
    for (const planning of Object.values(planningDb)) {
      const note = planning.notes.find((item) => item.id === noteId);
      if (note) {
        const access = planningAccess(planning.planningCycleId);
        if (access) return access;
        note.text = body.text;
        return HttpResponse.json(note);
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.delete('/api/planning-notes/:id', ({ params }) => {
    const noteId = params['id'] as string;
    for (const planning of Object.values(planningDb)) {
      const idx = planning.notes.findIndex((n) => n.id === noteId);
      if (idx >= 0) {
        const access = planningAccess(planning.planningCycleId);
        if (access) return access;
        planning.notes.splice(idx, 1);
        return new HttpResponse(null, { status: 204 });
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  // ── Grocery Lists ─────────────────────────────────────────
  http.get('/api/grocery-lists/suggestions', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const search = (params.get('search') ?? '').trim().toLowerCase();
    const limit = Number(params.get('limit') ?? 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20 || search.length > 100)
      return new HttpResponse(null, { status: 400 });
    if (!search) return HttpResponse.json([]);
    const names = Object.values(groceryDb)
      .flatMap((list) => [
        ...list.groceries,
        ...list.planningMealGroceries.flatMap((group) => group.groceries),
      ])
      .map((item) => item.name.trim())
      .filter((name) => name.toLowerCase().includes(search))
      .sort();
    const unique = new Map<string, string>();
    for (const name of names)
      if (!unique.has(name.toLowerCase())) unique.set(name.toLowerCase(), name);
    return HttpResponse.json(
      [...unique.values()]
        .sort(
          (a, b) =>
            Number(b.toLowerCase().startsWith(search)) -
              Number(a.toLowerCase().startsWith(search)) ||
            a.toLowerCase().localeCompare(b.toLowerCase()),
        )
        .slice(0, limit),
    );
  }),
  http.get('/api/grocery-lists/cycle/:cycleId', ({ params }) => {
    const list = groceryDb[params['cycleId'] as string];
    if (!list) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      ...list,
      groceries: [...list.groceries].sort((a, b) => a.order - b.order),
      planningMealGroceries: list.planningMealGroceries.map((group) => ({
        ...group,
        groceries: [...group.groceries].sort((a, b) => a.order - b.order),
      })),
    });
  }),

  http.post('/api/grocery-lists/cycle/:cycleId/items', async ({ params, request }) => {
    const cycleId = params['cycleId'] as string;
    const body = (await request.json()) as { name: string; quantity: number };
    if (
      !body.name.trim() ||
      body.name.length > 200 ||
      !Number.isInteger(body.quantity) ||
      body.quantity <= 0
    ) {
      return new HttpResponse(null, { status: 400 });
    }
    if (!cycleDb.some((c) => c.id === cycleId)) return new HttpResponse(null, { status: 404 });
    if (!groceryDb[cycleId]) {
      groceryDb[cycleId] = {
        id: crypto.randomUUID(),
        planningCycleId: cycleId,
        planningMealGroceries: [],
        groceries: [],
      };
    }
    const newItem: ApiGroceryItem = {
      id: crypto.randomUUID(),
      name: body.name,
      quantity: body.quantity,
      order: groceryDb[cycleId].groceries.length,
      checked: false,
      recipeProfileProductId: null,
      planningMealId: null,
    };
    groceryDb[cycleId].groceries.push(newItem);
    return HttpResponse.json(newItem, { status: 201 });
  }),

  http.post('/api/planning-meals/:mealId/groceries/items', async ({ params, request }) => {
    const mealId = params['mealId'] as string;
    const body = (await request.json()) as { name: string; quantity: number };
    if (
      !body.name.trim() ||
      body.name.length > 200 ||
      !Number.isInteger(body.quantity) ||
      body.quantity <= 0
    ) {
      return new HttpResponse(null, { status: 400 });
    }
    const list = Object.values(groceryDb).find((candidate) =>
      candidate.planningMealGroceries.some((group) => group.planningMeal.id === mealId),
    );
    const mealGroup = list?.planningMealGroceries.find((group) => group.planningMeal.id === mealId);
    if (!mealGroup) return new HttpResponse(null, { status: 404 });

    const newItem: ApiGroceryItem = {
      id: crypto.randomUUID(),
      name: body.name,
      quantity: body.quantity,
      order: mealGroup.groceries.length,
      checked: false,
      recipeProfileProductId: null,
      planningMealId: mealId,
    };
    mealGroup.groceries.push(newItem);
    return HttpResponse.json(newItem, { status: 201 });
  }),

  http.put('/api/grocery-lists/:itemId', async ({ params, request }) => {
    const itemId = params['itemId'] as string;
    const body = (await request.json()) as {
      name: string;
      quantity: number;
      checked: boolean;
    };
    if (
      !body.name.trim() ||
      body.name.length > 200 ||
      !Number.isInteger(body.quantity) ||
      body.quantity <= 0
    ) {
      return new HttpResponse(null, { status: 400 });
    }
    for (const list of Object.values(groceryDb)) {
      // Check manual groceries
      const manualItem = list.groceries.find((i) => i.id === itemId);
      if (manualItem) {
        Object.assign(manualItem, body);
        return HttpResponse.json(manualItem);
      }
      // Check meal groceries
      for (const mg of list.planningMealGroceries) {
        const item = mg.groceries.find((i) => i.id === itemId);
        if (item) {
          Object.assign(item, body);
          return HttpResponse.json(item);
        }
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.put('/api/grocery-lists/:listId/items/order', async ({ params, request }) => {
    const list = Object.values(groceryDb).find((candidate) => candidate.id === params['listId']);
    if (!list) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as {
      planningMealId: string | null;
      itemIds: string[];
    };
    const items = body.planningMealId
      ? list.planningMealGroceries.find((group) => group.planningMeal.id === body.planningMealId)
          ?.groceries
      : list.groceries;
    if (
      !items ||
      items.length !== body.itemIds.length ||
      body.itemIds.some((id) => !items.some((item) => item.id === id))
    ) {
      return new HttpResponse(null, { status: 400 });
    }
    const byId = new Map(items.map((item) => [item.id, item]));
    body.itemIds.forEach((id, order) => (byId.get(id)!.order = order));
    items.sort((a, b) => a.order - b.order);
    return HttpResponse.json(items);
  }),

  http.delete('/api/grocery-lists/:itemId', ({ params }) => {
    const itemId = params['itemId'] as string;
    for (const list of Object.values(groceryDb)) {
      const manualIdx = list.groceries.findIndex((i) => i.id === itemId);
      if (manualIdx >= 0) {
        list.groceries.splice(manualIdx, 1);
        return new HttpResponse(null, { status: 204 });
      }
      for (const mg of list.planningMealGroceries) {
        const idx = mg.groceries.findIndex((i) => i.id === itemId);
        if (idx >= 0) {
          mg.groceries.splice(idx, 1);
          return new HttpResponse(null, { status: 204 });
        }
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),
];
