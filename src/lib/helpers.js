// Categories with their display info
export const CATEGORIES = [
  { id: 'produce', label: 'Produce', color: 'var(--color-cat-produce)' },
  { id: 'dairy', label: 'Dairy', color: 'var(--color-cat-dairy)' },
  { id: 'meat', label: 'Meat', color: 'var(--color-cat-meat)' },
  { id: 'grains', label: 'Grains', color: 'var(--color-cat-grains)' },
  { id: 'frozen', label: 'Frozen', color: 'var(--color-cat-frozen)' },
  { id: 'beverages', label: 'Beverages', color: 'var(--color-cat-beverages)' },
  { id: 'snacks', label: 'Snacks', color: 'var(--color-cat-snacks)' },
  { id: 'condiments', label: 'Condiments', color: 'var(--color-cat-condiments)' },
  { id: 'other', label: 'Other', color: 'var(--color-cat-other)' },
];

export const UNITS = ['pcs', 'lbs', 'oz', 'kg', 'g', 'L', 'mL', 'cups', 'bags', 'boxes', 'cans', 'bottles'];

// Default shelf life in days by category (conservative/safe-side estimates)
export const DEFAULT_SHELF_LIFE = {
  produce: 7,       // 1 week for fresh fruits/veggies
  dairy: 21,         // 3 weeks for milk, cheese, yogurt
  meat: 5,           // 5 days for fresh meat
  grains: 14,        // 2 weeks for bread, cereal, pasta
  frozen: 180,       // 6 months for frozen items
  beverages: 60,     // 2 months for drinks
  snacks: 60,        // 2 months for snacks
  condiments: 90,    // 3 months for sauces, dressings
  other: 14,         // 2 weeks default
};

/**
 * Returns a default expiration date string (YYYY-MM-DD) based on category.
 * Optionally accepts shelfLifeDays to override the category default.
 */
export function getDefaultExpirationDate(category, shelfLifeDays) {
  const days = shelfLifeDays || DEFAULT_SHELF_LIFE[category] || DEFAULT_SHELF_LIFE.other;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().split('T')[0];
}

export function getCategoryInfo(categoryId) {
  return CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[CATEGORIES.length - 1];
}

// Returns: 'fresh' | 'soon' | 'expired' | null
export function getExpirationStatus(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(dateStr + 'T00:00:00');
  const diffMs = expDate - today;
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays <= 3) return 'soon';
  return 'fresh';
}

export function getDaysUntilExpiration(dateStr) {
  if (!dateStr) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expDate = new Date(dateStr + 'T00:00:00');
  return Math.ceil((expDate - today) / (1000 * 60 * 60 * 24));
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
