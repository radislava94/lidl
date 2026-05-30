import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { CATEGORY_META } from '../utils/dataLoader';
import { getXPProgress } from '../utils/scoring';

const LESSON_SIZE = 5;
const TIER_LABELS = ['Basics', 'Intermediate', 'Advanced'];
const PATH_ORDER = ['fruits', 'vegetables', 'bakery', 'dairy', 'drinks', 'snacks', 'mixed', 'meat', 'frozen', 'household', 'cosmetics', 'pet_food'];
const PHASE_FLOW = [
  { key: 'learn', label: 'Teach', icon: '📘' },
  { key: 'recognize', label: 'Practice', icon: '👀' },
  { key: 'match', label: 'Match', icon: '🔗' },
  { key: 'recall', label: 'Recall', icon: '🧠' },
  { key: 'test', label: 'Test', icon: '🏁' },
];

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function uniqBy(items, getKey) {
  const seen = new Set();
  return items.filter(item => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function productLabel(product) {
  return `${product.emoji || '📦'} ${product.name}`;
}

function getNeedScore(product, masteredPLUs, mistakes) {
  const missed = mistakes[product.plu] || 0;
  const mastered = masteredPLUs[product.plu] ? 1 : 0;
  const difficultyBias = product.difficulty === 'hard' ? 1.5 : product.difficulty === 'medium' ? 0.8 : 0;
  return missed * 4 + difficultyBias - mastered * 3;
}

function buildDistractors(correctValue, candidates, key, total = 4) {
  const pool = uniqBy(candidates, item => item[key]).filter(item => item[key] !== correctValue[key]);
  const choiceCount = Math.max(1, total - 1);
  const picked = shuffle(pool).slice(0, choiceCount);
  return shuffle([correctValue, ...picked]);
}

function buildPluOptions(correctProduct, candidates, total = 4) {
  const pool = uniqBy(candidates, item => item.plu).filter(item => item.plu !== correctProduct.plu);
  const picked = shuffle(pool).slice(0, Math.max(1, total - 1));
  return shuffle([
    { value: correctProduct.plu, label: `PLU ${correctProduct.plu}`, meta: productLabel(correctProduct), emoji: correctProduct.emoji || '📦' },
    ...picked.map(item => ({ value: item.plu, label: `PLU ${item.plu}`, meta: productLabel(item), emoji: item.emoji || '📦' })),
  ]);
}

function buildProductOptions(correctProduct, candidates, total = 4) {
  const options = buildDistractors(correctProduct, candidates, 'plu', total);
  return options.map(item => ({
    value: item.plu,
    label: item.name,
    meta: `PLU ${item.plu}`,
    emoji: item.emoji || '📦',
  }));
}

function buildQuestionSet(lessonProducts, allProducts) {
  const fallbackPool = uniqBy([...lessonProducts, ...allProducts], item => item.plu);
  const [p1, p2, p3, p4, p5] = lessonProducts;
  const makeTestQuestion = (product, index) => {
    const direction = Math.random() > 0.5 ? 'product-to-plu' : 'plu-to-product';
    return direction === 'product-to-plu'
      ? {
          id: `test-${index + 1}`,
          prompt: `Which product uses PLU ${product.plu}?`,
          answer: product.plu,
          product,
          mode: direction,
          options: buildProductOptions(product, fallbackPool),
        }
      : {
          id: `test-${index + 1}`,
          prompt: `What is the PLU for ${productLabel(product)}?`,
          answer: product.plu,
          product,
          mode: direction,
          options: buildPluOptions(product, fallbackPool),
        };
  };

  return {
    recognize: {
      id: 'recognize',
      step: 'recognize',
      prompt: `Which product uses PLU ${p1.plu}?`,
      answer: p1.plu,
      product: p1,
      options: buildProductOptions(p1, fallbackPool),
    },
    match: {
      id: 'match',
      step: 'match',
      prompt: `Match this product to its PLU.`,
      answer: p2.plu,
      product: p2,
      options: buildPluOptions(p2, fallbackPool),
    },
    recall: {
      id: 'recall',
      step: 'recall',
      prompt: `What is the PLU for this product?`,
      answer: p3.plu,
      product: p3,
      options: buildPluOptions(p3, fallbackPool),
    },
    test: [makeTestQuestion(p1, 0), makeTestQuestion(p2, 1), makeTestQuestion(p3, 2), makeTestQuestion(p4, 3), makeTestQuestion(p5, 4)],
  };
}

function buildLessonCatalog(products, categories, masteredPLUs, mistakes) {
  const categoryLookup = new Map(categories.map(cat => [cat.id, cat]));
  const orderedCategories = [
    ...PATH_ORDER.map(id => categoryLookup.get(id)).filter(Boolean),
    ...categories.filter(cat => !PATH_ORDER.includes(cat.id)),
  ];
  const seenCategories = new Set();
  const sections = [];
  const allLessons = [];

  orderedCategories.forEach(cat => {
    if (seenCategories.has(cat.id)) return;
    seenCategories.add(cat.id);

    const sorted = [...products]
      .filter(product => product.category === cat.id)
      .sort((a, b) => {
        const diff = getNeedScore(b, masteredPLUs, mistakes) - getNeedScore(a, masteredPLUs, mistakes);
        if (diff !== 0) return diff;
        return a.name.localeCompare(b.name);
      });

    if (!sorted.length) return;

    const lessons = [];
    for (let i = 0; i < 3; i += 1) {
      const chunk = sorted.slice(i * LESSON_SIZE, (i + 1) * LESSON_SIZE);
      if (chunk.length < LESSON_SIZE) break;
      const completed = chunk.every(product => masteredPLUs[product.plu]);
      const title = `${cat.name} ${TIER_LABELS[i] || `Level ${i + 1}`}`;
      const lesson = {
        id: `${cat.id}-${i}`,
        categoryId: cat.id,
        categoryName: cat.name,
        categoryEmoji: cat.emoji,
        categoryColor: cat.color,
        tier: i,
        title,
        subtitle: `${chunk.length} products`,
        products: chunk,
        completed,
      };
      lessons.push(lesson);
      allLessons.push(lesson);
    }

    if (lessons.length === 0) return;

    const completedCount = lessons.filter(lesson => lesson.completed).length;
    const currentLesson = lessons.find(lesson => !lesson.completed) || lessons[lessons.length - 1] || null;
    const totalProducts = sorted.length;
    const masteredCount = sorted.filter(product => masteredPLUs[product.plu]).length;
    sections.push({
      id: cat.id,
      name: cat.name,
      emoji: cat.emoji,
      color: cat.color,
      lessons,
      completedCount,
      totalLessons: lessons.length,
      totalProducts,
      masteredCount,
      masteryPercent: totalProducts > 0 ? Math.round((masteredCount / totalProducts) * 100) : 0,
      currentLessonId: currentLesson?.id || null,
    });
  });

  const mixedSource = [...products]
    .sort((a, b) => {
      const diff = getNeedScore(b, masteredPLUs, mistakes) - getNeedScore(a, masteredPLUs, mistakes);
      if (diff !== 0) return diff;
      return a.name.localeCompare(b.name);
    })
    .slice(0, LESSON_SIZE);

  if (mixedSource.length === LESSON_SIZE) {
    const mixedMeta = CATEGORY_META.mixed || { name: 'Mixed', emoji: '⭐', color: '#9b59b6' };
    const mixedLesson = {
      id: 'mixed-0',
      categoryId: 'mixed',
      categoryName: mixedMeta.name,
      categoryEmoji: mixedMeta.emoji,
      categoryColor: mixedMeta.color,
      tier: 0,
      title: 'Mixed Challenge',
      subtitle: 'Across all categories',
      products: mixedSource,
      completed: mixedSource.every(product => masteredPLUs[product.plu]),
      isMixed: true,
    };
    sections.push({
      id: 'mixed',
      name: mixedMeta.name,
      emoji: mixedMeta.emoji,
      color: mixedMeta.color,
      lessons: [mixedLesson],
      completedCount: mixedLesson.completed ? 1 : 0,
      totalLessons: 1,
      totalProducts: mixedSource.length,
      masteredCount: mixedSource.filter(product => masteredPLUs[product.plu]).length,
      masteryPercent: Math.round((mixedSource.filter(product => masteredPLUs[product.plu]).length / mixedSource.length) * 100),
      currentLessonId: mixedLesson.completed ? null : mixedLesson.id,
      isMixed: true,
    });
    allLessons.push(mixedLesson);
  }

  const totalLessons = allLessons.length;
  const completedLessons = allLessons.filter(lesson => lesson.completed).length;
  const overallMastered = products.filter(product => masteredPLUs[product.plu]).length;
  const overallMastery = products.length > 0 ? Math.round((overallMastered / products.length) * 100) : 0;
  const lessonsByNeed = [...allLessons]
    .filter(lesson => !lesson.completed)
    .map(lesson => ({
      ...lesson,
      priority: lesson.products.reduce((sum, product) => sum + getNeedScore(product, masteredPLUs, mistakes), 0) / lesson.products.length,
    }))
    .sort((a, b) => b.priority - a.priority);
  const recommendedLesson = lessonsByNeed[0] || allLessons[0] || null;

  return {
    sections,
    allLessons,
    totalLessons,
    completedLessons,
    overallMastery,
    recommendedLesson,
  };
}

function createLessonSession(lesson, allProducts, masteredPLUs, mistakes) {
  const lessonProducts = shuffle([...lesson.products]);
  const questions = buildQuestionSet(lessonProducts, allProducts);
  const freshAttempt = lesson.products.some(product => !masteredPLUs[product.plu]);
  return {
    lesson,
    lessonProducts,
    questions,
    step: 'learn',
    learnIndex: 0,
    answerLocked: false,
    selected: null,
    feedback: null,
    hearts: 3,
    correct: 0,
    attempts: 0,
    firstTry: true,
    outcome: null,
    rewardsApplied: false,
    rewardXp: 0,
    perfectBonus: 0,
    firstTryBonus: 0,
    freshAttempt,
    reviewMode: !freshAttempt,
    showConfetti: false,
    testIndex: 0,
    nextPhaseLabel: 'Continue',
  };
}

function stageIndex(step) {
  const index = PHASE_FLOW.findIndex(phase => phase.key === step);
  return index < 0 ? 0 : index;
}

function AnswerButton({ option, active, correct, wrong, onClick, disabled, compact }) {
  return (
    <button
      type="button"
      className={`lp-answer-btn${active ? ' lp-answer-active' : ''}${correct ? ' lp-answer-correct' : ''}${wrong ? ' lp-answer-wrong' : ''}${disabled ? ' lp-answer-disabled' : ''}${compact ? ' lp-answer-compact' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="lp-answer-icon">{option.emoji || (option.meta?.startsWith('PLU') ? '🏷️' : '📦')}</span>
      <span className="lp-answer-body">
        <span className="lp-answer-label">{option.label}</span>
        {option.meta && <span className="lp-answer-meta">{option.meta}</span>}
      </span>
    </button>
  );
}

function Confetti() {
  const colors = ['#FFF000', '#22c55e', '#e3000f', '#1a6ed4', '#9b59b6', '#f59e0b'];
  const pieces = Array.from({ length: 52 }, (_, index) => ({
    id: index,
    left: Math.random() * 100,
    top: Math.random() * 20,
    delay: Math.random() * 0.8,
    duration: 0.9 + Math.random() * 0.7,
    size: 8 + Math.random() * 8,
    color: colors[index % colors.length],
  }));

  return (
    <div className="lp-confetti" aria-hidden="true">
      {pieces.map(piece => (
        <span
          key={piece.id}
          className="lp-confetti-piece"
          style={{
            left: `${piece.left}%`,
            top: `${piece.top}%`,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

export default function Learn() {
  const { state, actions } = useApp();
  const [activeLessonId, setActiveLessonId] = useState(null);
  const [session, setSession] = useState(null);

  const learnCatalog = useMemo(() => {
    return buildLessonCatalog(state.products, state.categories, state.masteredPLUs, state.mistakes);
  }, [state.products, state.categories, state.masteredPLUs, state.mistakes]);

  const activeLesson = useMemo(() => {
    if (!activeLessonId) return null;
    return learnCatalog.allLessons.find(lesson => lesson.id === activeLessonId) || null;
  }, [learnCatalog.allLessons, activeLessonId]);

  const currentSessionLesson = session?.lesson || activeLesson;
  const currentStep = session?.step || 'map';
  const xpProgress = getXPProgress(state.xp);

  const recommendedLesson = learnCatalog.recommendedLesson;
  const lessonProgressPercent = learnCatalog.totalLessons > 0
    ? Math.round((learnCatalog.completedLessons / learnCatalog.totalLessons) * 100)
    : 0;

  useEffect(() => {
    if (!session || session.outcome) return;
    if (!session.answerLocked) return;

    const timer = setTimeout(() => {
      setSession(prev => {
        if (!prev || prev.outcome || !prev.answerLocked) return prev;

        if (prev.hearts <= 0) {
          return {
            ...prev,
            outcome: 'failed',
            answerLocked: false,
            feedback: null,
          };
        }

        if (prev.step === 'learn') {
          const nextIndex = prev.learnIndex + 1;
          return {
            ...prev,
            learnIndex: nextIndex >= prev.lessonProducts.length ? prev.lessonProducts.length - 1 : nextIndex,
            step: nextIndex >= prev.lessonProducts.length ? 'recognize' : 'learn',
            answerLocked: false,
            selected: null,
            feedback: null,
          };
        }

        if (prev.step === 'recognize') {
          return { ...prev, step: 'match', answerLocked: false, selected: null, feedback: null };
        }

        if (prev.step === 'match') {
          return { ...prev, step: 'recall', answerLocked: false, selected: null, feedback: null };
        }

        if (prev.step === 'recall') {
          return { ...prev, step: 'test', answerLocked: false, selected: null, feedback: null, testIndex: 0 };
        }

        if (prev.step === 'test') {
          const isLast = prev.testIndex >= prev.questions.test.length - 1;
          if (!isLast) {
            return {
              ...prev,
              testIndex: prev.testIndex + 1,
              answerLocked: false,
              selected: null,
              feedback: null,
            };
          }
          const accuracy = prev.attempts > 0 ? Math.round((prev.correct / prev.attempts) * 100) : 0;
          const passed = accuracy >= 80 && prev.hearts > 0;
          return {
            ...prev,
            outcome: passed ? 'passed' : 'failed',
            answerLocked: false,
            selected: null,
            feedback: null,
            showConfetti: passed,
          };
        }

        return prev;
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [session]);

  useEffect(() => {
    if (!session || session.outcome !== 'passed' || session.rewardsApplied) return;

    const accuracy = session.attempts > 0 ? Math.round((session.correct / session.attempts) * 100) : 0;
    const baseReward = session.freshAttempt ? 50 : 0;
    const perfectBonus = session.freshAttempt && accuracy === 100 ? 25 : 0;
    const firstTryBonus = session.freshAttempt && session.firstTry ? 25 : 0;
    const rewardXp = baseReward + perfectBonus + firstTryBonus;

    if (session.freshAttempt) {
      session.lesson.products.forEach(product => actions.markMastered(product.plu));
      actions.updateStreak();
      if (rewardXp > 0) actions.addXP(rewardXp);
    }

    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        rewardsApplied: true,
        rewardXp,
        perfectBonus,
        firstTryBonus,
        showConfetti: rewardXp > 0,
      };
    });
  }, [session, actions]);

  function startLesson(lesson) {
    if (!lesson) return;
    setActiveLessonId(lesson.id);
    setSession(createLessonSession(lesson, state.products, state.masteredPLUs, state.mistakes));
  }

  function resetLesson() {
    if (!activeLesson) return;
    setSession(createLessonSession(activeLesson, state.products, state.masteredPLUs, state.mistakes));
  }

  function leaveLesson() {
    setSession(null);
    setActiveLessonId(null);
  }

  function currentQuestion() {
    if (!session) return null;
    if (session.step === 'recognize') return session.questions.recognize;
    if (session.step === 'match') return session.questions.match;
    if (session.step === 'recall') return session.questions.recall;
    if (session.step === 'test') return session.questions.test[session.testIndex];
    return null;
  }

  function answerQuestion(value) {
    if (!session || session.answerLocked || session.outcome) return;
    const question = currentQuestion();
    if (!question) return;

    const correct = value === question.answer;
    const nextHearts = correct ? session.hearts : session.hearts - 1;
    const nextCorrect = session.correct + (correct ? 1 : 0);
    const nextAttempts = session.attempts + 1;

    actions.recordAnswer(correct);
    if (!correct) {
      actions.recordMistake(question.product.plu);
    }

    setSession(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        selected: value,
        feedback: {
          correct,
          answer: question.answer,
          prompt: question.prompt,
          product: question.product,
        },
        hearts: nextHearts,
        correct: nextCorrect,
        attempts: nextAttempts,
        firstTry: prev.firstTry && correct,
        answerLocked: true,
        showConfetti: false,
      };
    });
  }

  function nextLearnCard() {
    if (!session || session.outcome) return;
    if (session.learnIndex < session.lessonProducts.length - 1) {
      setSession(prev => (prev ? { ...prev, learnIndex: prev.learnIndex + 1 } : prev));
      return;
    }
    setSession(prev => (prev ? { ...prev, step: 'recognize', answerLocked: false, feedback: null } : prev));
  }

  const activeQuestion = currentQuestion();
  const activeCatMastery = currentSessionLesson
    ? learnCatalog.sections.find(section => section.id === currentSessionLesson.categoryId)?.masteryPercent || 0
    : 0;

  if (state.isLoadingProducts) {
    return (
      <div className="lp-loading-shell">
        <div className="spinner" />
      </div>
    );
  }

  if (session?.outcome === 'passed') {
    const accuracy = session.attempts > 0 ? Math.round((session.correct / session.attempts) * 100) : 0;
    const totalEarned = session.rewardXp;

    return (
      <div className="lp-result-shell">
        {session.showConfetti && <Confetti />}
        <div className="lp-result-card">
          <div className="lp-result-icon">🎉</div>
          <h2 className="lp-result-title">Lesson Complete</h2>
          <p className="lp-result-sub">You turned practice into mastery.</p>

          <div className="lp-result-metrics">
            <div className="lp-result-metric">
              <span className="lp-result-value">5</span>
              <span className="lp-result-label">Products Learned</span>
            </div>
            <div className="lp-result-metric">
              <span className="lp-result-value">{accuracy}%</span>
              <span className="lp-result-label">Accuracy</span>
            </div>
            <div className="lp-result-metric">
              <span className="lp-result-value">+{totalEarned}</span>
              <span className="lp-result-label">XP Earned</span>
            </div>
            <div className="lp-result-metric">
              <span className="lp-result-value">{session.perfectBonus ? '+25' : '+0'}</span>
              <span className="lp-result-label">Perfect Bonus</span>
            </div>
          </div>

          <div className="lp-result-note">
            {session.reviewMode ? 'Review complete. Replay it anytime to sharpen your recall.' : 'Fresh mastery unlocked. The path opens up automatically.'}
          </div>

          <button type="button" className="lp-primary-btn lp-wide-btn" onClick={leaveLesson}>
            Continue Journey
          </button>
        </div>
      </div>
    );
  }

  if (session?.outcome === 'failed') {
    return (
      <div className="lp-result-shell">
        <div className="lp-result-card lp-fail-card">
          <div className="lp-result-icon">💛</div>
          <h2 className="lp-result-title">Try Again</h2>
          <p className="lp-result-sub">You ran out of hearts or missed the 80% pass mark.</p>

          <div className="lp-result-note">Watch the lesson again, then retry the test when you’re ready.</div>

          <div className="lp-action-stack">
            <button type="button" className="lp-primary-btn lp-wide-btn" onClick={resetLesson}>
              Retry Lesson
            </button>
            <button type="button" className="lp-secondary-btn lp-wide-btn" onClick={resetLesson}>
              Watch Tutorial Again
            </button>
            <button type="button" className="lp-secondary-btn lp-wide-btn" onClick={leaveLesson}>
              Back to Path
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (session) {
    const lesson = currentSessionLesson;
    const currentProduct = lesson?.products[session.learnIndex] || lesson?.products[0];
    const phase = PHASE_FLOW[stageIndex(session.step)];
    const progressText = session.step === 'learn'
      ? `${Math.min(session.learnIndex + 1, lesson.products.length)} / ${lesson.products.length}`
      : session.step === 'test'
        ? `${Math.min(session.testIndex + 1, session.questions.test.length)} / ${session.questions.test.length}`
        : `${stageIndex(session.step) + 1} / ${PHASE_FLOW.length}`;
    const lessonTitle = lesson?.isMixed ? 'Mixed Challenge' : lesson?.title || 'Lesson';

    return (
      <div className="lp-lesson-shell">
        {session.showConfetti && <Confetti />}

        <div className="lp-lesson-topbar">
          <button type="button" className="lp-back-btn" onClick={leaveLesson}>
            ← Back to map
          </button>
          <div className="lp-topbar-center">
            <div className="lp-topbar-title">{lesson?.categoryEmoji || '🎓'} {lessonTitle}</div>
            <div className="lp-topbar-sub">Teach → Practice → Test → Reward</div>
          </div>
          <div className="lp-heart-bank" aria-label="Hearts">
            {Array.from({ length: 3 }).map((_, index) => (
              <span key={index} className={`lp-heart${index < session.hearts ? ' lp-heart-on' : ''}`}>❤️</span>
            ))}
          </div>
        </div>

        <div className="lp-phase-strip">
          {PHASE_FLOW.map((step, index) => (
            <div
              key={step.key}
              className={`lp-phase-chip${index < stageIndex(session.step) ? ' is-done' : ''}${step.key === session.step ? ' is-active' : ''}`}
            >
              <span className="lp-phase-emoji">{step.icon}</span>
              <span>{step.label}</span>
            </div>
          ))}
        </div>

        <div className="lp-lesson-progress-card">
          <div className="lp-progress-head">
            <span className="lp-progress-label">Lesson Progress</span>
            <span className="lp-progress-aux">{progressText}</span>
          </div>
          <div className="lp-progress-bar">
            <div
              className="lp-progress-fill"
              style={{ width: `${session.step === 'learn' ? ((session.learnIndex + 1) / lesson.products.length) * 100 : (stageIndex(session.step) / (PHASE_FLOW.length - 1)) * 100}%` }}
            />
          </div>
          <div className="lp-progress-meta">
            <span>{lesson.categoryEmoji} {lesson.categoryName}</span>
            <span>{session.reviewMode ? 'Review mode' : 'Fresh run'}</span>
            <span>{activeCatMastery}% category mastery</span>
          </div>
        </div>

        <div className="lp-lesson-card">
          {session.step === 'learn' && currentProduct && (
            <>
              <div className="lp-learn-badge">Teach</div>
              <div className="lp-product-stage">
                <div className="lp-product-emoji">{currentProduct.emoji || '📦'}</div>
                <div className="lp-product-name">{currentProduct.name}</div>
                <div className="lp-product-plu">PLU {currentProduct.plu}</div>
              </div>
              <p className="lp-stage-copy">
                Learn it first. Look, say it, and repeat it out loud.
              </p>
              <button type="button" className="lp-primary-btn" onClick={nextLearnCard}>
                Next Product
              </button>
            </>
          )}

          {session.step !== 'learn' && activeQuestion && (
            <>
              <div className="lp-question-head">
                <span className="lp-question-tag">{phase?.label || 'Practice'}</span>
                <span className="lp-question-subtag">{lesson.categoryName}</span>
              </div>

              {session.step === 'recognize' && (
                <>
                  <div className="lp-question-copy">Which product uses PLU {activeQuestion.answer}?</div>
                  <div className="lp-option-grid lp-option-grid-products">
                    {activeQuestion.options.map(option => (
                      <AnswerButton
                        key={option.value}
                        option={option}
                        onClick={() => answerQuestion(option.value)}
                        disabled={session.answerLocked}
                        active={session.selected === option.value && !session.feedback?.correct}
                        correct={session.feedback?.correct && option.value === activeQuestion.answer}
                        wrong={session.feedback && !session.feedback.correct && session.selected === option.value}
                      />
                    ))}
                  </div>
                </>
              )}

              {session.step === 'match' && (
                <>
                  <div className="lp-match-card">
                    <div className="lp-match-emoji">{activeQuestion.product.emoji || '📦'}</div>
                    <div>
                      <div className="lp-match-label">Match this product</div>
                      <div className="lp-match-name">{activeQuestion.product.name}</div>
                    </div>
                  </div>
                  <div className="lp-question-copy">Which PLU belongs here?</div>
                  <div className="lp-option-grid">
                    {activeQuestion.options.map(option => (
                      <AnswerButton
                        key={option.value}
                        option={option}
                        compact
                        onClick={() => answerQuestion(option.value)}
                        disabled={session.answerLocked}
                        active={session.selected === option.value && !session.feedback?.correct}
                        correct={session.feedback?.correct && option.value === activeQuestion.answer}
                        wrong={session.feedback && !session.feedback.correct && session.selected === option.value}
                      />
                    ))}
                  </div>
                </>
              )}

              {session.step === 'recall' && (
                <>
                  <div className="lp-recall-card">
                    <div className="lp-recall-emoji">{activeQuestion.product.emoji || '📦'}</div>
                    <div className="lp-recall-name">{activeQuestion.product.name}</div>
                  </div>
                  <div className="lp-question-copy">What is the PLU for this product?</div>
                  <div className="lp-option-grid">
                    {activeQuestion.options.map(option => (
                      <AnswerButton
                        key={option.value}
                        option={option}
                        onClick={() => answerQuestion(option.value)}
                        disabled={session.answerLocked}
                        active={session.selected === option.value && !session.feedback?.correct}
                        correct={session.feedback?.correct && option.value === activeQuestion.answer}
                        wrong={session.feedback && !session.feedback.correct && session.selected === option.value}
                      />
                    ))}
                  </div>
                </>
              )}

              {session.step === 'test' && (
                <>
                  <div className="lp-question-copy lp-test-copy">Mini test {session.testIndex + 1} of 5</div>
                  <div className="lp-test-panel">
                    <div className="lp-test-product">
                      <div className="lp-test-emoji">{activeQuestion.product.emoji || '📦'}</div>
                      <div className="lp-test-name">{activeQuestion.product.name}</div>
                    </div>
                    <div className="lp-question-text">{activeQuestion.prompt}</div>
                  </div>
                  <div className="lp-option-grid">
                    {activeQuestion.options.map(option => (
                      <AnswerButton
                        key={option.value}
                        option={option}
                        onClick={() => answerQuestion(option.value)}
                        disabled={session.answerLocked}
                        active={session.selected === option.value && !session.feedback?.correct}
                        correct={session.feedback?.correct && option.value === activeQuestion.answer}
                        wrong={session.feedback && !session.feedback.correct && session.selected === option.value}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}

          {session.feedback && (
            <div className={`lp-feedback${session.feedback.correct ? ' lp-feedback-good' : ' lp-feedback-bad'}`}>
              {session.feedback.correct ? (
                <>✅ Correct. Keep the rhythm going.</>
              ) : (
                <>❌ Not quite. The correct answer is <strong>{session.feedback.answer}</strong>.</>
              )}
            </div>
          )}
        </div>

        <div className="lp-lesson-footer">
          <div className="lp-footer-stat">
            <span className="lp-footer-lbl">Correct</span>
            <span className="lp-footer-val lp-footer-good">{session.correct}</span>
          </div>
          <div className="lp-footer-stat">
            <span className="lp-footer-lbl">Answered</span>
            <span className="lp-footer-val">{session.attempts}</span>
          </div>
          <div className="lp-footer-stat">
            <span className="lp-footer-lbl">Current Lesson</span>
            <span className="lp-footer-val">{lesson.categoryEmoji} {lesson.categoryName}</span>
          </div>
          <div className="lp-footer-stat">
            <span className="lp-footer-lbl">Best Path XP</span>
            <span className="lp-footer-val">{xpProgress.level}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="lp-path-shell">
      <div className="lp-hero-card">
        <div className="lp-hero-copy">
          <div className="lp-eyebrow">Main learning experience</div>
          <h2 className="lp-title">Learn Path</h2>
          <p className="lp-subtitle">
            A guided journey that teaches, practices, tests, and rewards you one lesson at a time.
          </p>
        </div>

        <div className="lp-hero-journey">
          <div className="lp-journey-pill">Teach</div>
          <div className="lp-journey-arrow">→</div>
          <div className="lp-journey-pill">Practice</div>
          <div className="lp-journey-arrow">→</div>
          <div className="lp-journey-pill">Test</div>
          <div className="lp-journey-arrow">→</div>
          <div className="lp-journey-pill lp-journey-reward">Reward</div>
        </div>

        <div className="lp-hero-stats">
          <div className="lp-hero-stat">
            <span className="lp-hero-value">{learnCatalog.completedLessons}</span>
            <span className="lp-hero-label">Lessons done</span>
          </div>
          <div className="lp-hero-stat">
            <span className="lp-hero-value">{learnCatalog.overallMastery}%</span>
            <span className="lp-hero-label">Overall mastery</span>
          </div>
          <div className="lp-hero-stat">
            <span className="lp-hero-value">{state.streak}</span>
            <span className="lp-hero-label">Day streak</span>
          </div>
          <div className="lp-hero-stat">
            <span className="lp-hero-value">{xpProgress.level}</span>
            <span className="lp-hero-label">Level</span>
          </div>
        </div>

        {recommendedLesson && (
          <div className="lp-recommend-card">
            <div>
              <div className="lp-recommend-label">Recommended next</div>
              <div className="lp-recommend-title">{recommendedLesson.categoryEmoji} {recommendedLesson.title}</div>
              <div className="lp-recommend-sub">{recommendedLesson.subtitle}</div>
            </div>
            <button type="button" className="lp-primary-btn lp-hero-btn" onClick={() => startLesson(recommendedLesson)}>
              Start Learn Path
            </button>
          </div>
        )}
      </div>

      <div className="lp-progress-overview">
        <div className="lp-progress-head">
          <span className="lp-progress-label">Lesson Progress</span>
          <span className="lp-progress-aux">{learnCatalog.completedLessons} / {learnCatalog.totalLessons} lessons complete</span>
        </div>
        <div className="lp-progress-bar">
          <div className="lp-progress-fill" style={{ width: `${lessonProgressPercent}%` }} />
        </div>
        <div className="lp-progress-meta">
          <span>{lessonProgressPercent}% complete</span>
          <span>{learnCatalog.overallMastery}% category mastery</span>
        </div>
      </div>

      <div className="lp-map-grid">
        {learnCatalog.sections.map(section => (
          <section key={section.id} className="lp-map-section">
            <div className="lp-section-head">
              <div>
                <div className="lp-section-title">{section.emoji} {section.name}</div>
                <div className="lp-section-sub">{section.masteryPercent}% mastery · {section.completedCount} / {section.totalLessons} lessons complete</div>
              </div>
              <div className="lp-section-badge">{section.masteryPercent}%</div>
            </div>

            <div className="lp-track">
              {section.lessons.map((lesson, index) => {
                const status = lesson.completed
                  ? 'completed'
                  : lesson.id === section.currentLessonId || lesson.id === recommendedLesson?.id
                    ? 'current'
                    : 'locked';
                const isStartable = status !== 'locked';
                return (
                  <div className="lp-node-wrap" key={lesson.id}>
                    <button
                      type="button"
                      className={`lp-node lp-node-${status}`}
                      onClick={() => isStartable && startLesson(lesson)}
                      disabled={!isStartable}
                    >
                      <div className="lp-node-top">
                        <span className="lp-node-icon">
                          {status === 'completed' ? '✓' : status === 'current' ? '⭐' : '🔒'}
                        </span>
                        <span className="lp-node-tier">{TIER_LABELS[lesson.tier] || `Level ${lesson.tier + 1}`}</span>
                      </div>
                      <div className="lp-node-title">{lesson.title}</div>
                      <div className="lp-node-sub">{lesson.products.length} products</div>
                      <div className="lp-node-status">
                        {status === 'completed' ? 'Green' : status === 'current' ? 'Start' : 'Locked'}
                      </div>
                    </button>

                    {index < section.lessons.length - 1 && <span className="lp-node-connector" />}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
