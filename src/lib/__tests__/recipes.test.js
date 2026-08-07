import { describe, it, expect } from 'vitest';
import {
  nameMatchesIngredient,
  recipeKey,
  filterRecipesByDiet,
  getRecipeSuggestions,
} from '../recipes';

const recipe = (ingredients) => ({ title: 't', ingredients });

// filterRecipesByDiet works on whole recipes; this asks "does a recipe with
// just this ingredient survive the filter?"
const passes = (ingredient, diet) =>
  filterRecipesByDiet([recipe([ingredient])], diet).length === 1;

describe('nameMatchesIngredient', () => {
  it('matches case-insensitively in both containment directions', () => {
    expect(nameMatchesIngredient('Cheddar Cheese', 'cheddar')).toBe(true);
    expect(nameMatchesIngredient('rice', 'brown rice')).toBe(true);
    expect(nameMatchesIngredient('milk', 'chicken')).toBe(false);
  });

  it('ignores punctuation and digits', () => {
    expect(nameMatchesIngredient('100% Greek Yogurt!', 'greek yogurt')).toBe(true);
  });

  it('never matches when either side normalizes to empty (regression: "2%" matched everything)', () => {
    expect(nameMatchesIngredient('milk', '')).toBe(false);
    expect(nameMatchesIngredient('', 'chicken')).toBe(false);
    expect(nameMatchesIngredient('2%', 'chicken')).toBe(false);
    expect(nameMatchesIngredient('milk', '123')).toBe(false);
    expect(nameMatchesIngredient('2%', '2%')).toBe(false);
  });
});

describe('recipeKey', () => {
  it('slugs titles stably', () => {
    expect(recipeKey({ title: 'Pasta Bolognese' })).toBe('pasta-bolognese');
    expect(recipeKey({ title: '  Egg-Fried Rice! ' })).toBe('egg-fried-rice');
    expect(recipeKey({ id: 'fallback-id' })).toBe('fallback-id');
  });
});

describe('filterRecipesByDiet', () => {
  it('returns everything for "all" or unknown diets', () => {
    const list = [recipe(['bacon'])];
    expect(filterRecipesByDiet(list, 'all')).toBe(list);
    expect(filterRecipesByDiet(list, 'keto')).toBe(list);
    expect(filterRecipesByDiet(list, null)).toBe(list);
  });

  it('blocks real animal products', () => {
    expect(passes('milk', 'dairyfree')).toBe(false);
    expect(passes('sour cream', 'dairyfree')).toBe(false);
    expect(passes('buttermilk', 'dairyfree')).toBe(false);
    expect(passes('eggs', 'vegan')).toBe(false);
    expect(passes('honey', 'vegan')).toBe(false);
    expect(passes('mayonnaise', 'vegan')).toBe(false);
    expect(passes('ground beef', 'vegetarian')).toBe(false);
    expect(passes('meatballs', 'vegetarian')).toBe(false);
    expect(passes('chicken broth', 'vegetarian')).toBe(false);
    expect(passes('soy sauce', 'glutenfree')).toBe(false);
    expect(passes('pasta', 'glutenfree')).toBe(false);
  });

  it('does not block plant-based lookalikes (the old substring bug)', () => {
    expect(passes('coconut milk', 'dairyfree')).toBe(true);
    expect(passes('oat milk', 'dairyfree')).toBe(true);
    expect(passes('peanut butter', 'vegan')).toBe(true);
    expect(passes('vegan butter', 'vegan')).toBe(true);
    expect(passes('eggplant', 'vegan')).toBe(true); // word boundary, not substring
    expect(passes('rice noodles', 'glutenfree')).toBe(true);
    expect(passes('corn tortillas', 'glutenfree')).toBe(true);
  });

  it('still blocks a real trigger next to an allowed phrase', () => {
    expect(passes('butter and coconut milk', 'dairyfree')).toBe(false);
  });
});

describe('getRecipeSuggestions', () => {
  it('returns [] for an empty pantry', () => {
    expect(getRecipeSuggestions([])).toEqual([]);
    expect(getRecipeSuggestions(null)).toEqual([]);
  });

  it('scores recipes by pantry match and reports matched/missing', () => {
    const results = getRecipeSuggestions([
      { name: 'pasta' },
      { name: 'tomatoes' },
      { name: 'garlic' },
      { name: 'olive oil' },
      { name: 'cheddar cheese' },
    ]);
    expect(results.length).toBeGreaterThan(0);

    const top = results[0];
    expect(top.id).toBe('tomato-pasta'); // full 5/5 match ranks first
    expect(top.matchRatio).toBe(1);
    expect(top.missing).toEqual([]);

    for (const r of results) {
      expect(r.matchCount).toBeGreaterThanOrEqual(1);
      expect(r.matched.length + r.missing.length).toBe(r.ingredients.length);
    }
  });
});
