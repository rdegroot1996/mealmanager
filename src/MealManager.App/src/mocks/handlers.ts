import { DateTime } from 'luxon';
import { MockMealPlan, MockPlannedLeftover } from './data/mock-meal-plan';
import { http, HttpResponse } from 'msw/http';
import { recipes, MockRecipe } from './data/recipes';
import { cycles } from './data/planning-cycles';
import { mockImageUploadError } from './image-upload';
import { mealPlans } from './data/meal-plans';
import { groceries } from './data/groceries';
import { ApiPlanningCycle } from '../app/api/models/api-planning-cycle';
import { ApiPlannedEntry, ApiPlanningDayNote } from '../app/api/models/api-meal-plan';
import { ApiShoppingList, ApiShoppingListItem } from '../app/api/models/api-shopping-list';
import { ApiConfig } from '../app/api/models/api-config';
import { ApiUser } from '../app/api/models/api-user';
import { resetSupermarkets, supermarketHandlers } from './supermarkets';
import { passwordMeetsPolicy } from '../app/features/authentication/authentication-validation';

// Deep-clone mutable state so handlers can mutate freely
let recipeDb: MockRecipe[] = structuredClone(recipes);
let cycleDb: ApiPlanningCycle[] = structuredClone(cycles);
let mealPlanDb: Record<string, MockMealPlan> = structuredClone(mealPlans);
let shoppingListDb: Record<string, ApiShoppingList> = structuredClone(groceries);
let configDb: ApiConfig = { appInitialized: true };

let isAuthenticated = true;
const initialUsers: ApiUser[] = [
  {
    id: '01990c2e-7f00-7000-8000-000000000001',
    email: 'admin@example.test',
    displayName: 'MealManager Admin',
    isAdmin: true,
    mustChangePassword: false,
  },
];
let userDb = structuredClone(initialUsers);
let currentUserId = initialUsers[0].id;

export function resetMockData() {
  resetSupermarkets();
  configDb = { appInitialized: true };
  isAuthenticated = true;
  userDb = structuredClone(initialUsers);
  currentUserId = initialUsers[0].id;
  recipeDb = structuredClone(recipes);
  cycleDb = structuredClone(cycles);
  mealPlanDb = structuredClone(mealPlans);
  shoppingListDb = structuredClone(groceries);
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
function planningAccess(cycleId: string, date?: string, requireActive = false) {
  const cycle = cycleDb.find((c) => c.id === cycleId);
  if (!cycle) return new HttpResponse(null, { status: 404 });
  if (requireActive && cycle.id !== activeCycle()?.id)
    return HttpResponse.json(
      {
        code: 'ActiveCycleRequired',
        detail: 'This operation requires the active planning cycle.',
      },
      { status: 400 },
    );
  if (date && (!DateTime.fromISO(date).isValid || date < cycle.startDate || date > cycle.endDate))
    return HttpResponse.json(
      { code: 'DateOutsideCycle', detail: 'Planned entries must stay inside the cycle.' },
      { status: 400 },
    );
  return null;
}
function validRange(startDate: string, endDate: string) {
  return (
    DateTime.fromISO(startDate).isValid && DateTime.fromISO(endDate).isValid && startDate <= endDate
  );
}

type MockMealPlanOrderableEntry = ApiPlannedEntry | MockPlannedLeftover;

function getDayEntries(
  mealPlan: MockMealPlan,
  date: string,
  excludedId?: string,
): MockMealPlanOrderableEntry[] {
  return [...mealPlan.meals, ...mealPlan.leftovers]
    .filter((entry) => entry.date === date && entry.id !== excludedId)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id));
}

function reindexDay(mealPlan: MockMealPlan, date: string) {
  getDayEntries(mealPlan, date).forEach((entry, index) => (entry.sortOrder = index));
}

function movePlannedEntry(
  mealPlan: MockMealPlan,
  entry: MockMealPlanOrderableEntry,
  targetDate: string,
  targetIndex?: number,
) {
  const sourceDate = entry.date;
  entry.date = targetDate;
  const targetEntries = getDayEntries(mealPlan, targetDate, entry.id);
  targetEntries.splice(
    Math.min(Math.max(targetIndex ?? targetEntries.length, 0), targetEntries.length),
    0,
    entry,
  );
  targetEntries.forEach((target, index) => (target.sortOrder = index));
  if (sourceDate !== targetDate) reindexDay(mealPlan, sourceDate);
}

