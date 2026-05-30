import { useState, useEffect } from 'react';
import { useApp }           from '../store/AppContext';
import { buildQuiz, QUIZ_MODES, checkAnswer } from '../utils/quiz';
import { calculateXP, calcQuizXP, getXPProgress } from '../utils/scoring';
import { useTimer }         from '../hooks/useTimer';

// ── tiny confetti burst ─────────────────────────────────────────────────────
function Confetti() {
  const COLORS = ['#FFD700','#FF6B6B','#4ECDC4','#45B7D1','#FF8E53'];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    color: COLORS[i % COLORS.length],
  }));
  return (
    <div className="confetti-wrap" aria-hidden="true">
      {pieces.map(p => (
        <div key={p.id} className="confetti-piece" style={{
          left: p.left + '%', background: p.color, animationDelay: p.delay + 's',
        }} />
      ))}
    </div>
  );
}

// ── Mode cards ───────────────────────────────────────────────────────────────
const MODE_INFO = [
  { key: 'classic',  icon: '🏆', label: 'Classic',  desc: '10 questions, no timer',         color: '#4ECDC4' },
  { key: 'speed',    icon: '⚡', label: 'Speed',    desc: '20 questions, 10s per question', color: '#FFD700' },
  { key: 'survival', icon: '❤️', label: 'Survival', desc: '3 lives, 15s each',              color: '#FF6B6B' },
  { key: 'reverse',  icon: '🔄', label: 'Reverse',  desc: 'PLU → Product name',             color: '#845EF7' },
];

const DIFF_KEYS = ['all', 'easy', 'medium', 'hard'];

