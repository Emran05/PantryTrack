// Recipe engine — AI-powered via Gemini with local fallback.

import { supabase } from './supabase';
import { getDaysUntilExpiration } from './helpers';

// Local recipe database for instant fallback while AI loads
const LOCAL_RECIPES = [
  {
    id: 'pasta-bolognese',
    title: 'Pasta Bolognese',
    time: '30 min',
    difficulty: 'Easy',
    servings: 4,
    ingredients: ['ground beef', 'pasta', 'tomatoes', 'onion', 'garlic'],
    instructions: [
      'Cook pasta according to package directions.',
      'Brown ground beef in a large skillet, draining excess fat.',
      'Add diced tomatoes, onion, and garlic. Simmer for 15 minutes.',
      'Season with salt, pepper, and Italian herbs.',
      'Toss sauce with pasta and serve.',
    ],
  },
  {
    id: 'banana-smoothie',
    title: 'Banana Berry Smoothie',
    time: '5 min',
    difficulty: 'Easy',
    servings: 2,
    ingredients: ['bananas', 'frozen berries', 'greek yogurt', 'milk'],
    instructions: [
      'Add bananas, frozen berries, yogurt, and milk to a blender.',
      'Blend until smooth, about 1 minute.',
      'Pour into glasses and serve immediately.',
    ],
  },
  {
    id: 'chicken-rice-bowl',
    title: 'Chicken Rice Bowl',
    time: '25 min',
    difficulty: 'Easy',
    servings: 2,
    ingredients: ['chicken breast', 'brown rice', 'spinach', 'sour cream'],
    instructions: [
      'Cook rice according to package directions.',
      'Season chicken with salt, pepper, and paprika. Pan-sear for 6 minutes per side.',
      'Slice chicken and arrange over rice with fresh spinach.',
      'Top with a dollop of sour cream.',
    ],
  },
  {
    id: 'grilled-cheese',
    title: 'Grilled Cheese Sandwich',
    time: '10 min',
    difficulty: 'Easy',
    servings: 1,
    ingredients: ['bread', 'cheddar cheese', 'butter'],
    instructions: [
      'Butter one side of each bread slice.',
      'Place cheese between bread slices (butter-side out).',
      'Cook in a skillet over medium heat, 3 minutes per side until golden.',
    ],
  },
  {
    id: 'egg-fried-rice',
    title: 'Egg Fried Rice',
    time: '15 min',
    difficulty: 'Easy',
    servings: 2,
    ingredients: ['eggs', 'brown rice', 'spinach', 'soy sauce'],
    instructions: [
      'Cook rice and let it cool (or use leftover rice).',
      'Scramble eggs in a hot wok or skillet.',
      'Add rice and stir-fry on high heat for 3 minutes.',
      'Toss in spinach and soy sauce. Cook until spinach wilts.',
    ],
  },
  {
    id: 'tomato-pasta',
    title: 'Quick Tomato Pasta',
    time: '20 min',
    difficulty: 'Easy',
    servings: 3,
    ingredients: ['pasta', 'tomatoes', 'garlic', 'olive oil', 'cheddar cheese'],
    instructions: [
      'Cook pasta al dente.',
      'Sauté garlic in olive oil, add diced tomatoes.',
      'Simmer sauce for 10 minutes.',
      'Toss with pasta and top with shredded cheese.',
    ],
  },
  {
    id: 'yogurt-parfait',
    title: 'Yogurt Parfait',
    time: '5 min',
    difficulty: 'Easy',
    servings: 1,
    ingredients: ['greek yogurt', 'bananas', 'frozen berries', 'granola'],
    instructions: [
      'Layer yogurt in a glass or bowl.',
      'Add sliced bananas and berries.',
      'Top with granola for crunch.',
    ],
  },
  {
    id: 'beef-tacos',
    title: 'Quick Beef Tacos',
    time: '20 min',
    difficulty: 'Easy',
    servings: 3,
    ingredients: ['ground beef', 'tomatoes', 'cheddar cheese', 'sour cream', 'tortillas'],
    instructions: [
      'Brown ground beef with taco seasoning.',
      'Dice tomatoes and shred cheese.',
      'Warm tortillas in a dry pan.',
      'Assemble tacos with beef, tomatoes, cheese, and sour cream.',
    ],
  },
  {
    id: 'spinach-omelette',
    title: 'Spinach Cheese Omelette',
    time: '10 min',
    difficulty: 'Easy',
    servings: 1,
    ingredients: ['eggs', 'spinach', 'cheddar cheese', 'milk'],
    instructions: [
      'Whisk eggs with a splash of milk.',
      'Pour into a buttered non-stick skillet over medium heat.',
      'Add spinach and cheese to one half.',
      'Fold omelette over and cook until set.',
    ],
  },
  {
    id: 'chicken-stir-fry',
    title: 'Chicken Stir Fry',
    time: '20 min',
    difficulty: 'Medium',
    servings: 2,
    ingredients: ['chicken breast', 'brown rice', 'spinach', 'soy sauce', 'garlic'],
    instructions: [
      'Slice chicken into strips and season.',
      'Stir-fry chicken in a hot wok until cooked through.',
      'Add spinach and garlic, cook for 2 minutes.',
      'Add soy sauce and serve over cooked rice.',
    ],
  },
];

// Normalize item names for fuzzy matching
function normalize(str) {
  return str.toLowerCase().replace(/[^a-z ]/g, '').trim();
}

function nameMatchesIngredient(itemName, ingredient) {
  const normalizedItem = normalize(itemName);
  const normalizedIngredient = normalize(ingredient);
  return normalizedItem.includes(normalizedIngredient) || normalizedIngredient.includes(normalizedItem);
}

/**
 * Local-only recipe matching (instant, used as fallback)
 */
export function getRecipeSuggestions(pantryItems) {
  if (!pantryItems || pantryItems.length === 0) return [];

  const pantryNames = pantryItems.map((item) => item.name);

  const scored = LOCAL_RECIPES.map((recipe) => {
    const matched = [];
    const missing = [];

    recipe.ingredients.forEach((ingredient) => {
      const found = pantryNames.some((name) => nameMatchesIngredient(name, ingredient));
      if (found) {
        matched.push(ingredient);
      } else {
        missing.push(ingredient);
      }
    });

    const matchRatio = matched.length / recipe.ingredients.length;

    return {
      ...recipe,
      matched,
      missing,
      matchRatio,
      matchCount: matched.length,
    };
  });

  return scored
    .filter((r) => r.matchCount >= 1)
    .sort((a, b) => b.matchRatio - a.matchRatio || a.missing.length - b.missing.length);
}

/**
 * AI-powered recipe suggestions via Gemini edge function.
 * Returns personalized recipes based on actual pantry contents.
 * Prioritizes expiring items to reduce food waste.
 */
export async function getAIRecipeSuggestions(pantryItems) {
  if (!pantryItems || pantryItems.length === 0) return [];

  const hasExpiring = pantryItems.some(
    (i) => i.expirationDate && getDaysUntilExpiration(i.expirationDate) <= 3
  );

  const items = pantryItems.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    daysLeft: item.expirationDate ? getDaysUntilExpiration(item.expirationDate) : undefined,
  }));

  const { data, error } = await supabase.functions.invoke('suggest-recipes', {
    body: { items, prioritizeExpiring: hasExpiring },
  });

  if (error) throw error;
  return data.recipes || [];
}
