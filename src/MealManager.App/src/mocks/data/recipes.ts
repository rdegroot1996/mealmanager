import { ApiRecipeTag } from '../../app/api/models/api-recipe-summary';
import {
  ApiRecipeImage,
  ApiRecipeIngredient,
  ApiRecipeProfile,
  ApiRecipeStep,
} from '../../app/api/models/api-recipe';

export interface MockRecipe {
  id: string;
  name: string;
  notes?: string | null;
  category: string;
  baseServings: number;
  isFavorite?: boolean;
  tags: ApiRecipeTag[];
  images: ApiRecipeImage[];
  ingredients: ApiRecipeIngredient[];
  steps: ApiRecipeStep[];
  profiles: ApiRecipeProfile[];
}

export const recipes: MockRecipe[] = [
  {
    id: 'r1',
    name: 'Spaghetti Bolognese',
    category: 'Meals',
    baseServings: 4,
    tags: [
      { id: 't1', name: 'Italian' },
      { id: 't2', name: 'Pasta' },
      { id: 't3', name: 'Quick' },
    ],
    images: [{ id: 'img1', url: 'https://picsum.photos/seed/bolognese/300/200', order: 1 }],
    ingredients: [
      { id: 'i1', name: 'Spaghetti', quantity: 400, unit: 'g', order: 0 },
      { id: 'i2', name: 'Ground Beef', quantity: 500, unit: 'g', order: 1 },
      { id: 'i3', name: 'Tomato Sauce', quantity: 800, unit: 'ml', order: 2 },
      { id: 'i4', name: 'Onion', quantity: 1, unit: 'pcs', order: 3 },
      { id: 'i5', name: 'Garlic', quantity: 2, unit: 'pcs', order: 4 },
      { id: 'i6', name: 'Olive Oil', quantity: 2, unit: 'tbsp', order: 5 },
    ],
    steps: [
      { id: 'r1-s1', description: 'Cook spaghetti according to package instructions.', order: 1 },
      { id: 'r1-s2', description: 'Dice the onion and mince the garlic.', order: 2 },
      {
        id: 'r1-s3',
        description: 'Heat olive oil and sauté onion and garlic until translucent.',
        order: 3,
      },
      {
        id: 'r1-s4',
        description: 'Add ground beef and cook until browned, breaking it apart.',
        order: 4,
      },
      {
        id: 'r1-s5',
        description:
          'Pour in tomato sauce, season with salt and pepper, and simmer for 15 minutes.',
        order: 5,
      },
      { id: 'r1-s6', description: 'Serve sauce over spaghetti.', order: 6 },
    ],
    profiles: [
      {
        id: 'r1-p1',
        name: 'Default',
        servings: 4,
        products: [
          { id: 'pr1', name: 'Spaghetti', quantity: 1, atHome: false },
          { id: 'pr2', name: 'Ground Beef', quantity: 1, atHome: false },
          { id: 'pr3', name: 'Tomato Sauce', quantity: 1, atHome: false },
          { id: 'pr4', name: 'Onion', quantity: 1, atHome: true },
          { id: 'pr5', name: 'Garlic', quantity: 1, atHome: true },
        ],
      },
      {
        id: 'r1-p2',
        name: 'Bulk',
        servings: 8,
        products: [
          { id: 'pr6', name: 'Spaghetti', quantity: 2, atHome: false },
          { id: 'pr7', name: 'Ground Beef', quantity: 2, atHome: false },
          { id: 'pr8', name: 'Tomato Sauce', quantity: 2, atHome: false },
          { id: 'pr9', name: 'Onion', quantity: 2, atHome: true },
          { id: 'pr10', name: 'Garlic', quantity: 4, atHome: true },
        ],
      },
    ],
  },
  {
    id: 'r2',
    name: 'Chicken Stir Fry',
    category: 'Meals',
    baseServings: 3,
    tags: [
      { id: 't4', name: 'Asian' },
      { id: 't3', name: 'Quick' },
      { id: 't5', name: 'Healthy' },
    ],
    images: [{ id: 'img2', url: 'https://picsum.photos/seed/stirfry/300/200', order: 1 }],
    ingredients: [
      { id: 'i7', name: 'Chicken Breast', quantity: 500, unit: 'g', order: 0 },
      { id: 'i8', name: 'Bell Pepper', quantity: 2, unit: 'pcs', order: 1 },
      { id: 'i9', name: 'Broccoli', quantity: 200, unit: 'g', order: 2 },
      { id: 'i10', name: 'Soy Sauce', quantity: 3, unit: 'tbsp', order: 3 },
      { id: 'i11', name: 'Sesame Oil', quantity: 1, unit: 'tbsp', order: 4 },
      { id: 'i12', name: 'Rice', quantity: 300, unit: 'g', order: 5 },
      { id: 'i13', name: 'Ginger', quantity: 1, unit: 'pcs', order: 6 },
    ],
    steps: [
      { id: 'r2-s1', description: 'Cook rice according to package instructions.', order: 1 },
      { id: 'r2-s2', description: 'Slice chicken breast into thin strips.', order: 2 },
      {
        id: 'r2-s3',
        description: 'Cut bell peppers into strips, break broccoli into small florets.',
        order: 3,
      },
      {
        id: 'r2-s4',
        description: 'Heat sesame oil in a wok over high heat, stir-fry chicken for 4 minutes.',
        order: 4,
      },
      {
        id: 'r2-s5',
        description: 'Add vegetables and grated ginger, stir-fry for 3 minutes.',
        order: 5,
      },
      {
        id: 'r2-s6',
        description: 'Add soy sauce, toss everything together, and serve over rice.',
        order: 6,
      },
    ],
    profiles: [
      {
        id: 'r2-p1',
        name: 'Default',
        servings: 3,
        products: [
          { id: 'pr11', name: 'Chicken Breast', quantity: 1, atHome: false },
          { id: 'pr12', name: 'Bell Pepper', quantity: 2, atHome: false },
          { id: 'pr13', name: 'Broccoli', quantity: 1, atHome: false },
          { id: 'pr14', name: 'Soy Sauce', quantity: 1, atHome: true },
          { id: 'pr15', name: 'Rice', quantity: 1, atHome: true },
        ],
      },
    ],
  },
  {
    id: 'r3',
    name: 'Greek Salad',
    category: 'Meals',
    baseServings: 2,
    tags: [
      { id: 't5', name: 'Healthy' },
      { id: 't3', name: 'Quick' },
      { id: 't6', name: 'Vegetarian' },
      { id: 't7', name: 'No-Cook' },
    ],
    images: [{ id: 'img3', url: 'https://picsum.photos/seed/greeksalad/300/200', order: 1 }],
    ingredients: [
      { id: 'i14', name: 'Cucumber', quantity: 1, unit: 'pcs', order: 0 },
      { id: 'i15', name: 'Tomatoes', quantity: 4, unit: 'pcs', order: 1 },
      { id: 'i16', name: 'Red Onion', quantity: 0.5, unit: 'pcs', order: 2 },
      { id: 'i17', name: 'Feta Cheese', quantity: 200, unit: 'g', order: 3 },
      { id: 'i18', name: 'Kalamata Olives', quantity: 100, unit: 'g', order: 4 },
      { id: 'i19', name: 'Olive Oil', quantity: 3, unit: 'tbsp', order: 5 },
    ],
    steps: [
      { id: 'r3-s1', description: 'Chop cucumber, tomatoes, and red onion into chunks.', order: 1 },
      { id: 'r3-s2', description: 'Combine vegetables in a large bowl.', order: 2 },
      { id: 'r3-s3', description: 'Add olives and crumble feta cheese on top.', order: 3 },
      {
        id: 'r3-s4',
        description: 'Drizzle with olive oil, season with oregano, salt, and pepper.',
        order: 4,
      },
    ],
    profiles: [
      {
        id: 'r3-p1',
        name: 'Default',
        servings: 2,
        products: [
          { id: 'pr16', name: 'Cucumber', quantity: 1, atHome: false },
          { id: 'pr17', name: 'Tomatoes', quantity: 4, atHome: false },
          { id: 'pr18', name: 'Feta Cheese', quantity: 1, atHome: false },
          { id: 'pr19', name: 'Kalamata Olives', quantity: 1, atHome: false },
        ],
      },
    ],
  },
  {
    id: 'r4',
    name: 'Pancakes',
    category: 'Meals',
    baseServings: 4,
    tags: [
      { id: 't3', name: 'Quick' },
      { id: 't8', name: 'Sweet' },
      { id: 't9', name: 'Kid-Friendly' },
    ],
    images: [{ id: 'img4', url: 'https://picsum.photos/seed/pancakes/300/200', order: 1 }],
    ingredients: [
      { id: 'i20', name: 'Flour', quantity: 200, unit: 'g', order: 0 },
      { id: 'i21', name: 'Milk', quantity: 300, unit: 'ml', order: 1 },
      { id: 'i22', name: 'Eggs', quantity: 2, unit: 'pcs', order: 2 },
      { id: 'i23', name: 'Sugar', quantity: 2, unit: 'tbsp', order: 3 },
      { id: 'i24', name: 'Butter', quantity: 30, unit: 'g', order: 4 },
      { id: 'i25', name: 'Baking Powder', quantity: 1, unit: 'tsp', order: 5 },
    ],
    steps: [
      { id: 'r4-s1', description: 'Mix flour, sugar, and baking powder in a bowl.', order: 1 },
      { id: 'r4-s2', description: 'Whisk in eggs and milk until smooth.', order: 2 },
      { id: 'r4-s3', description: 'Melt butter in a non-stick pan over medium heat.', order: 3 },
      {
        id: 'r4-s4',
        description: 'Pour small ladles of batter, cook until bubbles form, then flip.',
        order: 4,
      },
      {
        id: 'r4-s5',
        description: 'Serve with maple syrup, fresh fruit, or whipped cream.',
        order: 5,
      },
    ],
    profiles: [
      {
        id: 'r4-p1',
        name: 'Default',
        servings: 4,
        products: [
          { id: 'pr20', name: 'Flour', quantity: 1, atHome: true },
          { id: 'pr21', name: 'Milk', quantity: 1, atHome: false },
          { id: 'pr22', name: 'Eggs', quantity: 1, atHome: true },
          { id: 'pr23', name: 'Butter', quantity: 1, atHome: true },
        ],
      },
    ],
  },
  {
    id: 'r5',
    name: 'Beef Tacos',
    category: 'Meals',
    baseServings: 4,
    tags: [
      { id: 't10', name: 'Mexican' },
      { id: 't3', name: 'Quick' },
      { id: 't11', name: 'Spicy' },
    ],
    images: [{ id: 'img5', url: 'https://picsum.photos/seed/tacos/300/200', order: 1 }],
    ingredients: [
      { id: 'i26', name: 'Ground Beef', quantity: 400, unit: 'g', order: 0 },
      { id: 'i27', name: 'Taco Shells', quantity: 8, unit: 'pcs', order: 1 },
      { id: 'i28', name: 'Lettuce', quantity: 1, unit: 'pcs', order: 2 },
      { id: 'i29', name: 'Tomato', quantity: 2, unit: 'pcs', order: 3 },
      { id: 'i30', name: 'Cheddar Cheese', quantity: 100, unit: 'g', order: 4 },
      { id: 'i31', name: 'Sour Cream', quantity: 100, unit: 'ml', order: 5 },
      { id: 'i32', name: 'Taco Seasoning', quantity: 1, unit: 'pcs', order: 6 },
    ],
    steps: [
      {
        id: 'r5-s1',
        description: 'Brown the ground beef in a skillet, drain excess fat.',
        order: 1,
      },
      {
        id: 'r5-s2',
        description: 'Add taco seasoning and a splash of water, simmer 5 minutes.',
        order: 2,
      },
      { id: 'r5-s3', description: 'Warm taco shells in the oven for 2 minutes.', order: 3 },
      { id: 'r5-s4', description: 'Shred lettuce, dice tomatoes, grate cheese.', order: 4 },
      {
        id: 'r5-s5',
        description: 'Fill shells with beef, top with lettuce, tomato, cheese, and sour cream.',
        order: 5,
      },
    ],
    profiles: [
      {
        id: 'r5-p1',
        name: 'Default',
        servings: 4,
        products: [
          { id: 'pr24', name: 'Ground Beef', quantity: 1, atHome: false },
          { id: 'pr25', name: 'Taco Shells', quantity: 1, atHome: false },
          { id: 'pr26', name: 'Lettuce', quantity: 1, atHome: false },
          { id: 'pr27', name: 'Cheddar Cheese', quantity: 1, atHome: false },
          { id: 'pr28', name: 'Sour Cream', quantity: 1, atHome: false },
        ],
      },
      {
        id: 'r5-p2',
        name: 'Party',
        servings: 8,
        products: [
          { id: 'pr29', name: 'Ground Beef', quantity: 2, atHome: false },
          { id: 'pr30', name: 'Taco Shells', quantity: 2, atHome: false },
          { id: 'pr31', name: 'Lettuce', quantity: 2, atHome: false },
          { id: 'pr32', name: 'Cheddar Cheese', quantity: 2, atHome: false },
          { id: 'pr33', name: 'Sour Cream', quantity: 2, atHome: false },
        ],
      },
    ],
  },
];
