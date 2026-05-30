import { useState, useEffect, useRef } from 'react';
import { useApp }         from '../store/AppContext';
import { buildQuiz, buildFlashcards, checkAnswer } from '../utils/quiz';
import { buildMemoryPairs, isMatch, flipCard, markMatched, unflipUnmatched, isGameComplete } from '../utils/memory';
import { pct, todayString } from '../utils/helpers';

const DAILY_QUIZ_COUNT   = 10;
const DAILY_CARD_COUNT   = 5;
const DAILY_MEMORY_PAIRS = 4;
const REWARD_XP          = 50;

const STAGES = [
  { key: 'quiz',    icon: '🧠', label: 'Stage 1', name: 'Quiz',        desc: `${DAILY_QUIZ_COUNT} questions`           },
  { key: 'cards',   icon: '🃏', label: 'Stage 2', name: 'Flashcards',  desc: `${DAILY_CARD_COUNT} cards`               },
  { key: 'memory',  icon: '🧩', label: 'Stage 3', name: 'Memory Game', desc: `Match ${DAILY_MEMORY_PAIRS} pairs`       },
];

export default function DailyChallenge() {
  const { state, actions } = useApp();
  const alreadyDone = state.dailyChallengeDate === todayString();

  const [phase, setPhase] = useState('lobby');

  // ── Quiz sub-state ─────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState([]);
  const [qIdx, setQIdx]           = useState(0);
  const [qSelected, setQSelected] = useState(null);
  const [qAnswered, setQAnswered] = useState(false);
  const [qCorrect, setQCorrect]   = useState(0);

  // ── Flashcard sub-state ────────────────────────────────────────────────────
  const [cards, setCards]         = useState([]);
  const [cardIdx, setCardIdx]     = useState(0);
  const [flipped, setFlipped]     = useState(false);
  const [cardsKnown, setCardsKnown] = useState(0);

  // ── Memory sub-state ──────────────────────────────────────────────────────
  const [memCards, setMemCards]   = useState([]);
  const [memFlipped, setMemFlipped] = useState([]);
  const [memMatched, setMemMatched] = useState(0);
  const memLockRef                = useRef(false);
  const memTimerRef               = useRef(null);

  useEffect(() => () => clearTimeout(memTimerRef.current), []);

  function startChallenge() {
    if (!state.products.length) return;

    // Build quiz
    const qs = buildQuiz(state.products, 'classic', DAILY_QUIZ_COUNT, 'all');
    setQuestions(qs);
    setQIdx(0);
    setQSelected(null);
    setQAnswered(false);
    setQCorrect(0);

    // Build flashcards
    const fc = buildFlashcards(state.products, 'all').slice(0, DAILY_CARD_COUNT);
    setCards(fc);
    setCardIdx(0);
    setFlipped(false);
    setCardsKnown(0);

    // Build memory
    const mc = buildMemoryPairs(state.products, DAILY_MEMORY_PAIRS);
    setMemCards(mc);
    setMemFlipped([]);
    setMemMatched(0);
    memLockRef.current = false;

    setPhase('quiz');
  }

  // ── Quiz handlers ──────────────────────────────────────────────────────────
  function handleQuizAnswer(opt) {
    if (qAnswered) return;
    const q  = questions[qIdx];
    const ok = checkAnswer(q, opt);
    setQSelected(opt);
    setQAnswered(true);
    if (ok) {
      setQCorrect(c => c + 1);
      actions.recordAnswer(true);
    } else {
      actions.recordAnswer(false);
      actions.recordMistake(q.product.plu);
    }
    setTimeout(() => {
      const next = qIdx + 1;
      if (next >= questions.length) {
        setPhase('cards');
      } else {
        setQIdx(next);
        setQSelected(null);
        setQAnswered(false);
      }
    }, 900);
  }

  // ── Flashcard handlers ─────────────────────────────────────────────────────
  function handleCardSelfAssess(known) {
    if (known) setCardsKnown(k => k + 1);
    setFlipped(false);
    const next = cardIdx + 1;
    if (next >= cards.length) {
      setPhase('memory');
    } else {
      setCardIdx(next);
    }
  }

  // ── Memory handlers ────────────────────────────────────────────────────────
  function handleMemClick(cardId) {
    if (memLockRef.current) return;
    const card = memCards.find(c => c.id === cardId);
    if (!card || card.isFlipped || card.isMatched) return;

    const newCards = flipCard(memCards, cardId);
    setMemCards(newCards);

    const nowFlipped = [...memFlipped, cardId];
    if (nowFlipped.length < 2) {
      setMemFlipped(nowFlipped);
      return;
    }

    // Second card flipped — check match
    setMemFlipped([]);
    memLockRef.current = true;

    const [idA] = [nowFlipped[0]];
    const cardA = newCards.find(c => c.id === idA);
    const cardB = newCards.find(c => c.id === cardId);

    if (isMatch(cardA, cardB)) {
      const matched = markMatched(newCards, cardA.pairId);
      setMemCards(matched);
      const next = memMatched + 1;
      setMemMatched(next);
      memLockRef.current = false;
      if (isGameComplete(matched)) {
        setTimeout(() => completeChallenge(), 400);
      }
    } else {
      memTimerRef.current = setTimeout(() => {
        setMemCards(unflipUnmatched(newCards));
        memLockRef.current = false;
      }, 950);
    }
  }

  function completeChallenge() {
    actions.completeDailyChallenge();
    setPhase('done');
  }

  // ── Lobby ──────────────────────────────────────────────────────────────────
  if (phase === 'lobby') {
    return (
      <div className="page active">
        <div className="page-header">
          <h2 className="page-title"><i className="fa fa-calendar-check" /> Daily Challenge</h2>
          <p className="page-sub">Complete all 3 stages to earn your daily XP bonus</p>
        </div>

        {alreadyDone ? (
          <div className="section-card daily-done-card">
            <div className="daily-done-icon">✅</div>
            <h3 style={{ fontSize: '1.4rem', fontWeight: 900, marginBottom: 8 }}>Challenge Completed!</h3>
            <p style={{ color: 'var(--text-muted)' }}>You've already done today's challenge. Come back tomorrow!</p>
            <div className="daily-done-xp">+{REWARD_XP} XP earned today</div>
            <div style={{ marginTop: 20 }}>
              <button type="button" className="btn-primary" onClick={() => actions.setPage('dashboard')}>
                <i className="fa fa-home" /> Back to Dashboard
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="daily-stages">
              {STAGES.map(s => (
                <div key={s.key} className="daily-stage-card">
                  <div className="daily-stage-icon">{s.icon}</div>
                  <div className="daily-stage-label">{s.label}</div>
                  <div className="daily-stage-name">{s.name}</div>
                  <div className="daily-stage-desc">{s.desc}</div>
                </div>
              ))}
            </div>

            <div className="daily-reward-row">
              <div className="daily-reward-badge">
                <i className="fa fa-star" /> Complete all 3 stages and earn <strong>+{REWARD_XP} XP</strong>
              </div>
            </div>

            <button
              type="button"
              className="btn-primary btn-lg"
              style={{ width: '100%', marginTop: 16, justifyContent: 'center' }}
              onClick={startChallenge}
              disabled={!state.products.length}
            >
              <i className="fa fa-play" /> Begin Daily Challenge
            </button>
          </>
        )}
      </div>
    );
  }

  // ── Quiz phase ─────────────────────────────────────────────────────────────
  if (phase === 'quiz') {
    const q = questions[qIdx];
    if (!q) return null;
    const correctOpt = q.correct;

    return (
      <div className="page active">
        <div className="daily-phase-header">
          <div className="daily-phase-badge">🧠 Stage 1 – Quiz</div>
          <div className="daily-phase-progress">{qIdx + 1} / {questions.length}</div>
        </div>
        <div className="progress-bar-track" style={{ marginBottom: 20 }}>
          <div className="progress-bar-fill yellow-fill" style={{ width: pct(qIdx, questions.length) + '%' }} />
        </div>

        <div className="section-card daily-quiz-card">
          <div style={{ fontSize: '3.5rem', marginBottom: 8, textAlign: 'center' }}>{q.product.emoji}</div>
          <h3 style={{ fontSize: '1.3rem', fontWeight: 900, textAlign: 'center', marginBottom: 8 }}>{q.product.name}</h3>
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', marginBottom: 20 }}>
            {q.type === 'reverse' ? 'Which product has this PLU?' : 'What is the correct PLU number?'}
          </p>
          <div className="quiz-options">
            {q.options.map(opt => {
              let cls = 'option-btn';
              if (qAnswered) {
                if (opt === correctOpt)    cls += ' correct';
                else if (opt === qSelected) cls += ' wrong';
              }
              return (
                <button
                  key={opt}
                  type="button"
                  className={cls}
                  onClick={() => handleQuizAnswer(opt)}
                  disabled={qAnswered}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Flashcards phase ───────────────────────────────────────────────────────
  if (phase === 'cards') {
    const card = cards[cardIdx];
    if (!card) return null;
    const cat = state.categories.find(c => c.id === card.category);

    return (
      <div className="page active">
        <div className="daily-phase-header">
          <div className="daily-phase-badge">🃏 Stage 2 – Flashcards</div>
          <div className="daily-phase-progress">{cardIdx + 1} / {cards.length}</div>
        </div>
        <div className="progress-bar-track" style={{ marginBottom: 20 }}>
          <div className="progress-bar-fill blue-fill" style={{ width: pct(cardIdx, cards.length) + '%' }} />
        </div>

        <div className="flashcard-stage">
          <div
            className={`flashcard${flipped ? ' flipped' : ''}`}
            role="button"
            tabIndex={0}
            aria-pressed={flipped}
            onClick={() => setFlipped(f => !f)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setFlipped(f => !f)}
          >
            <div className="fc-front">
              <div className="fc-emoji">{card.emoji}</div>
              <div className="fc-name">{card.name}</div>
              <div className="fc-hint">Tap to reveal PLU</div>
            </div>
            <div className="fc-back">
              <div className="fc-plu-label">PLU Code</div>
              <div className="fc-plu">{card.plu}</div>
              {card.nameEn && card.nameEn !== card.name && (
                <div className="fc-name-en">{card.nameEn}</div>
              )}
              <div className="fc-cat">{cat?.name}</div>
            </div>
          </div>
        </div>

        {flipped ? (
          <div className="fc-self-assess">
            <p>Did you know it?</p>
            <button type="button" className="btn-red" onClick={() => handleCardSelfAssess(false)}>
              <i className="fa fa-times" /> Nope
            </button>
            <button type="button" className="btn-green" onClick={() => handleCardSelfAssess(true)}>
              <i className="fa fa-check" /> Got it!
            </button>
          </div>
        ) : (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 16 }}>
            Try to recall the PLU, then flip the card
          </p>
        )}
      </div>
    );
  }

  // ── Memory phase ──────────────────────────────────────────────────────────
  if (phase === 'memory') {
    const progress = DAILY_MEMORY_PAIRS > 0 ? Math.round((memMatched / DAILY_MEMORY_PAIRS) * 100) : 0;

    return (
      <div className="page active">
        <div className="daily-phase-header">
          <div className="daily-phase-badge">🧩 Stage 3 – Memory Game</div>
          <div className="daily-phase-progress">{memMatched} / {DAILY_MEMORY_PAIRS} pairs</div>
        </div>
        <div className="progress-bar-track" style={{ marginBottom: 16 }}>
          <div className="progress-bar-fill green-fill" style={{ width: progress + '%' }} />
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: 20 }}>
          Match each product with its PLU code
        </p>

        <div
          className="memory-board"
          style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', maxWidth: 560, margin: '0 auto' }}
        >
          {memCards.map(card => (
            <button
              key={card.id}
              type="button"
              className={[
                'memory-card',
                card.isFlipped || card.isMatched ? 'is-flipped' : '',
                card.isMatched ? 'is-matched' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleMemClick(card.id)}
              aria-label={
                card.isFlipped || card.isMatched
                  ? (card.type === 'product' ? card.product.name : `PLU ${card.product.plu}`)
                  : 'Hidden card'
              }
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
                    </>
                  ) : (
                    <>
                      <div className="mem-plu">{card.product.plu}</div>
                      <div className="mem-sub">PLU</div>
                    </>
                  )}
                  {card.isMatched && (
                    <span className="memory-match-badge"><i className="fa fa-check" /></span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  return (
    <div className="page active">
      <div className="page-header">
        <h2 className="page-title">🌟 Challenge Complete!</h2>
      </div>
      <div className="section-card daily-complete-card">
        <div className="results-trophy">🌟</div>
        <h2 className="results-title">All 3 Stages Done!</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: 8 }}>
          Quiz: {qCorrect}/{DAILY_QUIZ_COUNT} · Flashcards: {cardsKnown}/{DAILY_CARD_COUNT} known
        </p>
        <p style={{ color: 'var(--text-muted)' }}>Come back tomorrow for a new challenge!</p>
        <div className="daily-complete-xp">+{REWARD_XP} XP</div>
        <div className="results-actions" style={{ marginTop: 20 }}>
          <button type="button" className="btn-primary" onClick={() => actions.setPage('dashboard')}>
            <i className="fa fa-home" /> Dashboard
          </button>
          <button type="button" className="btn-outline" onClick={() => actions.setPage('quiz')}>
            <i className="fa fa-bolt" /> Play Quiz
          </button>
        </div>
      </div>
    </div>
  );
}
