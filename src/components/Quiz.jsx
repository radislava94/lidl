import { useState, useEffect, useMemo } from 'react';
import { useApp }           from '../store/AppContext';
import { buildQuiz, QUIZ_MODES, checkAnswer } from '../utils/quiz';
import { calculateXP, calcQuizXP, getXPProgress } from '../utils/scoring';
import { useTimer }         from '../hooks/useTimer';

// ── Confetti burst ────────────────────────────────────────────────────────────
function Confetti() {
  const COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#FF8E53','#a855f7'];
  const pieces = Array.from({ length: 50 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.9,
    dur: 0.8 + Math.random() * 0.6,
    color: COLORS[i % COLORS.length],
  }));
  return (
    <div className="qz-confetti" aria-hidden="true">
      {pieces.map(p => (
        <div key={p.id} className="qz-confetti-piece" style={{
          left: p.left + '%',
          background: p.color,
          animationDelay: p.delay + 's',
          animationDuration: p.dur + 's',
        }} />
      ))}
    </div>
  );
}

// ── Mode definitions ──────────────────────────────────────────────────────────
const MODES = [
  {
    key: 'classic',
    icon: '🏆',
    label: 'Classic Mode',
    lines: ['10 Questions', 'No Time Limit'],
    xp: '+50 XP',
    color: '#0ea5e9',
    glow: 'rgba(14,165,233,.45)',
    grad: 'linear-gradient(135deg,#0ea5e9 0%,#0369a1 100%)',
  },
  {
    key: 'speed',
    icon: '⚡',
    label: 'Speed Mode',
    lines: ['20 Questions', '10 Seconds Each'],
    xp: '+100 XP',
    color: '#eab308',
    glow: 'rgba(234,179,8,.45)',
    grad: 'linear-gradient(135deg,#facc15 0%,#d97706 100%)',
  },
  {
    key: 'survival',
    icon: '❤️',
    label: 'Survival Mode',
    lines: ['3 Lives', 'Keep Going Until Failure'],
    xp: '+150 XP',
    color: '#ef4444',
    glow: 'rgba(239,68,68,.45)',
    grad: 'linear-gradient(135deg,#f87171 0%,#b91c1c 100%)',
  },
  {
    key: 'reverse',
    icon: '🔄',
    label: 'Reverse Mode',
    lines: ['PLU → Product Name', 'No Time Limit'],
    xp: '+75 XP',
    color: '#a855f7',
    glow: 'rgba(168,85,247,.45)',
    grad: 'linear-gradient(135deg,#c084fc 0%,#7e22ce 100%)',
  },
];

const DIFFICULTIES = [
  { key: 'all',    label: '⭐ All',    color: '#64748b' },
  { key: 'easy',   label: '🟢 Easy',   color: '#16a34a' },
  { key: 'medium', label: '🟡 Medium', color: '#d97706' },
  { key: 'hard',   label: '🔴 Hard',   color: '#dc2626' },
];

