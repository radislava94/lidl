import { useState } from 'react';
import { useApp }   from '../store/AppContext';
import { applyFilters } from '../utils/search';

export default function Categories() {
  const { state, actions } = useApp();
  const [query, setQuery]  = useState('');

  const results = query.trim()
    ? applyFilters(state.products, { query })
    : [];

  return (
    <div className="page active">
      <div className="page-header">
        <h2 className="page-title"><i className="fa fa-th-large" /> Categories</h2>
        <p className="page-sub">Choose a category or search any product</p>
      </div>

      <div className="search-bar-wrap">
        <i className="fa fa-search search-icon" />
        <input
          className="search-bar"
          type="text"
          placeholder="Search by name or PLU…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      {query.trim() ? (
        /* Search results */
        <div className="search-results">
          {results.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No products found for "{query}".</p>
          ) : (
            results.map(p => {
              const cat = state.categories.find(c => c.id === p.category);
              return (
                <button
                  key={p.plu}
                  type="button"
                  className="search-item"
                  onClick={() => actions.setPage('learn')}
                >
                  <div className="si-emoji">{p.emoji}</div>
                  <div>
                    <div className="si-name">{p.name}</div>
                    <div className="si-cat">{cat?.emoji} {cat?.name}</div>
                  </div>
                  <div className="si-plu">{p.plu}</div>
                </button>
              );
            })
          )}
        </div>
      ) : (
        /* Category grid */
        <div className="big-cat-grid">
          {state.categories.map(cat => {
            const mastered = cat.products.filter(p => state.masteredPLUs[p.plu]).length;
            const pct = cat.count > 0 ? Math.round((mastered / cat.count) * 100) : 0;
            return (
              <button
                key={cat.id}
                type="button"
                className="big-cat-card"
                style={{ '--cat-color': cat.color }}
                onClick={() => actions.setPage('learn')}
              >
                <div className="big-cat-emoji">{cat.emoji}</div>
                <div className="big-cat-name">{cat.name}</div>
                <div className="big-cat-count">{mastered}/{cat.count} mastered</div>
                <div className="big-cat-bar">
                  <div className="big-cat-bar-fill" style={{ width: pct + '%', background: cat.color }} />
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
