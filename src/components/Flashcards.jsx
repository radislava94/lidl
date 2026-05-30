import { useState, useMemo } from 'react';
import { useApp }            from '../store/AppContext';
import { buildFlashcards }   from '../utils/quiz';
import { pct }               from '../utils/helpers';

export default function Flashcards() {
  const { state, actions } = useApp();

  const [catFilter, setCatFilter] = useState('all');
  const [cards, setCards]         = useState(null);  // null = not started yet
  const [idx, setIdx]             = useState(0);
  const [flipped, setFlipped]     = useState(false);
  const [knownCount, setKnownCount] = useState(0);

  const pool = useMemo(
    () => buildFlashcards(state.products, catFilter),
    [state.products, catFilter]
  );

  function startDeck(nextCategory = catFilter) {
    setCards(buildFlashcards(state.products, nextCategory));
    setIdx(0);
    setFlipped(false);
    setKnownCount(0);
  }

  function shuffle(nextCategory = catFilter) {
    setCards(buildFlashcards(state.products, nextCategory));
    setIdx(0);
    setFlipped(false);
    setKnownCount(0);
  }

  function next() {
    setIdx(i => Math.min(i + 1, (cards?.length ?? 1) - 1));
    setFlipped(false);
  }

  function prev() {
    setIdx(i => Math.max(i - 1, 0));
    setFlipped(false);
  }

  function markKnown(known) {
    const card = cards[idx];
    if (known) {
      setKnownCount(k => k + 1);
      actions.markMastered(card.plu);
      actions.addXP(3);
    } else {
      actions.recordMistake(card.plu);
    }
    if (idx < cards.length - 1) {
      next();
    } else {
      // deck complete
      setIdx(cards.length); // sentinel value → show "deck complete" state
    }
  }

  // ── Not started ────────────────────────────────────────────────────────────
  if (!cards) {
    return (
      <div className="page active">
        <div className="page-header">
          <h2 className="page-title"><i className="fa fa-layer-group" /> Flashcards</h2>
          <p className="page-sub">Flip cards to test your memory</p>
        </div>
        <div className="section-card" style={{ maxWidth: 440, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 12 }}>🃏</div>
          <h3 style={{ marginBottom: 16 }}>Choose a category</h3>
          <select className="select-styled" value={catFilter} onChange={e => {
            const nextCategory = e.target.value;
            setCatFilter(nextCategory);
            shuffle(nextCategory);
          }} style={{ width: '100%', marginBottom: 16 }}>
            <option value="all">All Categories ({state.products.length} cards)</option>
            {state.categories.map(c => (
              <option key={c.id} value={c.id}>{c.emoji} {c.name} ({c.count} cards)</option>
            ))}
          </select>
          <button type="button" className="btn-primary btn-lg" style={{ width: '100%' }} onClick={() => startDeck()}>
            <i className="fa fa-play" /> Start Deck
          </button>
        </div>
      </div>
    );
  }

  // ── Deck complete ──────────────────────────────────────────────────────────
  if (idx >= cards.length) {
    return (
      <div className="page active">
        <div className="page-header">
          <h2 className="page-title"><i className="fa fa-layer-group" /> Flashcards</h2>
        </div>
        <div className="quiz-results" style={{ display: 'block' }}>
          <div className="results-trophy">🎴</div>
          <h2 className="results-title">Deck Complete!</h2>
          <div className="results-stats">
            <div className="res-stat"><span>{knownCount}</span><small>Known</small></div>
            <div className="res-stat"><span>{cards.length - knownCount}</span><small>Review</small></div>
            <div className="res-stat"><span>{pct(knownCount, cards.length)}%</span><small>Known %</small></div>
          </div>
          <div className="results-actions">
            <button type="button" className="btn-primary" onClick={() => shuffle()}><i className="fa fa-redo" /> Shuffle Again</button>
            <button type="button" className="btn-outline" onClick={() => setCards(null)}><i className="fa fa-home" /> Categories</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active card ─────────────────────────────────────────────────────────────
  const card  = cards[idx];
  const total = cards.length;
  const progress = pct(idx + 1, total);
  const cat  = state.categories.find(c => c.id === card.category);

  return (
    <div className="page active">
      <div className="page-header">
        <h2 className="page-title"><i className="fa fa-layer-group" /> Flashcards</h2>
        <p className="page-sub">{cat?.emoji} {cat?.name}</p>
      </div>

      <div className="flashcard-controls">
        <select className="select-styled" value={catFilter} onChange={e => { setCatFilter(e.target.value); shuffle(); }}>
          <option value="all">All Categories</option>
          {state.categories.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
        </select>
        <button className="btn-outline btn-sm" onClick={shuffle}><i className="fa fa-random" /> Shuffle</button>
      </div>

      <div className="flashcard-progress-row">
        <span>{idx + 1}</span> / <span>{total}</span>
        <div className="progress-bar-track fc-track">
          <div className="progress-bar-fill yellow-fill" style={{ width: progress + '%' }} />
        </div>
      </div>

      {/* Card */}
      <div className="flashcard-stage">
        <div
          className={`flashcard${flipped ? ' flipped' : ''}`}
          role="button"
          tabIndex={0}
          aria-pressed={flipped}
          onClick={() => setFlipped(f => !f)}
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setFlipped(f => !f);
            }
          }}
        >
          <div className="fc-front">
            <div className="fc-emoji">{card.emoji}</div>
            <div className="fc-name">{card.name}</div>
            <div className="fc-hint">Tap to reveal PLU</div>
          </div>
          <div className="fc-back">
            <div className="fc-plu-label">PLU Code</div>
            <div className="fc-plu">{card.plu}</div>
            {card.nameEn && <div className="fc-name-en">{card.nameEn}</div>}
            <div className="fc-cat">{cat?.name}</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="flashcard-nav">
        <button type="button" className="btn-outline" onClick={prev} disabled={idx === 0}>
          <i className="fa fa-chevron-left" /> Prev
        </button>
        <div className="fc-dots">
          {Array.from({ length: Math.min(total, 10) }).map((_, i) => (
            <div key={i} className={`fc-dot${i === idx % 10 ? ' active' : ''}`} />
          ))}
        </div>
        <button type="button" className="btn-outline" onClick={next} disabled={idx === total - 1}>
          Next <i className="fa fa-chevron-right" />
        </button>
      </div>

      {/* Self-assessment */}
      {flipped && (
        <div className="fc-self-assess">
          <p>Did you know it?</p>
          <button type="button" className="btn-red"   onClick={() => markKnown(false)}><i className="fa fa-times" /> Nope</button>
          <button type="button" className="btn-green" onClick={() => markKnown(true)}><i className="fa fa-check" /> Got it!</button>
        </div>
      )}
    </div>
  );
}