function toPlannedEntry(
  mealPlan: MockMealPlan,
  entry: MockMealPlanOrderableEntry,
): ApiPlannedEntry | null {
  if ('recipe' in entry) {
    return {
      ...entry,
      kind: 'Meal',
      originalMealId: null,
      recipe: { ...entry.recipe, isFavorite: !!entry.recipe.isFavorite },
    };
  }

  const original = mealPlan.meals.find((meal) => meal.id === entry.originalMealId);
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

function toPlanningEntries(mealPlan: MockMealPlan): ApiPlannedEntry[] {
  return [...mealPlan.meals, ...mealPlan.leftovers]
    .map((entry) => toPlannedEntry(mealPlan, entry))
    .filter((entry): entry is ApiPlannedEntry => entry !== null)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.sortOrder - b.sortOrder || a.id.localeCompare(b.id),
    );
}

export const handlers = [
  http.all('/api/*', ({ request }) => {
    if (!isAuthenticated || !userDb.find((user) => user.id === currentUserId)?.mustChangePassword)
      return;
    const path = new URL(request.url).pathname.toLowerCase().replace(/\/$/, '');
    if (
      [
        '/api/authentication/session',
        '/api/authentication/change-password',
        '/api/authentication/logout',
      ].includes(path) ||
      (path === '/api/users/me' && request.method === 'GET')
    )
      return;
    return HttpResponse.json({ code: 'PasswordChangeRequired' }, { status: 403 });
  }),
  ...supermarketHandlers({
    lists: () => shoppingListDb,
    access: (admin) =>
      isAuthenticated && (!admin || !!userDb.find((x) => x.id === currentUserId)?.isAdmin),
    group: (id) =>
      id
        ? (Object.values(mealPlanDb)
            .flatMap((x) => x.meals)
            .find((x) => x.id === id)?.recipe.name ?? 'Meal')
        : 'Other items',
    unreviewed: (cycle) =>
      mealPlanDb[cycle]?.meals.filter((x) => !x.hasReviewedGroceries).length ?? 0,
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
    currentUserId =
      userDb.find((user) => user.email.toLowerCase() === body.email!.toLowerCase())?.id ??
      initialUsers[0].id;
    isAuthenticated = true;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/authentication/logout', () => {
    isAuthenticated = false;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/authentication/change-password', async ({ request }) => {
    if (!isAuthenticated) return new HttpResponse(null, { status: 401 });
    const body = (await request.json()) as { currentPassword: string; newPassword: string };
    if (
      !body.currentPassword ||
      !passwordMeetsPolicy(body.newPassword ?? '') ||
      body.newPassword === body.currentPassword
    )
      return HttpResponse.json({ code: 'ValidationError' }, { status: 400 });
    const user = userDb.find((user) => user.id === currentUserId);
    if (!user) return new HttpResponse(null, { status: 404 });
    user.mustChangePassword = false;
    return new HttpResponse(null, { status: 204 });
  }),

  http.post('/api/users/:id/reset-password', async ({ params, request }) => {
    const denied = userAccess();
    if (denied) return denied;
    if (params['id'] === currentUserId)
      return HttpResponse.json({ code: 'CannotResetOwnPassword' }, { status: 400 });
    const user = userDb.find((user) => user.id === params['id']);
    if (!user) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { temporaryPassword: string };
    if (!passwordMeetsPolicy(body.temporaryPassword ?? ''))
      return HttpResponse.json({ code: 'ValidationError' }, { status: 400 });
    user.mustChangePassword = true;
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
    if (
      !body.displayName?.trim() ||
      !body.email?.trim() ||
      !passwordMeetsPolicy(body.password ?? '')
    )
      return HttpResponse.json({ code: 'ValidationError' }, { status: 400 });
    if (userDb.some(({ email }) => email.toLowerCase() === body.email.toLowerCase())) {
      return HttpResponse.json(
        { title: 'A user with this email already exists.' },
        { status: 400 },
      );
    }
    const { password: _password, ...details } = body;
    const user: ApiUser = { ...details, mustChangePassword: false, id: crypto.randomUUID() };
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
    const search = url.searchParams.get('search')?.trim().toLowerCase();
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
      const plannedDates = Object.values(mealPlanDb)
        .flatMap((mealPlan) => mealPlan.meals)
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
        upcomingTimesPlanned: Object.values(mealPlanDb)
          .flatMap((mealPlan) => mealPlan.meals)
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
          Object.values(mealPlanDb)
            .flatMap((mealPlan) => mealPlan.meals)
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
    const plannedMeals = Object.values(mealPlanDb)
      .flatMap((mealPlan) => mealPlan.meals)
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
          groceries: [],
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
      Object.values(mealPlanDb).some((mealPlan) =>
        mealPlan.meals.some((meal) => meal.recipe.id === params['id']),
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
      groceries: { name: string; quantity: number; atHome: boolean; order?: number }[];
    };
    const recipe = recipeDb.find((r) => r.id === body.recipeId);
    if (!recipe) return new HttpResponse(null, { status: 404 });
    body.groceries ??= [];
    if (
      !body.name.trim() ||
      !Number.isInteger(body.servings) ||
      body.servings < 1 ||
      body.groceries.some(
        (item) =>
          !item.name.trim() ||
          item.name.length > 200 ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1,
      )
    )
      return HttpResponse.json({ code: 'ValidationError' }, { status: 400 });
    const newProfile = {
      id: crypto.randomUUID(),
      name: body.name,
      servings: body.servings,
      groceries: body.groceries.map((p, order) => ({ ...p, id: crypto.randomUUID(), order })),
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
      groceries: {
        id?: string;
        name: string;
        quantity: number;
        atHome: boolean;
        order?: number;
      }[];
    };
    const ids = body.groceries.map((item) => item.id).filter((id): id is string => !!id);
    if (
      !body.name.trim() ||
      !Number.isInteger(body.servings) ||
      body.servings < 1 ||
      new Set(ids).size !== ids.length ||
      body.groceries.some(
        (item) =>
          !item.name.trim() ||
          item.name.length > 200 ||
          !Number.isInteger(item.quantity) ||
          item.quantity < 1,
      ) ||
      recipeDb.some((recipe) =>
        recipe.profiles.some(
          (profile) =>
            profile.id !== profileId && profile.groceries.some((item) => ids.includes(item.id)),
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
          groceries: body.groceries.map((item, order) => ({
            ...item,
            id: item.id || crypto.randomUUID(),
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
      Object.values(mealPlanDb).some((mealPlan) =>
        mealPlan.meals.some((meal) => meal.recipeProfile.id === profileId),
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

  // ── MealPlan Cycles ────────────────────────────────────────
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
    mealPlanDb[newCycle.id] = {
      id: crypto.randomUUID(),
      planningCycleId: newCycle.id,
      meals: [],
      leftovers: [],
      notes: [],
    };
    shoppingListDb[newCycle.id] = {
      id: crypto.randomUUID(),
      planningCycleId: newCycle.id,
      mealGroups: [],
      items: [],
    };
    return HttpResponse.json(newCycle, { status: 201 });
  }),

  http.put('/api/planning-cycles/:id', async ({ params, request }) => {
    const idx = cycleDb.findIndex((c) => c.id === params['id']);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as { startDate: string; endDate: string };
    const access = planningAccess(cycleDb[idx].id, undefined, true);
    if (access) return access;
    const mealPlan = mealPlanDb[cycleDb[idx].id];
    if (
      !validRange(body.startDate, body.endDate) ||
      cycleDb.some((c) => c.id !== cycleDb[idx].id && c.startDate >= body.startDate) ||
      [...mealPlan.meals, ...mealPlan.leftovers, ...mealPlan.notes].some(
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

    const access = planningAccess(id, undefined, true);
    if (access) return access;
    cycleDb.splice(idx, 1);
    delete mealPlanDb[id];
    delete shoppingListDb[id];
    const orderedCycles = [...cycleDb].sort((a, b) => a.startDate.localeCompare(b.startDate));
    orderedCycles.forEach((cycle, index) => {
      cycle.previousPlanningCycleId = orderedCycles[index - 1]?.id ?? null;
      cycle.nextPlanningCycleId = orderedCycles[index + 1]?.id ?? null;
    });
    return new HttpResponse(null, { status: 204 });
  }),

  // ── MealPlan ───────────────────────────────────────────────
  http.get('/api/meal-plans/upcoming', ({ request }) => {
    const fromDate = new URL(request.url).searchParams.get('fromDate');
    if (!fromDate || !/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !DateTime.fromISO(fromDate).isValid)
      return new HttpResponse(null, { status: 422 });
    if (fromDate > '9999-12-25') return new HttpResponse(null, { status: 400 });
    const endDate = DateTime.fromISO(fromDate).plus({ days: 6 }).toISODate()!;
    const entries = Object.values(mealPlanDb)
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
  http.get('/api/meal-plans/cycle/:cycleId', ({ params }) => {
    const mealPlan = mealPlanDb[params['cycleId'] as string];
    if (!mealPlan) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      id: mealPlan.id,
      planningCycleId: mealPlan.planningCycleId,
      entries: toPlanningEntries(mealPlan),
      notes: mealPlan.notes,
    });
  }),

  // ── MealPlan Meals ─────────────────────────────────────────
  http.post('/api/planned-meals', async ({ request }) => {
    const body = (await request.json()) as {
      mealPlanId: string;
      date: string;
      recipeId: string;
      recipeProfileId: string;
    };
    const recipe = recipeDb.find((r) => r.id === body.recipeId);
    if (!recipe) return new HttpResponse(null, { status: 404 });
    const profile = recipe.profiles.find((p) => p.id === body.recipeProfileId);
    if (!profile) return new HttpResponse(null, { status: 404 });

    // Find meal plan by id
    const cycleId = Object.keys(mealPlanDb).find((k) => mealPlanDb[k].id === body.mealPlanId);
    if (!cycleId) return new HttpResponse(null, { status: 404 });
    const access = planningAccess(cycleId, body.date);
    if (access) return access;

    const newMeal: ApiPlannedEntry = {
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
      hasReviewedGroceries: false,
      sortOrder:
        Math.max(
          -1,
          ...getDayEntries(mealPlanDb[cycleId], body.date).map((entry) => entry.sortOrder),
        ) + 1,
    };
    mealPlanDb[cycleId].meals.push(newMeal);
    return HttpResponse.json(newMeal, { status: 201 });
  }),

  http.post('/api/planned-meals/:id/move', async ({ params, request }) => {
    const mealId = params['id'] as string;
    const body = (await request.json()) as { targetDate: string; targetIndex?: number };
    for (const mealPlan of Object.values(mealPlanDb)) {
      const meal = mealPlan.meals.find((item) => item.id === mealId);
      if (!meal) {
        const leftovers = mealPlan.leftovers.find((item) => item.id === mealId);
        if (!leftovers) continue;
        const activeCycle = [...cycleDb].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
        const original = mealPlan.meals.find((item) => item.id === leftovers.originalMealId);
        if (
          mealPlan.planningCycleId !== activeCycle?.id ||
          body.targetDate < activeCycle.startDate ||
          body.targetDate > activeCycle.endDate ||
          !original ||
          body.targetDate <= original.date
        ) {
          return new HttpResponse(null, { status: 400 });
        }
        movePlannedEntry(mealPlan, leftovers, body.targetDate, body.targetIndex);
        return HttpResponse.json(toPlannedEntry(mealPlan, leftovers));
      }
      const activeCycle = [...cycleDb].sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      if (mealPlan.planningCycleId !== activeCycle?.id) {
        return new HttpResponse(null, { status: 400 });
      }
      if (body.targetDate < activeCycle.startDate || body.targetDate > activeCycle.endDate) {
        return new HttpResponse(null, { status: 400 });
      }
      if (
        mealPlan.leftovers.some(
          (leftover) => leftover.originalMealId === mealId && body.targetDate >= leftover.date,
        )
      ) {
        return new HttpResponse(null, { status: 400 });
      }
      movePlannedEntry(mealPlan, meal, body.targetDate, body.targetIndex);
      return HttpResponse.json(toPlannedEntry(mealPlan, meal));
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.delete('/api/planned-meals/:id', ({ params }) => {
    const mealId = params['id'] as string;
    for (const mealPlan of Object.values(mealPlanDb)) {
      const leftoverIndex = mealPlan.leftovers.findIndex((entry) => entry.id === mealId);
      if (leftoverIndex >= 0) {
        const access = planningAccess(mealPlan.planningCycleId);
        if (access) return access;
        mealPlan.leftovers.splice(leftoverIndex, 1);
        return new HttpResponse(null, { status: 204 });
      }
      const idx = mealPlan.meals.findIndex((m) => m.id === mealId);
      if (idx >= 0) {
        const access = planningAccess(mealPlan.planningCycleId);
        if (access) return access;
        mealPlan.meals.splice(idx, 1);
        mealPlan.leftovers = mealPlan.leftovers.filter(
          (leftover) => leftover.originalMealId !== mealId,
        );
        for (const list of Object.values(shoppingListDb)) {
          list.mealGroups = list.mealGroups.filter((group) => group.meal.id !== mealId);
        }
        return new HttpResponse(null, { status: 204 });
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.put('/api/planned-meals/:id/profile/:profileId', ({ params }) => {
    const mealId = params['id'] as string;
    const profileId = params['profileId'] as string;
    for (const mealPlan of Object.values(mealPlanDb)) {
      const meal = mealPlan.meals.find((m) => m.id === mealId);
      if (meal) {
        const access = planningAccess(mealPlan.planningCycleId);
        if (access) return access;
        const recipe = recipeDb.find((r) => r.id === meal.recipe.id);
        const profile = recipe?.profiles.find((p) => p.id === profileId);
        if (!profile) return new HttpResponse(null, { status: 404 });
        meal.recipeProfile = { id: profile.id, name: profile.name, servings: profile.servings };
        meal.hasReviewedGroceries = false;
        for (const list of Object.values(shoppingListDb)) {
          list.mealGroups = list.mealGroups.filter((group) => group.meal.id !== mealId);
        }
        return HttpResponse.json(meal);
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.post('/api/planned-meals/:id/leftovers', async ({ params, request }) => {
    const mealId = params['id'] as string;
    const body = (await request.json()) as { date: string };
    for (const [cycleId, mealPlan] of Object.entries(mealPlanDb)) {
      const meal = mealPlan.meals.find((m) => m.id === mealId);
      if (meal) {
        const access = planningAccess(cycleId, body.date);
        if (access) return access;
        const cycle = cycleDb.find((item) => item.id === cycleId);
        if (
          !cycle ||
          body.date <= meal.date ||
          body.date < cycle.startDate ||
          body.date > cycle.endDate ||
          mealPlan.leftovers.some(
            (leftover) => leftover.originalMealId === mealId && leftover.date === body.date,
          )
        ) {
          return new HttpResponse(null, { status: 400 });
        }
        const id = crypto.randomUUID();
        const sortOrder =
          Math.max(-1, ...getDayEntries(mealPlan, body.date).map((entry) => entry.sortOrder)) + 1;
        const leftover = { id, originalMealId: mealId, date: body.date, sortOrder };
        mealPlan.leftovers.push(leftover);
        return HttpResponse.json(toPlannedEntry(mealPlan, leftover), { status: 201 });
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.get('/api/planned-meals/:id/groceries', ({ params }) => {
    const mealId = params['id'] as string;
    for (const [cycleId, mealPlan] of Object.entries(mealPlanDb)) {
      const meal = mealPlan.meals.find((m) => m.id === mealId);
      if (!meal) continue;
      const list = shoppingListDb[cycleId];
      const existing = list?.mealGroups.find((g) => g.meal.id === mealId);
      return HttpResponse.json(
        existing ?? {
          meal: {
            id: meal.id,
            date: meal.date,
            recipeId: meal.recipe.id,
            recipeName: meal.recipe.name,
            recipeImageUrl: meal.recipe.imageUrl ?? '',
            recipeProfileId: meal.recipeProfile.id,
            profileName: meal.recipeProfile.name,
            profileServings: meal.recipeProfile.servings,
          },
          items: [],
        },
      );
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.post('/api/planned-meals/:id/groceries', async ({ params, request }) => {
    const mealId = params['id'] as string;
    const body = (await request.json()) as {
      groceries: { recipeProfileGroceryItemId: string | null; name: string; quantity: number }[];
    };

    // Find the meal and its associated meal plan
    let foundCycleId: string | undefined;
    let foundMeal: ApiPlannedEntry | undefined;
    for (const [cycleId, mealPlan] of Object.entries(mealPlanDb)) {
      const meal = mealPlan.meals.find((m) => m.id === mealId);
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
      .map((item) => item.recipeProfileGroceryItemId)
      .filter((id): id is string => !!id);
    if (
      !selectedProfile ||
      new Set(sourceIds).size !== sourceIds.length ||
      sourceIds.some((id) => selectedProfile.groceries.every((item) => item.id !== id))
    ) {
      return new HttpResponse(null, { status: 400 });
    }

    // Ensure the shopping list exists
    if (!shoppingListDb[foundCycleId]) {
      shoppingListDb[foundCycleId] = {
        id: crypto.randomUUID(),
        planningCycleId: foundCycleId,
        mealGroups: [],
        items: [],
      };
    }
    const list = shoppingListDb[foundCycleId];

    // Remove existing entry for this meal
    list.mealGroups = list.mealGroups.filter((g) => g.meal.id !== mealId);

    // Add new entry
    list.mealGroups.push({
      meal: {
        id: foundMeal.id,
        date: foundMeal.date,
        recipeId: foundMeal.recipe.id,
        recipeName: foundMeal.recipe.name,
        recipeImageUrl: foundMeal.recipe.imageUrl ?? '',
        recipeProfileId: foundMeal.recipeProfile.id,
        profileName: foundMeal.recipeProfile.name,
        profileServings: foundMeal.recipeProfile.servings,
      },
      items: body.groceries.map((g, order) => ({
        id: crypto.randomUUID(),
        name: g.name,
        quantity: g.quantity,
        order,
        checked: false,
        recipeProfileGroceryItemId: g.recipeProfileGroceryItemId,
        plannedMealId: mealId,
      })),
    });

    // The grocery commitment is represented by the persisted grocery group,
    // including when the selected list is empty.
    foundMeal.hasReviewedGroceries = true;

    return HttpResponse.json(
      list.mealGroups.find((group) => group.meal.id === mealId),
      { status: 201 },
    );
  }),

  // ── Day notes ─────────────────────────────────────────
  http.post('/api/planning-day-notes', async ({ request }) => {
    const body = (await request.json()) as { mealPlanId: string; date: string; text: string };
    const cycleId = Object.keys(mealPlanDb).find((k) => mealPlanDb[k].id === body.mealPlanId);
    if (!cycleId) return new HttpResponse(null, { status: 404 });
    const access = planningAccess(cycleId, body.date);
    if (access) return access;

    const newNote: ApiPlanningDayNote = {
      id: crypto.randomUUID(),
      date: body.date,
      text: body.text,
    };
    mealPlanDb[cycleId].notes.push(newNote);
    return HttpResponse.json(newNote, { status: 201 });
  }),

  http.put('/api/planning-day-notes/:id', async ({ params, request }) => {
    const noteId = params['id'] as string;
    const body = (await request.json()) as { text: string };
    if (!body.text.trim()) return new HttpResponse(null, { status: 400 });
    for (const mealPlan of Object.values(mealPlanDb)) {
      const note = mealPlan.notes.find((item) => item.id === noteId);
      if (note) {
        const access = planningAccess(mealPlan.planningCycleId);
        if (access) return access;
        note.text = body.text;
        return HttpResponse.json(note);
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.delete('/api/planning-day-notes/:id', ({ params }) => {
    const noteId = params['id'] as string;
    for (const mealPlan of Object.values(mealPlanDb)) {
      const idx = mealPlan.notes.findIndex((n) => n.id === noteId);
      if (idx >= 0) {
        const access = planningAccess(mealPlan.planningCycleId);
        if (access) return access;
        mealPlan.notes.splice(idx, 1);
        return new HttpResponse(null, { status: 204 });
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  // ── Grocery Lists ─────────────────────────────────────────
  http.get('/api/shopping-lists/suggestions', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const search = (params.get('search') ?? '').trim().toLowerCase();
    const limit = Number(params.get('limit') ?? 10);
    if (!Number.isInteger(limit) || limit < 1 || limit > 20 || search.length > 100)
      return new HttpResponse(null, { status: 400 });
    if (!search) return HttpResponse.json([]);
    const names = Object.values(shoppingListDb)
      .flatMap((list) => [...list.items, ...list.mealGroups.flatMap((group) => group.items)])
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
  http.get('/api/shopping-lists/cycle/:cycleId', ({ params }) => {
    const list = shoppingListDb[params['cycleId'] as string];
    if (!list) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json({
      ...list,
      items: [...list.items].sort((a, b) => a.order - b.order),
      mealGroups: list.mealGroups.map((group) => ({
        ...group,
        items: [...group.items].sort((a, b) => a.order - b.order),
      })),
    });
  }),

  http.post('/api/shopping-lists/cycle/:cycleId/items', async ({ params, request }) => {
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
    if (!shoppingListDb[cycleId]) {
      shoppingListDb[cycleId] = {
        id: crypto.randomUUID(),
        planningCycleId: cycleId,
        mealGroups: [],
        items: [],
      };
    }
    const newItem: ApiShoppingListItem = {
      id: crypto.randomUUID(),
      name: body.name,
      quantity: body.quantity,
      order: shoppingListDb[cycleId].items.length,
      checked: false,
      recipeProfileGroceryItemId: null,
      plannedMealId: null,
    };
    shoppingListDb[cycleId].items.push(newItem);
    return HttpResponse.json(newItem, { status: 201 });
  }),

  http.post('/api/planned-meals/:mealId/groceries/items', async ({ params, request }) => {
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
    const list = Object.values(shoppingListDb).find((candidate) =>
      candidate.mealGroups.some((group) => group.meal.id === mealId),
    );
    const mealGroup = list?.mealGroups.find((group) => group.meal.id === mealId);
    if (!mealGroup) return new HttpResponse(null, { status: 404 });

    const newItem: ApiShoppingListItem = {
      id: crypto.randomUUID(),
      name: body.name,
      quantity: body.quantity,
      order: mealGroup.items.length,
      checked: false,
      recipeProfileGroceryItemId: null,
      plannedMealId: mealId,
    };
    mealGroup.items.push(newItem);
    return HttpResponse.json(newItem, { status: 201 });
  }),

  http.put('/api/shopping-lists/:itemId', async ({ params, request }) => {
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
    for (const list of Object.values(shoppingListDb)) {
      // Check manual groceries
      const manualItem = list.items.find((i) => i.id === itemId);
      if (manualItem) {
        Object.assign(manualItem, body);
        return HttpResponse.json(manualItem);
      }
      // Check meal groceries
      for (const mg of list.mealGroups) {
        const item = mg.items.find((i) => i.id === itemId);
        if (item) {
          Object.assign(item, body);
          return HttpResponse.json(item);
        }
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),

  http.put('/api/shopping-lists/:listId/items/order', async ({ params, request }) => {
    const list = Object.values(shoppingListDb).find(
      (candidate) => candidate.id === params['listId'],
    );
    if (!list) return new HttpResponse(null, { status: 404 });
    const body = (await request.json()) as {
      plannedMealId: string | null;
      itemIds: string[];
    };
    const items = body.plannedMealId
      ? list.mealGroups.find((group) => group.meal.id === body.plannedMealId)?.items
      : list.items;
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

  http.delete('/api/shopping-lists/:itemId', ({ params }) => {
    const itemId = params['itemId'] as string;
    for (const list of Object.values(shoppingListDb)) {
      const manualIdx = list.items.findIndex((i) => i.id === itemId);
      if (manualIdx >= 0) {
        list.items.splice(manualIdx, 1);
        return new HttpResponse(null, { status: 204 });
      }
      for (const mg of list.mealGroups) {
        const idx = mg.items.findIndex((i) => i.id === itemId);
        if (idx >= 0) {
          mg.items.splice(idx, 1);
          return new HttpResponse(null, { status: 204 });
        }
      }
    }
    return new HttpResponse(null, { status: 404 });
  }),
];