// ── Main component ────────────────────────────────────────────────────────────
export default function Quiz() {
  const { state, actions } = useApp();

  // ── lobby state ────────────────────────────────────────────────────────────
  const [mode,       setMode]       = useState('classic');
  const [difficulty, setDifficulty] = useState('all');
  const [selCats,    setSelCats]    = useState(new Set()); // empty = all

  // ── quiz state ─────────────────────────────────────────────────────────────
  const [phase,        setPhase]        = useState('lobby');   // lobby | active | results
  const [questions,    setQuestions]    = useState([]);
  const [currentIdx,   setCurrentIdx]   = useState(0);
  const [selected,     setSelected]     = useState(null);
  const [answered,     setAnswered]     = useState(false);
  const [score,        setScore]        = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lives,        setLives]        = useState(3);
  const [quizStreak,   setQuizStreak]   = useState(0);
  const [bestStreak,   setBestStreak]   = useState(0);
  const [shaking,      setShaking]      = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [floatingXP,   setFloatingXP]   = useState(null);

  // ── timer ──────────────────────────────────────────────────────────────────
  const modeConfig = QUIZ_MODES[mode.toUpperCase()] || QUIZ_MODES.CLASSIC;
  const timerActive = modeConfig.timer > 0;

  function handleTimerExpire() {
    if (answered) return;
    handleAnswer(null);
  }

  const { seconds, start: timerStart, stop: timerStop, reset: timerReset, percentage: timerPct } =
    useTimer(modeConfig.timer, handleTimerExpire);

  useEffect(() => () => timerStop(), [timerStop]);

  // ── derived ────────────────────────────────────────────────────────────────
  const currentQ      = questions[currentIdx] ?? null;
  const currentCat    = currentQ ? state.categories.find(c => c.id === currentQ.product.category) : null;
  const correctOption = currentQ?.correct;
  const rewardPreview = currentQ ? calculateXP({
    isCorrect: true,
    difficulty: currentQ.product.difficulty,
    mode,
    timeLeft: seconds,
    quizStreak: quizStreak + 1,
  }) : 0;
  const quizPrompt = currentQ?.type === 'reverse'
    ? 'What product name matches this PLU?'
    : 'What is the correct PLU number?';

  const categories = state.categories;
  const bestScore  = state.totalAnswered > 0
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100)
    : 0;

  // ── Estimated XP for start card ────────────────────────────────────────────
  const estimatedXP = useMemo(() => {
    const conf  = QUIZ_MODES[mode.toUpperCase()] || QUIZ_MODES.CLASSIC;
    const total = Math.min(conf.questions, 20);
    const corr  = Math.round(total * 0.8);
    const xpPerQ = difficulty === 'hard' ? 24 : difficulty === 'medium' ? 16 : 10;
    return calcQuizXP(corr, total, mode) + corr * xpPerQ;
  }, [mode, difficulty]);

  // ── category toggle ────────────────────────────────────────────────────────
  function toggleCat(id) {
    setSelCats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ── start quiz ─────────────────────────────────────────────────────────────
  function startQuiz() {
    let pool = state.products;
    if (selCats.size > 0) {
      pool = pool.filter(p => selCats.has(p.category));
    }
    if (!pool.length) return;
    const diff = difficulty === 'all' ? undefined : difficulty;
    const q    = buildQuiz(pool, mode, modeConfig.questions, diff);
    if (!q.length) return;

    setQuestions(q);
    setCurrentIdx(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setCorrectCount(0);
    setLives(3);
    setQuizStreak(0);
    setBestStreak(0);
    setShowConfetti(false);
    setPhase('active');
    if (timerActive) { timerReset(); timerStart(); }
  }

  // ── answer handling ────────────────────────────────────────────────────────
  function handleAnswer(optionText) {
    if (answered || !currentQ) return;
    timerStop();

    const correct    = optionText !== null && checkAnswer(currentQ, optionText);
    const newStreak  = correct ? quizStreak + 1 : 0;
    const newBest    = Math.max(bestStreak, newStreak);
    setSelected(optionText);
    setAnswered(true);
    setQuizStreak(newStreak);
    setBestStreak(newBest);

    const xp = calculateXP({
      isCorrect: correct,
      difficulty: currentQ.product.difficulty,
      mode,
      timeLeft: seconds,
      quizStreak: newStreak,
    });

    actions.recordAnswer(correct);

    if (correct) {
      const newCount = correctCount + 1;
      setCorrectCount(newCount);
      setScore(s => s + xp);
      actions.markMastered(currentQ.product.plu);
      actions.addXP(xp);
      actions.updateStreak();
      setFloatingXP({ amount: xp, id: Date.now() });
    } else {
      actions.recordMistake(currentQ.product.plu);
      if (mode === 'survival') {
        const newLives = lives - 1;
        setLives(newLives);
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
        if (newLives <= 0) {
          endQuiz(correctCount, score);
          return;
        }
      } else {
        setShaking(true);
        setTimeout(() => setShaking(false), 600);
      }
    }
  }

  function nextQuestion() {
    const isLast = currentIdx >= questions.length - 1;
    if (isLast) {
      endQuiz(correctCount, score);
    } else {
      setCurrentIdx(i => i + 1);
      setSelected(null);
      setAnswered(false);
      if (timerActive) { timerReset(); timerStart(); }
    }
  }

  function endQuiz(correct, finalScore) {
    timerStop();
    actions.incrementQuiz();
    const bonusXP = calcQuizXP(correct, questions.length, mode);
    if (bonusXP > 0) actions.addXP(bonusXP);
    setPhase('results');
    const pct = questions.length > 0 ? Math.round((correct / questions.length) * 100) : 0;
    if (pct >= 80) setShowConfetti(true);
  }

  // auto-advance after highlight delay
  useEffect(() => {
    if (!answered) return;
    const delay = timerActive ? 800 : 1200;
    const t = setTimeout(() => {
      const isLast = currentIdx >= questions.length - 1;
      if (isLast) endQuiz(correctCount, score);
      else nextQuestion();
    }, delay);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answered, currentIdx, questions.length, correctCount, score]);

  useEffect(() => {
    if (!floatingXP) return;
    const t = setTimeout(() => setFloatingXP(null), 1100);
    return () => clearTimeout(t);
  }, [floatingXP]);

  const modeInfo = MODES.find(m => m.key === mode) || MODES[0];

  // ══════════════════════════════════════════════════════════════════════════
  // LOBBY
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'lobby') {
    return (
      <div className="qz-lobby">

        {/* ── Hero card ── */}
        <div className="qz-hero-card">
          <div className="qz-hero-blur" />
          <div className="qz-hero-body">
            <div className="qz-hero-icon">🧠</div>
            <div className="qz-hero-text">
              <h1 className="qz-hero-title">PLU Challenge</h1>
              <p className="qz-hero-sub">Test your product knowledge and earn XP</p>
            </div>
            <div className="qz-hero-chips">
              <div className="qz-hchip">
                <span className="qz-hchip-icon">⭐</span>
                <div>
                  <div className="qz-hchip-val">+{estimatedXP} XP</div>
                  <div className="qz-hchip-lbl">Possible</div>
                </div>
              </div>
              <div className="qz-hchip">
                <span className="qz-hchip-icon">🔥</span>
                <div>
                  <div className="qz-hchip-val">{state.streak}</div>
                  <div className="qz-hchip-lbl">Day Streak</div>
                </div>
              </div>
              <div className="qz-hchip">
                <span className="qz-hchip-icon">🏆</span>
                <div>
                  <div className="qz-hchip-val">{bestScore}%</div>
                  <div className="qz-hchip-lbl">Best Score</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Game modes ── */}
        <div className="qz-section">
          <h2 className="qz-section-title">Choose Your Mode</h2>
          <div className="qz-mode-grid">
            {MODES.map(m => (
              <button
                key={m.key}
                type="button"
                className={`qz-mode-card${mode === m.key ? ' qz-mode-selected' : ''}`}
                style={{ '--mc': m.color, '--mg': m.grad, '--mglow': m.glow }}
                onClick={() => setMode(m.key)}
              >
                {mode === m.key && <div className="qz-mode-glow" />}
                <div className="qz-mode-icon">{m.icon}</div>
                <div className="qz-mode-label">{m.label}</div>
                <div className="qz-mode-lines">
                  {m.lines.map(l => <span key={l}>{l}</span>)}
                </div>
                <div className="qz-mode-xp">{m.xp}</div>
              </button>
            ))}
          </div>
        </div>

        {/* ── Config card ── */}
        <div className="qz-config-card">

          {/* Difficulty */}
          <div className="qz-config-section">
            <h3 className="qz-config-label">Difficulty</h3>
            <div className="qz-diff-row">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.key}
                  type="button"
                  className={`qz-diff-pill${difficulty === d.key ? ' qz-diff-active' : ''}`}
                  style={{ '--dc': d.color }}
                  onClick={() => setDifficulty(d.key)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Categories */}
          {categories.length > 0 && (
            <div className="qz-config-section">
              <h3 className="qz-config-label">
                Categories
                {selCats.size > 0 && (
                  <button
                    type="button"
                    className="qz-cat-clear"
                    onClick={() => setSelCats(new Set())}
                  >
                    × Clear
                  </button>
                )}
              </h3>
              <div className="qz-cat-row">
                <button
                  type="button"
                  className={`qz-cat-chip${selCats.size === 0 ? ' qz-cat-active' : ''}`}
                  onClick={() => setSelCats(new Set())}
                >
                  ⭐ Mixed
                </button>
                {categories.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`qz-cat-chip${selCats.has(cat.id) ? ' qz-cat-active' : ''}`}
                    onClick={() => toggleCat(cat.id)}
                  >
                    {cat.emoji} {cat.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Start summary */}
          <div className="qz-start-summary">
            <div className="qz-summary-chips">
              <span className="qz-summary-chip" style={{ background: modeInfo.grad }}>
                {modeInfo.icon} {modeInfo.label}
              </span>
              <span className="qz-summary-chip qz-summary-diff">
                {DIFFICULTIES.find(d => d.key === difficulty)?.label}
              </span>
              <span className="qz-summary-chip qz-summary-xp">
                ⭐ ~{estimatedXP} XP
              </span>
            </div>
            <button
              type="button"
              className="qz-start-btn"
              onClick={startQuiz}
              disabled={!state.products.length}
            >
              🚀 Start Quiz
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RESULTS
  // ══════════════════════════════════════════════════════════════════════════
  if (phase === 'results') {
    const total   = questions.length;
    const acc     = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const xpProg  = getXPProgress(state.xp);
    const trophy  = acc >= 90 ? '🏆' : acc >= 70 ? '🥈' : acc >= 50 ? '🎯' : '📚';
    const title   = acc >= 90 ? 'Outstanding!' : acc >= 70 ? 'Great job!' : acc >= 50 ? 'Keep going!' : 'Keep practicing!';

    return (
      <div className="qz-results-wrap">
        {showConfetti && <Confetti />}
        <div className="qz-results-card">
          <div className="qz-results-trophy">{trophy}</div>
          <h2 className="qz-results-title">Quiz Complete</h2>
          <p className="qz-results-sub">{title}</p>

          <div className="qz-results-stats">
            <div className="qz-rstat">
              <span className="qz-rstat-val qz-rstat-green">{correctCount}</span>
              <span className="qz-rstat-lbl">Correct</span>
            </div>
            <div className="qz-rstat">
              <span className="qz-rstat-val qz-rstat-red">{total - correctCount}</span>
              <span className="qz-rstat-lbl">Wrong</span>
            </div>
            <div className="qz-rstat">
              <span className="qz-rstat-val">{acc}%</span>
              <span className="qz-rstat-lbl">Accuracy</span>
            </div>
            <div className="qz-rstat">
              <span className="qz-rstat-val qz-rstat-gold">{score}</span>
              <span className="qz-rstat-lbl">XP Earned</span>
            </div>
            <div className="qz-rstat">
              <span className="qz-rstat-val">🔥 {bestStreak}</span>
              <span className="qz-rstat-lbl">Best Streak</span>
            </div>
          </div>

          {/* Level progress */}
          <div className="qz-level-row">
            <span className="qz-level-lbl">Level {xpProg.level}</span>
            <div className="qz-level-track">
              <div className="qz-level-fill" style={{ width: xpProg.percentage + '%' }} />
            </div>
            <span className="qz-level-lbl">{xpProg.progress} / {xpProg.max} XP</span>
          </div>

          <div className="qz-results-actions">
            <button type="button" className="qz-start-btn" onClick={startQuiz}>
              🔄 Play Again
            </button>
            <button
              type="button"
              className="qz-outline-btn"
              onClick={() => { setPhase('lobby'); setShowConfetti(false); }}
            >
              ⚙️ Change Mode
            </button>
            <button
              type="button"
              className="qz-outline-btn"
              onClick={() => { actions.setPage('dashboard'); setShowConfetti(false); }}
            >
              🏠 Return Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ACTIVE QUIZ
  // ══════════════════════════════════════════════════════════════════════════
  if (!currentQ) {
    return (
      <div className="qz-lobby">
        <div className="qz-config-card" style={{ textAlign: 'center', padding: '40px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>😕</div>
          <h3 style={{ margin: '0 0 8px', color: '#1e293b', fontSize: '1.2rem' }}>No questions available</h3>
          <p style={{ margin: '0 0 24px', color: '#64748b' }}>
            Try selecting a broader difficulty or more categories.
          </p>
          <button type="button" className="qz-start-btn" onClick={() => setPhase('lobby')}>
            ← Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  const isAnsweredCorrect = answered && selected !== null && checkAnswer(currentQ, selected);
  const isAnsweredWrong   = answered && !isAnsweredCorrect;

  return (
    <div className="qz-active">
      {floatingXP && (
        <div className="qz-xp-float" key={floatingXP.id}>+{floatingXP.amount} XP</div>
      )}

      {/* ── HUD bar ── */}
      <div className="qz-hud">
        <div className="qz-hud-left">
          <span className="qz-hud-qnum">
            Question {currentIdx + 1} / {questions.length}
          </span>
          <div className="qz-hud-bar">
            <div
              className="qz-hud-bar-fill"
              style={{ width: ((currentIdx + 1) / questions.length * 100) + '%' }}
            />
          </div>
        </div>
        <div className="qz-hud-right">
          {mode === 'survival' && (
            <span className="qz-hud-lives">
              {Array.from({ length: 3 }).map((_, i) => (
                <span key={i} style={{ opacity: i < lives ? 1 : 0.25 }}>❤️</span>
              ))}
            </span>
          )}
          <span className="qz-hud-streak">🔥 {quizStreak}</span>
          {timerActive && (
            <span className={`qz-hud-timer${seconds <= 4 ? ' qz-timer-danger' : ''}`}>
              <span className="qz-timer-ring">
                <svg viewBox="0 0 32 32" width="32" height="32">
                  <circle cx="16" cy="16" r="13" fill="none" stroke="rgba(255,255,255,.2)" strokeWidth="3"/>
                  <circle
                    cx="16" cy="16" r="13" fill="none"
                    stroke={seconds <= 4 ? '#f87171' : '#FFD700'}
                    strokeWidth="3"
                    strokeDasharray="81.7"
                    strokeDashoffset={81.7 * (1 - (timerPct / 100))}
                    strokeLinecap="round"
                    transform="rotate(-90 16 16)"
                  />
                </svg>
                <span className="qz-timer-num">{seconds}</span>
              </span>
            </span>
          )}
        </div>
      </div>

      {/* ── Question card ── */}
      <div className={`qz-q-card${shaking ? ' qz-shake' : ''}`}>

        {/* Card header */}
        <div className="qz-q-header">
          <span className="qz-cat-tag">
            {currentCat?.emoji || '📦'} {currentCat?.name || 'Other'}
          </span>
          <span className="qz-xp-tag">+{rewardPreview} XP</span>
        </div>

        {/* Product display */}
        <div className="qz-product-hero">
          <div className="qz-product-emoji" key={currentQ.id}>
            {currentQ.product.emoji || '📦'}
          </div>
          <h2 className="qz-product-name">{currentQ.product.name}</h2>
          <div className="qz-product-meta">
            <span className={`qz-diff-badge qz-diff-${currentQ.product.difficulty}`}>
              {currentQ.product.difficulty}
            </span>
          </div>
        </div>

        {/* Question */}
        <div className="qz-question-block">
          <p className="qz-question-text">{quizPrompt}</p>
        </div>

        {/* Answer buttons */}
        <div className="qz-answers">
          {currentQ.options.map(opt => {
            let cls = 'qz-answer-btn';
            if (answered) {
              if (opt === correctOption)                    cls += ' qz-ans-correct';
              else if (opt === selected && !isAnsweredCorrect) cls += ' qz-ans-wrong';
              else                                          cls += ' qz-ans-faded';
            }
            const isCorrectOpt = opt === correctOption;
            const prefix = currentQ.type === 'reverse' ? '' : 'PLU ';
            return (
              <button
                key={opt}
                type="button"
                className={cls}
                onClick={() => handleAnswer(opt)}
                disabled={answered}
              >
                {answered && isCorrectOpt && <span className="qz-ans-icon">✅</span>}
                {answered && opt === selected && !isAnsweredCorrect && <span className="qz-ans-icon">❌</span>}
                <span className="qz-ans-text">{prefix}{opt}</span>
              </button>
            );
          })}
        </div>

        {/* Inline feedback */}
        {answered && (
          <div className={`qz-feedback${isAnsweredCorrect ? ' qz-feedback-correct' : ' qz-feedback-wrong'}`}>
            {isAnsweredCorrect ? (
              <>✅ Correct! <strong>+{floatingXP?.amount ?? rewardPreview} XP</strong></>
            ) : (
              <>❌ Incorrect — correct answer: <strong>{correctOption}</strong></>
            )}
          </div>
        )}
      </div>

      {/* ── Score HUD bottom ── */}
      <div className="qz-score-bar">
        <div className="qz-score-item">
          <span className="qz-score-lbl">Score</span>
          <span className="qz-score-val">{score}</span>
        </div>
        <div className="qz-score-item">
          <span className="qz-score-lbl">Correct</span>
          <span className="qz-score-val qz-score-green">{correctCount}</span>
        </div>
        <div className="qz-score-item">
          <span className="qz-score-lbl">Streak</span>
          <span className="qz-score-val">🔥 {quizStreak}</span>
        </div>
        <div className="qz-score-item">
          <span className="qz-score-lbl">Left</span>
          <span className="qz-score-val">{Math.max(questions.length - currentIdx - 1, 0)}</span>
        </div>
      </div>
    </div>
  );
}
