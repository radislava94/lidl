import { useState, useRef, useEffect } from 'react';
import { useApp }  from '../store/AppContext';
import { shuffle } from '../utils/helpers';

const MODES = [
  { id: 'practice',  icon: '🎯', label: 'Practice',  desc: 'No timer – go at your own pace',     duration: 0,  count: 15  },
  { id: 'speed',     icon: '⚡', label: 'Speed',     desc: '60 seconds, as many as you can',     duration: 60, count: 999 },
  { id: 'endurance', icon: '💪', label: 'Endurance', desc: '25 products, race the clock',        duration: 0,  count: 25  },
  { id: 'expert',    icon: '🏆', label: 'Expert',    desc: '30 products, 45 second limit',       duration: 45, count: 30  },
];

// ── Small results wrapper that runs addXP exactly once ──────────────────────
function CashierResults({ acc, correct, wrong, avgSec, elapsed, xpEarned, onRetry, onLobby }) {
  const { actions } = useApp();
  const ran = useRef(false);
  useEffect(() => {
    if (!ran.current) { ran.current = true; actions.addXP(xpEarned); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const mins = Math.floor(elapsed / 60);
  const secs = String(elapsed % 60).padStart(2, '0');

  return (
    <div className="page active">
      <div className="page-header">
        <h2 className="page-title"><i className="fa fa-cash-register" /> Session Results</h2>
      </div>
      <div className="section-card cashier-results">
        <div className="results-trophy">{acc >= 90 ? '🏆' : acc >= 70 ? '🥈' : '🎯'}</div>
        <h2 className="results-title">
          {acc >= 90 ? 'Till Master!' : acc >= 70 ? 'Great Session!' : 'Keep Practising!'}
        </h2>
        <div className="results-stats">
          <div className="res-stat"><span>{acc}%</span><small>Accuracy</small></div>
          <div className="res-stat"><span>{correct}</span><small>Correct</small></div>
          <div className="res-stat"><span>{wrong}</span><small>Wrong</small></div>
          <div className="res-stat"><span>{avgSec}s</span><small>Avg Time</small></div>
          <div className="res-stat"><span>{mins}:{secs}</span><small>Session</small></div>
        </div>
        <div className="cashier-xp-earned">+{xpEarned} XP earned</div>
        <div className="results-actions">
          <button type="button" className="btn-primary" onClick={onRetry}>
            <i className="fa fa-redo" /> Try Again
          </button>
          <button type="button" className="btn-outline" onClick={onLobby}>
            <i className="fa fa-home" /> Change Settings
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CashierSimulator() {
  const { state, actions } = useApp();

  const [phase, setPhase]       = useState('lobby');
  const [mode, setMode]         = useState('practice');
  const [category, setCategory] = useState('all');
  const [products, setProducts] = useState([]);
  const [idx, setIdx]           = useState(0);
  const [input, setInput]       = useState('');
  const [feedback, setFeedback] = useState(null); // 'correct' | 'wrong' | null
  const [correct, setCorrect]   = useState(0);
  const [wrong, setWrong]       = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [elapsed, setElapsed]   = useState(0);
  const [times, setTimes]       = useState([]);
  const [qStart, setQStart]     = useState(null);

  const inputRef       = useRef(null);
  const countdownRef   = useRef(null);
  const elapsedRef     = useRef(null);
  const feedbackTimRef = useRef(null);
  const endCalledRef   = useRef(false);

  const modeConfig = MODES.find(m => m.id === mode) || MODES[0];
  const pool       = category === 'all'
    ? state.products
    : state.products.filter(p => p.category === category);

  // Focus input when active / after feedback clears
  useEffect(() => {
    if (phase === 'active') inputRef.current?.focus();
  }, [phase, idx, feedback]);

  // Clean up timers on unmount
  useEffect(() => () => {
    clearInterval(countdownRef.current);
    clearInterval(elapsedRef.current);
    clearTimeout(feedbackTimRef.current);
  }, []);

  function startSim() {
    if (!pool.length) return;
    endCalledRef.current = false;
    const shuffled = shuffle([...pool]);
    const limited  = modeConfig.count < 999 ? shuffled.slice(0, modeConfig.count) : shuffled;
    setProducts(limited);
    setIdx(0);
    setInput('');
    setFeedback(null);
    setCorrect(0);
    setWrong(0);
    setElapsed(0);
    setTimes([]);
    setQStart(Date.now());

    clearInterval(countdownRef.current);
    clearInterval(elapsedRef.current);

    if (modeConfig.duration > 0) {
      setTimeLeft(modeConfig.duration);
      countdownRef.current = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) {
            clearInterval(countdownRef.current);
            if (!endCalledRef.current) { endCalledRef.current = true; setPhase('results'); }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }

    elapsedRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    setPhase('active');
  }

  function doEnd() {
    if (endCalledRef.current) return;
    endCalledRef.current = true;
    clearInterval(countdownRef.current);
    clearInterval(elapsedRef.current);
    clearTimeout(feedbackTimRef.current);
    setPhase('results');
  }

  function submitAnswer() {
    if (feedback || !products[idx]) return;
    const product   = products[idx];
    const isCorrect = input.trim() === String(product.plu);

    setFeedback(isCorrect ? 'correct' : 'wrong');

    const responseTime = Date.now() - (qStart || Date.now());
    if (isCorrect) {
      setCorrect(c => c + 1);
      setTimes(t => [...t, responseTime]);
      actions.recordAnswer(true);
    } else {
      setWrong(w => w + 1);
      actions.recordMistake(product.plu);
      actions.recordAnswer(false);
    }
    setInput('');

    feedbackTimRef.current = setTimeout(() => {
      setFeedback(null);
      setIdx(i => {
        const next = i + 1;
        if (next >= products.length) { doEnd(); return i; }
        setQStart(Date.now());
        return next;
      });
    }, isCorrect ? 380 : 800);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
  }

  // ── Results ───────────────────────────────────────────────────────────────
  if (phase === 'results') {
    const total    = correct + wrong;
    const acc      = total > 0 ? Math.round((correct / total) * 100) : 0;
    const avgMs    = times.length > 0 ? Math.round(times.reduce((s, t) => s + t, 0) / times.length) : 0;
    const avgSec   = (avgMs / 1000).toFixed(1);
    const xpEarned = Math.max(10, correct * 10 + (acc >= 90 ? 25 : 0));
    return (
      <CashierResults
        acc={acc} correct={correct} wrong={wrong}
        avgSec={avgSec} elapsed={elapsed} xpEarned={xpEarned}
        onRetry={startSim} onLobby={() => setPhase('lobby')}
      />
    );
  }

  // ── Lobby ─────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="page active">
        <div className="page-header">
          <h2 className="page-title"><i className="fa fa-cash-register" /> Cashier Simulator</h2>
          <p className="page-sub">Type each PLU code as fast as possible – just like a real checkout till</p>
        </div>

        <div className="cashier-lobby">
          <div className="section-card cashier-hero-card">
            <div className="cashier-hero-icon">🏪</div>
            <div className="cashier-hero-text">
              <h3>Real Till Training</h3>
              <p>A product appears on screen. Type its PLU number and press Enter to go to the next one. Compete against yourself to improve speed and accuracy.</p>
            </div>
            <div className="cashier-hero-stats">
              <div className="cashier-hero-stat"><strong>{state.products.length}</strong><span>Products</span></div>
              <div className="cashier-hero-stat"><strong>{state.categories.length}</strong><span>Categories</span></div>
              <div className="cashier-hero-stat"><strong>{MODES.length}</strong><span>Modes</span></div>
            </div>
          </div>

          <div className="section-card">
            <h3 className="cashier-section-title">Choose Mode</h3>
            <div className="cashier-mode-grid">
              {MODES.map(m => (
                <button
                  key={m.id}
                  type="button"
                  className={`cashier-mode-btn${mode === m.id ? ' active' : ''}`}
                  onClick={() => setMode(m.id)}
                >
                  <span className="cashier-mode-icon">{m.icon}</span>
                  <span className="cashier-mode-label">{m.label}</span>
                  <span className="cashier-mode-desc">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="section-card">
            <h3 className="cashier-section-title">Category</h3>
            <div className="memory-category-grid">
              <button
                type="button"
                className={`memory-category-pill${category === 'all' ? ' active' : ''}`}
                onClick={() => setCategory('all')}
              >
                🗂️ All categories
              </button>
              {state.categories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className={`memory-category-pill${category === cat.id ? ' active' : ''}`}
                  onClick={() => setCategory(cat.id)}
                >
                  {cat.emoji} {cat.name}
                </button>
              ))}
            </div>
            <p className="cashier-pool-note">
              <i className="fa fa-info-circle" /> {pool.length} products available
            </p>
          </div>

          <button
            type="button"
            className="btn-primary btn-lg cashier-start-btn"
            onClick={startSim}
            disabled={!pool.length}
          >
            <i className="fa fa-play" /> Start Training
          </button>
        </div>
      </div>
    );
  }

  // ── Active ────────────────────────────────────────────────────────────────
  const product  = products[idx];
  const cat      = product ? state.categories.find(c => c.id === product.category) : null;
  const progress = products.length > 0 ? Math.round((idx / products.length) * 100) : 0;

  return (
    <div className="page active">
      {/* HUD */}
      <div className="cashier-hud">
        <div className="cashier-hud-item cashier-correct-stat">
          <i className="fa fa-check" />
          <span>{correct}</span>
          <small>Correct</small>
        </div>
        <div className="cashier-hud-item cashier-wrong-stat">
          <i className="fa fa-times" />
          <span>{wrong}</span>
          <small>Wrong</small>
        </div>
        <div className="cashier-hud-item">
          <i className="fa fa-list-ol" />
          <span>{Math.min(idx + 1, products.length)}/{products.length}</span>
          <small>Progress</small>
        </div>
        {modeConfig.duration > 0 ? (
          <div className={`cashier-hud-item${timeLeft <= 10 ? ' cashier-urgent' : ''}`}>
            <i className="fa fa-clock" />
            <span>{timeLeft}s</span>
            <small>Time Left</small>
          </div>
        ) : (
          <div className="cashier-hud-item">
            <i className="fa fa-stopwatch" />
            <span>{elapsed}s</span>
            <small>Elapsed</small>
          </div>
        )}
        <button type="button" className="btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={doEnd}>
          <i className="fa fa-stop" /> End
        </button>
      </div>

      {/* Progress bar */}
      <div className="progress-bar-track" style={{ marginBottom: 20 }}>
        <div className="progress-bar-fill blue-fill" style={{ width: progress + '%' }} />
      </div>

      {/* Product card */}
      <div className={`cashier-product-card${
        feedback === 'correct' ? ' cashier-fb-correct' :
        feedback === 'wrong'   ? ' cashier-fb-wrong'   : ''
      }`}>
        <div className="cashier-cat-badge">
          {cat?.emoji || '📦'} {cat?.name || product?.category || ''}
        </div>
        <div className="cashier-emoji">{product?.emoji || '📦'}</div>
        <h2 className="cashier-name">{product?.name}</h2>
        {product?.nameEn && product.nameEn !== product.name && (
          <p className="cashier-name-en">{product.nameEn}</p>
        )}
        {feedback && (
          <div className={`cashier-feedback${feedback === 'correct' ? ' cashier-fb-ok' : ' cashier-fb-err'}`}>
            {feedback === 'correct'
              ? <><i className="fa fa-check-circle" /> Correct!</>
              : <><i className="fa fa-times-circle" /> Wrong – PLU was <strong>{product?.plu}</strong></>
            }
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="cashier-input-wrap">
        <label className="cashier-input-label">Enter PLU Code</label>
        <div className="cashier-input-row">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            className="cashier-input"
            placeholder="PLU…"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={!!feedback}
            autoComplete="off"
          />
          <button
            type="button"
            className="btn-primary cashier-submit-btn"
            onClick={submitAnswer}
            disabled={!!feedback || !input.trim()}
            aria-label="Submit answer"
          >
            <i className="fa fa-arrow-right" />
          </button>
        </div>
        <p className="cashier-hint">Press <kbd>Enter</kbd> or click the arrow to submit</p>
      </div>
    </div>
  );
}