export default function Quiz() {
  const { state, actions } = useApp();

  // ── local state ──────────────────────────────────────────────────────────
  const [phase, setPhase]             = useState('lobby');   // lobby | active | results
  const [mode, setMode]               = useState('classic');
  const [difficulty, setDifficulty]   = useState('all');
  const [questions, setQuestions]     = useState([]);
  const [currentIdx, setCurrentIdx]   = useState(0);
  const [selected, setSelected]       = useState(null);      // option text
  const [answered, setAnswered]       = useState(false);
  const [score, setScore]             = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lives, setLives]             = useState(3);
  const [quizStreak, setQuizStreak]   = useState(0);
  const [shakeKey, setShakeKey]       = useState(0);
  const [showConfetti, setShowConfetti] = useState(false);
  const [floatingXP, setFloatingXP]    = useState(null);
  const [showStreakBurst, setShowStreakBurst] = useState(false);

  // ── timer ─────────────────────────────────────────────────────────────────
  const modeConfig = QUIZ_MODES[mode.toUpperCase()] || QUIZ_MODES.CLASSIC;
  const timerActive = modeConfig.timer > 0;

  function handleTimerExpire() {
    if (answered) return;
    handleAnswer(null); // treat expire as wrong
  }

  const { seconds, start: timerStart, stop: timerStop, reset: timerReset, percentage: timerPct } =
    useTimer(modeConfig.timer, handleTimerExpire);

  useEffect(() => () => timerStop(), [timerStop]);

  // ─── helpers ─────────────────────────────────────────────────────────────
  const currentQ = questions[currentIdx] ?? null;
  const currentCategory = currentQ ? state.categories.find(c => c.id === currentQ.product.category) : null;
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
  const remainingQuestions = Math.max(questions.length - currentIdx - 1, 0);

  function startQuiz() {
    const pool = state.products;
    if (!pool.length) return;
    const diff = difficulty === 'all' ? undefined : difficulty;
    const q = buildQuiz(pool, mode, modeConfig.count, diff);
    if (q.length === 0) {
      setPhase('lobby');
      return;
    }
    setQuestions(q);
    setCurrentIdx(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setCorrectCount(0);
    setLives(3);
    setQuizStreak(0);
    setShowConfetti(false);
    setPhase('active');
    if (timerActive) { timerReset(); timerStart(); }
  }

  function handleAnswer(optionText) {
    if (answered || !currentQ) return;
    timerStop();

    const correct = optionText !== null && checkAnswer(currentQ, optionText);
    setSelected(optionText);
    setAnswered(true);

    const newStreak = correct ? quizStreak + 1 : 0;
    setQuizStreak(newStreak);

    const xp = calculateXP({
      isCorrect: correct,
      difficulty: currentQ.product.difficulty,
      mode,
      timeLeft: seconds,
      quizStreak: newStreak,
    });

    actions.recordAnswer(correct);

    if (correct) {
      setCorrectCount(c => c + 1);
      setScore(s => s + xp);
      actions.markMastered(currentQ.product.plu);
      actions.addXP(xp);
      actions.updateStreak();
      setFloatingXP({ amount: xp, id: Date.now() });
      if (newStreak > 0 && newStreak % 3 === 0) {
        setShowStreakBurst(true);
      }
    } else {
      actions.recordMistake(currentQ.product.plu);
      if (mode === 'survival') {
        const newLives = lives - 1;
        setLives(newLives);
        if (newLives <= 0) {
          endQuiz(correctCount, score);
          return;
        }
      }
      setShakeKey(k => k + 1);
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

  // auto-advance after answer highlight
  useEffect(() => {
    if (!answered) return;
    const delay = modeConfig.timer > 0 ? 800 : 1200;
    const t = setTimeout(() => {
      const isLast = currentIdx >= questions.length - 1;
      if (isLast) {
        endQuiz(correctCount, score);
      } else {
        nextQuestion();
      }
    }, delay);
    return () => clearTimeout(t);
  }, [answered, currentIdx, questions.length, correctCount, score, modeConfig.timer]);

  useEffect(() => {
    if (!floatingXP) return;
    const t = setTimeout(() => setFloatingXP(null), 1000);
    return () => clearTimeout(t);
  }, [floatingXP]);

  useEffect(() => {
    if (!showStreakBurst) return;
    const t = setTimeout(() => setShowStreakBurst(false), 1200);
    return () => clearTimeout(t);
  }, [showStreakBurst]);

  // ══ LOBBY ═════════════════════════════════════════════════════════════════
  if (phase === 'lobby') {
    return (
      <div className="page active">
        <div className="page-header">
          <h2 className="page-title"><i className="fa fa-brain" /> Quiz</h2>
          <p className="page-sub">Test your PLU knowledge</p>
        </div>
        <div className="quiz-lobby">
          <h3>Choose Mode</h3>
          <div className="quiz-mode-grid">
            {MODE_INFO.map(m => (
              <button
                key={m.key}
                type="button"
                className={`mode-card${mode === m.key ? ' selected' : ''}`}
                style={{ '--mode-color': m.color }}
                onClick={() => setMode(m.key)}
              >
                <div className="mode-icon">{m.icon}</div>
                <div className="mode-label">{m.label}</div>
                <div className="mode-desc">{m.desc}</div>
              </button>
            ))}
          </div>
          <h3 style={{ marginTop: 24 }}>Difficulty</h3>
          <div className="diff-filter">
            {DIFF_KEYS.map(d => (
              <button key={d} type="button" className={`diff-btn${difficulty === d ? ' active' : ''}`} onClick={() => setDifficulty(d)}>
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <button type="button" className="btn-primary btn-lg" style={{ marginTop: 28, minWidth: 220 }} onClick={startQuiz}>
            <i className="fa fa-play" /> Start Quiz
          </button>
        </div>
      </div>
    );
  }

  // ══ RESULTS ═══════════════════════════════════════════════════════════════
  if (phase === 'results') {
    const total = questions.length;
    const acc   = total > 0 ? Math.round((correctCount / total) * 100) : 0;
    const xpProgress = getXPProgress(state.xp);
    return (
      <div className="page active" style={{ position: 'relative', overflow: 'hidden' }}>
        {showConfetti && <Confetti />}
        <div className="quiz-results">
          <div className="results-trophy">{acc >= 90 ? '🏆' : acc >= 70 ? '🥈' : '🎯'}</div>
          <h2 className="results-title">{acc >= 80 ? 'Great job!' : acc >= 50 ? 'Keep going!' : 'Keep practicing!'}</h2>
          <div className="results-stats">
            <div className="res-stat"><span>{correctCount}</span><small>Correct</small></div>
            <div className="res-stat"><span>{total - correctCount}</span><small>Wrong</small></div>
            <div className="res-stat"><span>{acc}%</span><small>Accuracy</small></div>
            <div className="res-stat"><span>{score}</span><small>XP Earned</small></div>
          </div>
          <div className="level-progress-row">
            <span>Level {xpProgress.level}</span>
            <div className="progress-bar-track" style={{ flex: 1, margin: '0 8px' }}>
              <div className="progress-bar-fill" style={{ width: xpProgress.percentage + '%' }} />
            </div>
            <span>{xpProgress.progress}/{xpProgress.max}</span>
          </div>
          <div className="results-actions">
            <button type="button" className="btn-primary" onClick={startQuiz}><i className="fa fa-redo" /> Play Again</button>
            <button type="button" className="btn-outline" onClick={() => { setPhase('lobby'); setShowConfetti(false); }}>
              <i className="fa fa-list" /> Lobby
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ══ ACTIVE ════════════════════════════════════════════════════════════════
  if (!currentQ) {
    return (
      <div className="page active">
        <div className="quiz-lobby">
          <h3>No quiz questions available</h3>
          <p>Try a broader difficulty or wait for products to finish loading.</p>
          <button type="button" className="btn-primary btn-lg" onClick={() => setPhase('lobby')}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }
  const correctOption = currentQ.correct;
  const cardWrong = answered && !checkAnswer(currentQ, selected);

  return (
    <div className="page active quiz-page">
      {showStreakBurst && <Confetti />}
      {floatingXP && (
        <div className="quiz-xp-float" key={floatingXP.id}>
          +{floatingXP.amount} XP
        </div>
      )}

      <div className="quiz-stage-wrap">
        <div className={`quiz-card-modern${cardWrong ? ' quiz-card-shake' : ''}`}>
          <div className="quiz-card-top">
            <div className="quiz-top-left">
              <span className="quiz-category-chip">
                <span>{currentCategory?.emoji || '📦'}</span>
                <span>{currentCategory?.name || 'Other'}</span>
              </span>
              <span className="quiz-question-index">Question {currentIdx + 1} of {questions.length}</span>
            </div>

            <div className="quiz-top-right">
              <span className="quiz-xp-pill-modern">+{rewardPreview} XP</span>
              <span className={`quiz-timer-pill${timerActive && seconds <= 5 ? ' danger' : ''}`}>
                <i className="fa fa-clock" />
                {timerActive ? `${seconds}s` : 'No timer'}
              </span>
              <span className="quiz-sfx-pill">
                <i className="fa fa-volume-up" />
                SFX ready
              </span>
            </div>
          </div>

          <div className="quiz-progress-track-modern">
            <div
              className="quiz-progress-fill-modern"
              style={{ width: ((currentIdx + 1) / questions.length * 100) + '%' }}
            />
          </div>

          <div className="quiz-product-hero">
            <div className="quiz-product-emoji-wrap" key={currentQ.id}>
              <span className="quiz-product-emoji-large">{currentQ.product.emoji}</span>
            </div>
            <h3 className="quiz-product-name-large">{currentQ.product.name}</h3>
            <div className="quiz-product-subline">
              {currentCategory?.name || 'Other'} · {currentQ.product.difficulty}
            </div>
          </div>

          <div className="quiz-question-block">
            <span className="quiz-question-kicker">PLU QUESTION</span>
            <h4 className="quiz-question-text-modern">{quizPrompt}</h4>
          </div>

          <div className="quiz-options-modern">
            {currentQ.options.map(opt => {
              let cls = 'quiz-answer-btn';
              if (answered) {
                if (opt === correctOption) cls += ' correct';
                else if (opt === selected) cls += ' wrong';
                else cls += ' faded';
              }
              return (
                <button key={opt} type="button" className={cls} onClick={() => handleAnswer(opt)} disabled={answered}>
                  <span className="quiz-answer-prefix">PLU</span>
                  <span className="quiz-answer-value">{opt}</span>
                </button>
              );
            })}
          </div>

          <div className="quiz-footer-hud">
            <div className="quiz-hud-stat">
              <span className="quiz-hud-label">Score</span>
              <span className="quiz-hud-value">{score}</span>
            </div>

            <div className="quiz-hud-stat">
              <span className="quiz-hud-label">Lives</span>
              <span className="quiz-hud-hearts">
                {Array.from({ length: 3 }).map((_, i) => (
                  <span key={i} className={i < lives ? 'quiz-heart alive' : 'quiz-heart dead'}>❤️</span>
                ))}
              </span>
            </div>

            <div className="quiz-hud-stat">
              <span className="quiz-hud-label">Remaining</span>
              <span className="quiz-hud-value">{remainingQuestions}</span>
            </div>

            <div className="quiz-hud-stat quiz-streak-stat">
              <span className="quiz-hud-label">Streak</span>
              <span className="quiz-streak-value">🔥 {quizStreak}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
