// ─── Search ───────────────────────────────────────────────────────────────────

/**
 * Full-text search across name, PLU, and category.
 */
export function searchProducts(products, query) {
  if (!query || !query.trim()) return products;
  const q = query.toLowerCase().trim();
  return products.filter(
    p =>
      p.name.toLowerCase().includes(q) ||
      (p.nameEn && p.nameEn.toLowerCase().includes(q)) ||
      String(p.plu).includes(q) ||
      p.category.toLowerCase().includes(q)
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

export function filterByCategory(products, category) {
  if (!category || category === 'all') return products;
  return products.filter(p => p.category === category);
}

export function filterByDifficulty(products, difficulty) {
  if (!difficulty || difficulty === 'all') return products;
  return products.filter(p => p.difficulty === difficulty);
}

export function filterFavorites(products, favorites) {
  return products.filter(p => favorites[p.plu]);
}

// ─── Combined filter ──────────────────────────────────────────────────────────

/**
 * Apply all filters in one call.
 *
 * @param {Object[]} products
 * @param {Object}   opts
 * @param {string}   opts.query
 * @param {string}   opts.category   – 'all' or category id
 * @param {string}   opts.difficulty – 'all' | 'easy' | 'medium' | 'hard'
 * @param {boolean}  opts.favoritesOnly
 * @param {Object}   opts.favorites  – { [plu]: true }
 */
export function applyFilters(products, {
  query        = '',
  category     = 'all',
  difficulty   = 'all',
  favoritesOnly = false,
  favorites    = {},
} = {}) {
  let result = products;
  result = filterByCategory(result, category);
  result = filterByDifficulty(result, difficulty);
  result = searchProducts(result, query);
  if (favoritesOnly) result = filterFavorites(result, favorites);
  return result;
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

export function sortProducts(products, by = 'name') {
  const copy = [...products];
  if (by === 'name')       return copy.sort((a, b) => a.name.localeCompare(b.name));
  if (by === 'plu')        return copy.sort((a, b) => a.plu.localeCompare(b.plu));
  if (by === 'difficulty') {
    const order = { easy: 0, medium: 1, hard: 2 };
    return copy.sort((a, b) => (order[a.difficulty] ?? 1) - (order[b.difficulty] ?? 1));
  }
  return copy;
}
