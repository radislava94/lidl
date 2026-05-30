import { useState, useEffect, useMemo, useRef } from 'react';
import { useApp }         from '../store/AppContext';
import {
  buildMemoryPairs, isMatch, flipCard,
  markMatched, unflipUnmatched, isGameComplete, gridCols,
} from '../utils/memory';
import { useTimer } from '../hooks/useTimer';

// tiny confetti
function Confetti() {
  const COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#FF8E53'];
  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i, left: Math.random() * 100, delay: Math.random() * 0.8,
    color: COLORS[i % COLORS.length],
  }));
  return (
    <div className="confetti-wrap" aria-hidden>
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece"
          style={{ left: p.left + '%', background: p.color, animationDelay: p.delay + 's' }} />
      ))}
    </div>
  );
}

const MODE_OPTIONS = [
  { id: 'easy', label: 'Easy', cards: 6, pairs: 3 },
  { id: 'medium', label: 'Medium', cards: 12, pairs: 6 },
  { id: 'hard', label: 'Hard', cards: 20, pairs: 10 },
  { id: 'expert', label: 'Expert', cards: 30, pairs: 15 },
];

const CATEGORY_ALL = 'All categories';

export default function MemoryGame() {
  const { state, actions } = useApp();

  const [phase, setPhase]     = useState('lobby');  // lobby | active | done
  const [pairs, setPairs]     = useState(6);
  const [category, setCategory] = useState(CATEGORY_ALL);
  const [cards, setCards]     = useState([]);
  const [flipped, setFlipped] = useState([]);       // ids of face-up (unmatched) cards
  const [moves, setMoves]     = useState(0);
  const [matchCount, setMatchCount] = useState(0);
  const [score, setScore]     = useState(0);
  const [combo, setCombo]     = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [mismatchIds, setMismatchIds] = useState([]);
  const [locked, setLocked]   = useState(false);    // locked while evaluating pair
  const mismatchTimerRef = useRef(null);
  const lockRef = useRef(false);

  const { seconds, start, stop } = useTimer(0, null); // count-up (0 = no expire)

  const filteredProducts = useMemo(() => {
    if (!state.products.length) return [];
    if (category === CATEGORY_ALL) return state.products;
    return state.products.filter(product => product.category === category);
  }, [state.products, category]);

  const selectedMode = MODE_OPTIONS.find(option => option.pairs === pairs) || MODE_OPTIONS[1];
  const playablePairs = Math.max(1, Math.min(pairs, filteredProducts.length || pairs));
  const categoryOptions = [
    { id: CATEGORY_ALL, label: CATEGORY_ALL, emoji: '🗂️' },
    ...state.categories.map(cat => ({ id: cat.id, label: cat.name, emoji: cat.emoji })),
  ];

  useEffect(() => {
    return () => {
      clearTimeout(mismatchTimerRef.current);
      lockRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'active') return;
    clearTimeout(mismatchTimerRef.current);
    setMismatchIds([]);
  }, [phase]);

  function startGame() {
    const pool = filteredProducts.length ? filteredProducts : state.products;
    const newCards = buildMemoryPairs(pool, Math.min(pairs, pool.length || pairs));
    clearTimeout(mismatchTimerRef.current);
    lockRef.current = false;
    setCards(newCards);
    setFlipped([]);
    setMoves(0);
    setMatchCount(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setMismatchIds([]);
    setLocked(false);
    setPhase('active');
    start();
  }

  function endGame(finalScore, finalBestCombo) {
    stop();
    lockRef.current = false;
    const xpEarned = Math.max(20, Math.round(finalScore / 5) + playablePairs * 6 + finalBestCombo * 4);
    actions.addXP(xpEarned);
    actions.updateStreak();
    setPhase('done');
  }

  function handleCardClick(cardId) {
    if (locked || lockRef.current) return;
    const card = cards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;

    const newCards = flipCard(cards, cardId);
    setCards(newCards);

    const nowFlipped = [...flipped, cardId];

    if (nowFlipped.length < 2) {
      setFlipped(nowFlipped);
      return;
    }

    // Two cards revealed — evaluate
    setFlipped([]);
    setMoves(m => m + 1);
    lockRef.current = true;
    setLocked(true);
    clearTimeout(mismatchTimerRef.current);

    const [idA, idB] = [nowFlipped[0], cardId];
    const cardA = newCards.find(c => c.id === idA);
    const cardB = newCards.find(c => c.id === idB);

    if (isMatch(cardA, cardB)) {
      const matched = markMatched(newCards, cardA.pairId);
      setCards(matched);
      const nextMatchCount = matchCount + 1;
      const nextCombo = combo + 1;
      const nextBestCombo = Math.max(bestCombo, nextCombo);
      const nextScore = score + 100 + (nextCombo - 1) * 20;

      setMatchCount(nextMatchCount);
      setCombo(nextCombo);
      setBestCombo(nextBestCombo);
      setScore(nextScore);
      lockRef.current = false;
      setLocked(false);
      if (isGameComplete(matched)) {
        window.setTimeout(() => endGame(nextScore, nextBestCombo), 240);
      }
    } else {
      setScore(current => Math.max(0, current - 15));
      setCombo(0);
      setMismatchIds([idA, idB]);
      mismatchTimerRef.current = window.setTimeout(() => {
        setCards(unflipUnmatched(newCards));
        setMismatchIds([]);
        lockRef.current = false;
        setLocked(false);
      }, 900);
    }
  }

  function resetToLobby() {
    clearTimeout(mismatchTimerRef.current);
    lockRef.current = false;
    stop();
    setCards([]);
    setFlipped([]);
    setMoves(0);
    setMatchCount(0);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setMismatchIds([]);
    setLocked(false);
    setPhase('lobby');
  }

  function restartGame() {
    resetToLobby();
    window.setTimeout(startGame, 0);
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="page active memory-page">
        <div className="page-header">
          <h2 className="page-title"><i className="fa fa-grid-2" /> Memory Game</h2>
          <p className="page-sub">Flip a product and its PLU code before the board fills up</p>
        </div>

        <div className="memory-lobby">
          <div className="memory-hero section-card">
            <div className="memory-hero-badge">Match mode</div>
            <div className="memory-hero-icon">🧠</div>
            <h3>Train recall with a fast board challenge</h3>
            <p>
              Build streaks, earn score, and clear the board by matching each Lidl product with its code.
            </p>
            <div className="memory-mini-stats">
              <div><strong>{pairs * 2}</strong><span>Cards</span></div>
              <div><strong>{Math.max(20, Math.round((pairs * 2) * 12))}</strong><span>XP base</span></div>
              <div><strong>{state.categories.length || 0}</strong><span>Categories</span></div>
            </div>
          </div>

          <div className="section-card memory-settings-card">
            <div className="memory-setting-block">
              <div className="memory-setting-title">Board size</div>
              <div className="diff-filter memory-chip-row">
                {MODE_OPTIONS.map(option => (
                  <button
                    key={option.id}
                    type="button"
                    className={`diff-filter-btn ${pairs === option.pairs ? `active-${option.id}` : ''}`}
                    onClick={() => setPairs(option.pairs)}
                  >
                    {option.label} · {option.cards} cards
                  </button>
                ))}
              </div>
            </div>

            <div className="memory-setting-block">
              <div className="memory-setting-title">Category filter</div>
              <div className="memory-category-grid">
                <button
                  type="button"
                  className={`memory-category-pill${category === CATEGORY_ALL ? ' active' : ''}`}
                  onClick={() => setCategory(CATEGORY_ALL)}
                >
                  All categories
                </button>
                {categoryOptions.slice(1).map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`memory-category-pill${category === cat.id ? ' active' : ''}`}
                    onClick={() => setCategory(cat.id)}
                  >
                    {cat.emoji} {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="memory-footer-note">
              <strong>{filteredProducts.length || state.products.length}</strong> products available for this board.
              The app will automatically use the best matching set if a category is small.
            </div>

            <button type="button" className="btn-primary btn-lg memory-start-btn" onClick={startGame} disabled={!state.products.length}>
              <i className="fa fa-play" /> Start Board
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (phase === 'done') {
    const xpEarned = Math.max(20, Math.round(score / 5) + playablePairs * 6 + bestCombo * 4);
    const mins     = Math.floor(seconds / 60);
    const secs     = seconds % 60;
    const timeStr  = `${mins}:${String(secs).padStart(2, '0')}`;
    return (
      <div className="page active" style={{ position: 'relative', overflow: 'hidden' }}>
        <Confetti />
        <div className="memory-results section-card">
          <div className="results-trophy">🏆</div>
          <h2 className="results-title">Board Cleared!</h2>
          <p className="results-sub">You matched every product and PLU pair.</p>
          <div className="results-stats">
            <div className="res-stat"><span>{moves}</span><small>Moves</small></div>
            <div className="res-stat"><span>{timeStr}</span><small>Time</small></div>
            <div className="res-stat"><span>{bestCombo}</span><small>Best streak</small></div>
            <div className="res-stat"><span>+{xpEarned}</span><small>XP</small></div>
          </div>
          <div className="results-actions">
            <button type="button" className="btn-primary" onClick={startGame}><i className="fa fa-redo" /> Play Again</button>
            <button type="button" className="btn-outline" onClick={resetToLobby}><i className="fa fa-home" /> Options</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Active ─────────────────────────────────────────────────────────────────
  const cols = gridCols(cards.length);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
  const remainingPairs = Math.max(0, playablePairs - matchCount);
  const progressPct = playablePairs > 0 ? Math.round((matchCount / playablePairs) * 100) : 0;
  const activeCategoryLabel = category === CATEGORY_ALL
    ? CATEGORY_ALL
    : state.categories.find(cat => cat.id === category)?.name || category;

  return (
    <div className="page active memory-page memory-page-active">
      <div className="memory-topbar">
        <div className="memory-hud memory-hud-left">
          <div className="memory-hud-pill memory-hud-pill--primary">
            <i className="fa fa-grid-2" /> {selectedMode.label}
          </div>
          <div className="memory-hud-pill">
            <i className="fa fa-folder-open" /> {activeCategoryLabel}
          </div>
        </div>

        <div className="memory-hud memory-hud-center">
          <div className="memory-hud-stat"><span>{timeStr}</span><small>Time</small></div>
          <div className="memory-hud-stat"><span>{score}</span><small>Score</small></div>
          <div className="memory-hud-stat"><span>{combo}</span><small>Streak</small></div>
          <div className="memory-hud-stat"><span>{moves}</span><small>Moves</small></div>
        </div>

        <div className="memory-hud memory-hud-right">
          <div className="memory-hud-stat"><span>{matchCount}/{playablePairs}</span><small>Matched</small></div>
          <div className="memory-hud-stat"><span>{remainingPairs}</span><small>Left</small></div>
        </div>
      </div>

      <div className="memory-progress-shell">
        <div className="memory-progress-track">
          <div className="memory-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>
        <div className="memory-progress-label">{progressPct}% complete</div>
      </div>

      <div
        className="memory-grid memory-board"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {cards.map(card => (
          <button
            key={card.id}
            type="button"
            className={[
              'memory-card',
              card.isFlipped || card.isMatched ? 'is-flipped' : '',
              card.isMatched ? 'is-matched' : '',
              mismatchIds.includes(card.id) ? 'is-mismatch' : '',
              locked && !card.isMatched && card.isFlipped ? 'is-locked' : '',
              card.type === 'product' ? 'memory-card--product' : 'memory-card--plu',
            ].filter(Boolean).join(' ')}
            onClick={() => handleCardClick(card.id)}
            aria-label={card.isFlipped || card.isMatched ? (card.type === 'product' ? card.product.name : `${card.product.plu}`) : 'Hidden card'}
            aria-pressed={card.isFlipped || card.isMatched}
          >
            <div className="memory-card-inner">
              <div className="memory-card-face memory-card-back">
                <span className="memory-card-back-kicker">Tap</span>
                <span className="memory-card-back-mark">?</span>
              </div>
              <div className="memory-card-face memory-card-front">
                {card.type === 'product' ? (
                  <>
                    <div className="mem-emoji">{card.product.emoji}</div>
                    <div className="mem-name">{card.product.name}</div>
                    <div className="mem-sub">Find the PLU code</div>
                    <div className="mem-tag">{card.product.category}</div>
                  </>
                ) : (
                  <>
                    <div className="mem-plu">{card.product.plu}</div>
                    <div className="mem-sub">PLU code</div>
                    <div className="mem-tag mem-tag--plu">Match the product</div>
                  </>
                )}
                {card.isMatched && <span className="memory-match-badge"><i className="fa fa-check" /></span>}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="memory-bottom-actions">
        <button className="btn-outline btn-sm" onClick={restartGame}>
          <i className="fa fa-redo" /> Restart
        </button>
        <button className="btn-outline btn-sm" onClick={resetToLobby}>
          <i className="fa fa-stop" /> Quit
        </button>
      </div>
    </div>
  );
}
