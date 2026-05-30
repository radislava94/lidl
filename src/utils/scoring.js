// ─── XP / Level constants ─────────────────────────────────────────────────────
// Non-linear level thresholds: [xp needed to reach level 1, 2, 3, ...]
export const LEVEL_THRESHOLDS = [0, 100, 250, 500, 1000, 1750, 2750, 4000, 5500, 7500, 10000];

export const DIFFICULTY_XP = { easy: 10, medium: 16, hard: 24 };

export const MODE_MULTIPLIER = { classic: 1.0, speed: 1.5, survival: 2.0, reverse: 1.8 };

export const STREAK_THRESHOLD = 5; // in-quiz streak before bonus kicks in

// ─── XP calculation ───────────────────────────────────────────────────────────

/**
 * Calculate XP earned for a single correct answer.
 *
 * @param {Object} opts
 * @param {boolean} opts.isCorrect
 * @param {string}  opts.difficulty  – 'easy' | 'medium' | 'hard'
 * @param {string}  opts.mode        – quiz mode id
 * @param {number}  opts.timeLeft    – seconds remaining (speed bonus)
 * @param {number}  opts.quizStreak  – consecutive correct answers in this quiz
 */
export function calculateXP({ isCorrect, difficulty = 'easy', mode = 'classic', timeLeft = 0, quizStreak = 0 }) {
  if (!isCorrect) return 0;
  const base       = DIFFICULTY_XP[difficulty] ?? 10;
  const modeMult   = MODE_MULTIPLIER[mode]      ?? 1;
  const timeBonus  = Math.floor(timeLeft * 0.5);
  const streakBonus = quizStreak >= STREAK_THRESHOLD ? Math.floor(base * 0.5) : 0;

  return Math.round(base * modeMult + timeBonus + streakBonus);
}

// ─── Level helpers ────────────────────────────────────────────────────────────

export function getLevelFromXP(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

/**
 * Returns current level, XP within current level, XP needed for next level,
 * and percentage progress within current level.
 */
export function getXPProgress(xp) {
  const level      = getLevelFromXP(xp);
  const levelStart = LEVEL_THRESHOLDS[level - 1] ?? 0;
  const levelEnd   = LEVEL_THRESHOLDS[level] ?? (levelStart + 1500);
  const progress   = xp - levelStart;
  const max        = levelEnd - levelStart;
  return {
    level,
    progress,
    max,
    percentage: Math.min(100, Math.round((progress / max) * 100)),
    nextLevelXP: levelEnd,
  };
}

// ─── Quiz final score ─────────────────────────────────────────────────────────

/**
 * Calculate final quiz score (display points, not XP).
 */
export function calcFinalScore(correct, total, mode = 'classic') {
  if (!total) return 0;
  const accuracy    = correct / total;
  const baseScore   = correct * 100;
  const perfBonus   = accuracy === 1 ? 500 : accuracy >= 0.8 ? 200 : 0;
  const modeMult    = MODE_MULTIPLIER[mode] ?? 1;
  return Math.round((baseScore + perfBonus) * modeMult);
}

/**
 * Total XP earned for completing a quiz.
 */
export function calcQuizXP(correct, total, mode = 'classic') {
  const accuracy = total ? correct / total : 0;
  const base = correct * (DIFFICULTY_XP.medium);  // use medium as base
  const modeMult = MODE_MULTIPLIER[mode] ?? 1;
  const accBonus = accuracy >= 0.9 ? 30 : accuracy >= 0.7 ? 15 : 0;
  return Math.round(base * modeMult * 0.5 + accBonus);
}

// ─── Difficulty progression ───────────────────────────────────────────────────

/**
 * Suggest next difficulty based on recent accuracy.
 */
export function suggestDifficulty(accuracy, current = 'easy') {
  if (accuracy >= 0.85 && current === 'easy')   return 'medium';
  if (accuracy >= 0.85 && current === 'medium') return 'hard';
  if (accuracy < 0.5  && current === 'hard')    return 'medium';
  if (accuracy < 0.5  && current === 'medium')  return 'easy';
  return current;
}
