// localStorage-based storage layer — drop-in replaceable with Supabase later

const PANTRY_KEY = 'pantry_items';
const SHOPPING_KEY = 'shopping_list';

function generateId() {
  return crypto.randomUUID();
}

function getItems(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function setItems(key, items) {
  localStorage.setItem(key, JSON.stringify(items));
}

// --- Helper: get a date string N days from today ---
function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

// --- Demo Seed Data ---
const SEED_ITEMS = [
  { name: 'Whole Milk', category: 'dairy', quantity: 1, unit: 'L', expirationDate: daysFromNow(5), notes: 'Organic 2%' },
  { name: 'Bananas', category: 'produce', quantity: 6, unit: 'pcs', expirationDate: daysFromNow(2), notes: '' },
  { name: 'Chicken Breast', category: 'meat', quantity: 2, unit: 'lbs', expirationDate: daysFromNow(1), notes: 'Meal prep Sunday' },
  { name: 'Brown Rice', category: 'grains', quantity: 1, unit: 'bags', expirationDate: daysFromNow(180), notes: '' },
  { name: 'Greek Yogurt', category: 'dairy', quantity: 3, unit: 'cups', expirationDate: daysFromNow(7), notes: 'Vanilla flavor' },
  { name: 'Frozen Berries', category: 'frozen', quantity: 1, unit: 'bags', expirationDate: daysFromNow(120), notes: 'For smoothies' },
];

function seedIfEmpty() {
  const existing = getItems(PANTRY_KEY);
  if (existing.length === 0 && !localStorage.getItem('pantry_seeded')) {
    const seeded = SEED_ITEMS.map((item) => ({
      id: generateId(),
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      unit: item.unit,
      expirationDate: item.expirationDate,
      notes: item.notes,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));
    setItems(PANTRY_KEY, seeded);
    localStorage.setItem('pantry_seeded', 'true');
    return seeded;
  }
  return existing;
}

// --- Pantry Items ---
export function getPantryItems() {
  return seedIfEmpty();
}

export function addPantryItem(item) {
  const items = getPantryItems();
  const newItem = {
    id: generateId(),
    name: item.name,
    category: item.category || 'other',
    quantity: item.quantity || 1,
    unit: item.unit || 'pcs',
    expirationDate: item.expirationDate || null,
    notes: item.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  items.unshift(newItem);
  setItems(PANTRY_KEY, items);
  return newItem;
}

export function updatePantryItem(id, updates) {
  const items = getPantryItems();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates, updatedAt: new Date().toISOString() };
  setItems(PANTRY_KEY, items);
  return items[idx];
}

export function deletePantryItem(id) {
  const items = getPantryItems().filter((i) => i.id !== id);
  setItems(PANTRY_KEY, items);
}

// --- Shopping List ---
export function getShoppingList() {
  return getItems(SHOPPING_KEY);
}

export function addShoppingItem(item) {
  const items = getShoppingList();
  const newItem = {
    id: generateId(),
    name: item.name,
    quantity: item.quantity || 1,
    unit: item.unit || '',
    isChecked: false,
    createdAt: new Date().toISOString(),
  };
  items.unshift(newItem);
  setItems(SHOPPING_KEY, items);
  return newItem;
}

export function updateShoppingItem(id, updates) {
  const items = getShoppingList();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  setItems(SHOPPING_KEY, items);
  return items[idx];
}

export function deleteShoppingItem(id) {
  const items = getShoppingList().filter((i) => i.id !== id);
  setItems(SHOPPING_KEY, items);
}

export function toggleShoppingItem(id) {
  const items = getShoppingList();
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx].isChecked = !items[idx].isChecked;
  setItems(SHOPPING_KEY, items);
  return items[idx];
}

// Move checked shopping items to pantry
export function moveCheckedToPantry() {
  const shoppingItems = getShoppingList();
  const checked = shoppingItems.filter((i) => i.isChecked);
  const remaining = shoppingItems.filter((i) => !i.isChecked);

  checked.forEach((item) => {
    addPantryItem({
      name: item.name,
      quantity: item.quantity,
      unit: item.unit,
      category: 'other',
    });
  });

  setItems(SHOPPING_KEY, remaining);
  return checked.length;
}
