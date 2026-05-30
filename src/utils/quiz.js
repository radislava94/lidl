import { shuffle, randomPick, uid } from './helpers';

// ─── Quiz mode constants ──────────────────────────────────────────────────────
export const QUIZ_MODES = {
  CLASSIC:  { id: 'classic',  label: 'Classic',     icon: '🎯', desc: '10 Qs · No timer',      questions: 10, timer: 0   },
  SPEED:    { id: 'speed',    label: 'Speed Round',  icon: '⚡', desc: '20 Qs · 10 s each',    questions: 20, timer: 10  },
  SURVIVAL: { id: 'survival', label: 'Survival',     icon: '❤️', desc: 'Unlimited · 3 lives',  questions: 999,timer: 15  },
  REVERSE:  { id: 'reverse',  label: 'Reverse',      icon: '🔄', desc: 'PLU → name · No timer', questions: 10, timer: 0  },
};

// ─── Difficulty filter for progression ───────────────────────────────────────
export const DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * Generate a single quiz question.
 *
 * @param {Object[]} pool       – filtered product list for this quiz
 * @param {string}   mode       – quiz mode id
 * @param {string[]} usedPLUs   – recently used PLUs to avoid repetition
 * @returns {Object} question
 */
export function generateQuestion(pool, mode = 'classic', usedPLUs = []) {
  if (pool.length < 2) return null;

  // Prefer unused products to avoid immediate repetition
  const fresh = pool.filter(p => !usedPLUs.includes(p.plu));
  const product = randomPick(fresh.length >= 1 ? fresh : pool);

  // Build wrong answers: prefer same category, then fallback to others
  const sameCat  = pool.filter(p => p.category === product.category && p.plu !== product.plu);
  const otherCat = pool.filter(p => p.category !== product.category);
  const wrongPool = [...shuffle(sameCat), ...shuffle(otherCat)];
  const wrongCount = Math.min(3, Math.max(1, pool.length - 1));
  const wrongs = wrongPool.slice(0, wrongCount);

  if (wrongs.length < 1) return null; // not enough products for valid options

  const isReverse =
    mode === 'reverse' ||
    (mode === 'survival' && Math.random() > 0.6);

  if (isReverse) {
    return {
      id: uid(),
      type: 'reverse',
      product,
      prompt: product.plu,
      promptLabel: 'PLU Code',
      correct: product.name,
      options: shuffle([product.name, ...wrongs.map(p => p.name)]),
      difficulty: product.difficulty,
    };
  }

  return {
    id: uid(),
    type: 'classic',
    product,
    prompt: product.name,
    promptLabel: 'Product',
    correct: product.plu,
    options: shuffle([product.plu, ...wrongs.map(p => p.plu)]),
    difficulty: product.difficulty,
  };
}

/**
 * Build a full list of quiz questions.
 *
 * @param {Object[]} products
 * @param {string}   mode
 * @param {number}   count
 * @param {string}   difficulty – 'all' | 'easy' | 'medium' | 'hard'
 * @returns {Object[]}
 */
export function buildQuiz(products, mode = 'classic', count = 10, difficulty = 'all') {
  const pool = difficulty === 'all'
    ? products
    : products.filter(p => p.difficulty === difficulty);

  if (pool.length < 2) return [];

  const questions = [];
  const used = [];

  for (let i = 0; i < count; i++) {
    const q = generateQuestion(pool, mode, used);
    if (!q) break;
    questions.push(q);
    used.push(q.product.plu);
    if (used.length > Math.min(10, pool.length - 1)) used.shift();
  }

  return questions;
}

/**
 * Check whether an answer is correct.
 */
export function checkAnswer(question, answer) {
  return answer === question.correct;
}

/**
 * Generate random flashcards (shuffled product list).
 */
export function buildFlashcards(products, category = 'all') {
  const items = category === 'all' ? products : products.filter(p => p.category === category);
  return shuffle(items);
}
