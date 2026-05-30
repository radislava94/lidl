import { useState, useMemo } from 'react';
import { useApp }            from '../store/AppContext';
import { applyFilters }      from '../utils/search';

export default function Learn() {
  const { state, actions } = useApp();
  const [activeCategory, setActiveCategory] = useState('all');
  const [query, setQuery] = useState('');

  const filteredProducts = useMemo(() => applyFilters(state.products, {
    category: activeCategory,
    difficulty: 'all',
    query,
    favoritesOnly: false,
    favorites: state.favorites,
  }), [state.products, activeCategory, query, state.favorites]);

  const categoryButtons = useMemo(() => {
    const dynamic = state.categories
      .filter(c => c.count > 0)
      .map(c => ({
        id: c.id,
        label: c.name,
        emoji: c.emoji,
        count: c.count,
      }));

    return [{ id: 'all', label: 'All', emoji: '🧩', count: state.products.length }, ...dynamic];
  }, [state.categories, state.products.length]);

  const activeCategoryName = categoryButtons.find(c => c.id === activeCategory)?.label || 'All';
  const gridAnimationKey = `${activeCategory}-${query.trim().toLowerCase()}`;

  function handleMaster(product) {
    if (!state.masteredPLUs[product.plu]) {
      actions.markMastered(product.plu);
      actions.addXP(5);
      actions.updateStreak();
    }
  }

  return (
    <div className="page active learn-shell">
      <div className="learn-hero">
        <div className="page-header learn-header">
          <div className="learn-eyebrow">Product drill</div>
          <h2 className="page-title"><i className="fa fa-book-open" /> Learn Mode</h2>
          <p className="page-sub">Browse and master PLUs with a fast category filter and in-category search.</p>
        </div>

        <div className="learn-summary-chip">
          <i className="fa fa-layer-group" />
          <span>{filteredProducts.length} visible</span>
        </div>
      </div>

      <section className="learn-filter-panel">
        <div className="learn-searchbar">
          <i className="fa fa-search learn-search-icon" />
          <input
            className="learn-search-input"
            placeholder={`Search inside ${activeCategoryName}...`}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
        </div>

        <div className="category-tabs-scroll learn-tabs" aria-label="Category filters">
          {categoryButtons.map(cat => {
            const isActive = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={`learn-tab ${
                  isActive
                    ? 'learn-tab-active'
                    : ''
                }`}
              >
                <span className="learn-tab-emoji">{cat.emoji}</span>
                <span className="learn-tab-label">{cat.label}</span>
                <span className={`learn-tab-count ${isActive ? 'learn-tab-count-active' : ''}`}>
                  {cat.count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="learn-meta-row">
          <span>Active category: <strong>{activeCategoryName}</strong></span>
          <span>{filteredProducts.length} product{filteredProducts.length !== 1 ? 's' : ''}</span>
        </div>
      </section>

      {state.isLoadingProducts ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : filteredProducts.length === 0 ? (
        <div className="learn-empty-state">
          No products match this category and search query.
        </div>
      ) : (
        <div
          key={gridAnimationKey}
          className="products-grid-animate learn-grid"
        >
          {filteredProducts.map(product => {
            const mastered = !!state.masteredPLUs[product.plu];
            const categoryName = state.categories.find(c => c.id === product.category)?.name || 'Other';

            return (
              <article
                key={product.plu}
                className={`learn-product-card group flex min-h-[320px] flex-col overflow-hidden border ${
                  mastered ? 'border-emerald-400/80 ring-1 ring-emerald-200 dark:ring-emerald-900' : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <div className="learn-product-top">
                  <div className="learn-product-badge">
                    <span className="learn-product-badge-icon">{product.emoji || '📦'}</span>
                    <span>{categoryName}</span>
                  </div>
                  {mastered && (
                    <span className="learn-mastered-pill">
                      Mastered
                    </span>
                  )}
                </div>

                <div className="learn-product-media">
                  <span className="learn-product-emoji">{product.emoji || '🧺'}</span>
                </div>

                <h3 className="learn-product-title">
                  {product.name}
                </h3>

                <div className="learn-product-plu">
                  PLU {product.plu}
                </div>

                <button
                  className="learn-product-action"
                  disabled={mastered}
                  onClick={() => handleMaster(product)}
                >
                  {mastered ? 'Already Mastered' : 'Mark as Mastered'}
                </button>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
