// ─── Category metadata ────────────────────────────────────────────────────────
export const CATEGORY_META = {
  fruits:     { name: 'Fruits',      emoji: '🍎', color: '#e3000f' },
  vegetables: { name: 'Vegetables',  emoji: '🥦', color: '#22c55e' },
  bakery:     { name: 'Bakery',      emoji: '🥖', color: '#f59e0b' },
  drinks:     { name: 'Drinks',      emoji: '🥤', color: '#06b6d4' },
  snacks:     { name: 'Snacks',      emoji: '🍫', color: '#8b5cf6' },
  dairy:      { name: 'Dairy',       emoji: '🥛', color: '#a7c7e7' },
  meat:       { name: 'Meat',        emoji: '🥩', color: '#e07b7b' },
  frozen:     { name: 'Frozen',      emoji: '🧊', color: '#7ec8e3' },
  household:  { name: 'Household',   emoji: '🧴', color: '#b2d8b2' },
  cosmetics:  { name: 'Cosmetics',   emoji: '💄', color: '#f4a7c3' },
  pet_food:   { name: 'Pet Food',    emoji: '🐶', color: '#c4a882' },
  mixed:      { name: 'Mixed',       emoji: '⭐', color: '#9b59b6' },
};

/**
 * Fetch all products from the single products.json file.
 * PLUs are normalised to strings so existing code works unchanged.
 * Add new items to public/data/products.json to expand the product list.
 */
export async function loadAllProducts() {
  try {
    const r = await fetch('/data/products.json');
    if (!r.ok) throw new Error('Failed to load products.json');
    const data = await r.json();
    return data.map(p => ({ ...p, plu: String(p.plu), id: String(p.plu) }));
  } catch (err) {
    console.error('[dataLoader] Could not load products:', err);
    return [];
  }
}

/**
 * Load a single category.
 */
export async function loadCategory(category) {
  const r = await fetch(`/data/${category}.json`);
  if (!r.ok) throw new Error(`Failed to load ${category}.json`);
  const data = await r.json();
  return data.map(p => ({ ...p, id: p.plu }));
}

/**
 * Build the categories array from a flat products list.
 */
export function buildCategories(products) {
  // Derive category list dynamically from the loaded products
  const ids = [...new Set(products.map(p => p.category))];
  return ids.map(id => {
    const meta  = CATEGORY_META[id] || { name: id, emoji: '📦', color: '#64748b' };
    const items = products.filter(p => p.category === id);
    return { id, ...meta, products: items, count: items.length };
  }).filter(c => c.count > 0);
}
