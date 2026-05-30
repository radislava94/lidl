/**
 * achievements.js — Achievement definitions and unlock checker
 */

export const ACHIEVEMENTS = [
  // ── Quiz & XP ──────────────────────────────────────────────────────────────
  { id: 'first_quiz',       emoji: '🎯', title: 'First Quiz',         desc: 'Complete your first quiz.',                  check: s => s.quizzesPlayed >= 1 },
  { id: 'quiz_5',           emoji: '🔥', title: 'Quiz Veteran',       desc: 'Complete 5 quizzes.',                        check: s => s.quizzesPlayed >= 5 },
  { id: 'quiz_25',          emoji: '🏅', title: 'Quiz Champion',      desc: 'Complete 25 quizzes.',                       check: s => s.quizzesPlayed >= 25 },
  { id: 'xp_100',           emoji: '⭐', title: '100 XP Earned',      desc: 'Earn 100 XP.',                               check: s => s.xp >= 100 },
  { id: 'xp_500',           emoji: '💫', title: '500 XP Earned',      desc: 'Earn 500 XP.',                               check: s => s.xp >= 500 },
  { id: 'xp_1000',          emoji: '🌟', title: '1 000 XP Earned',    desc: 'Earn 1 000 XP.',                             check: s => s.xp >= 1000 },
  { id: 'xp_5000',          emoji: '🚀', title: 'XP Rocket',          desc: 'Earn 5 000 XP.',                             check: s => s.xp >= 5000 },

  // ── Accuracy ───────────────────────────────────────────────────────────────
  { id: 'accuracy_80',      emoji: '🎯', title: 'Sharp Shooter',      desc: 'Reach 80% quiz accuracy.',                  check: s => s.totalAnswered >= 10 && (s.totalCorrect / s.totalAnswered) >= 0.80 },
  { id: 'accuracy_95',      emoji: '🏆', title: 'Perfectionist',      desc: 'Reach 95% quiz accuracy.',                  check: s => s.totalAnswered >= 20 && (s.totalCorrect / s.totalAnswered) >= 0.95 },

  // ── Products ───────────────────────────────────────────────────────────────
  { id: 'learn_10',         emoji: '📚', title: 'Getting Started',    desc: 'Learn 10 products.',                        check: s => Object.keys(s.masteredPLUs).length >= 10 },
  { id: 'learn_50',         emoji: '📖', title: 'Bookworm',           desc: 'Learn 50 products.',                        check: s => Object.keys(s.masteredPLUs).length >= 50 },
  { id: 'learn_100',        emoji: '🎓', title: '100 Products Learned', desc: 'Learn 100 products.',                    check: s => Object.keys(s.masteredPLUs).length >= 100 },
  { id: 'learn_200',        emoji: '🧠', title: 'PLU Encyclopedia',   desc: 'Learn 200 products.',                       check: s => Object.keys(s.masteredPLUs).length >= 200 },

  // ── Category Masters ───────────────────────────────────────────────────────
  { id: 'fruit_master',     emoji: '🍎', title: 'Fruit Master',       desc: 'Learn all fruits.',                         check: (s, cats) => isCategoryMastered(s, cats, 'fruits') },
  { id: 'veg_master',       emoji: '🥦', title: 'Veg Master',         desc: 'Learn all vegetables.',                     check: (s, cats) => isCategoryMastered(s, cats, 'vegetables') },
  { id: 'bakery_master',    emoji: '🥐', title: 'Bakery Master',      desc: 'Learn all bakery items.',                   check: (s, cats) => isCategoryMastered(s, cats, 'bakery') },
  { id: 'drinks_master',    emoji: '🥤', title: 'Drinks Master',      desc: 'Learn all drinks.',                         check: (s, cats) => isCategoryMastered(s, cats, 'drinks') },
  { id: 'snacks_master',    emoji: '🍿', title: 'Snacks Master',      desc: 'Learn all snacks.',                         check: (s, cats) => isCategoryMastered(s, cats, 'snacks') },

  // ── Streaks ────────────────────────────────────────────────────────────────
  { id: 'streak_3',         emoji: '🔥', title: '3-Day Streak',       desc: 'Log in 3 days in a row.',                   check: s => s.streak >= 3 },
  { id: 'streak_7',         emoji: '🌈', title: '7-Day Streak',       desc: 'Log in 7 days in a row.',                   check: s => s.streak >= 7 },
  { id: 'streak_30',        emoji: '💎', title: '30-Day Streak',      desc: 'Log in 30 days in a row.',                  check: s => s.streak >= 30 },

  // ── Misc ───────────────────────────────────────────────────────────────────
  { id: 'daily_complete',   emoji: '📅', title: 'Daily Champion',     desc: 'Complete a daily challenge.',               check: s => !!s.dailyChallengeDate },
  { id: 'no_mistakes',      emoji: '✨', title: 'Clean Sheet',        desc: 'Answer 10 in a row without mistakes.',      check: s => s._perfectStreak >= 10 },
  { id: 'study_60',         emoji: '⏱️', title: 'Hour of Study',     desc: 'Study for 60 minutes total.',               check: s => s.studyMinutes >= 60 },
  { id: 'study_600',        emoji: '🏋️', title: 'Training Day',       desc: 'Study for 600 minutes total.',              check: s => s.studyMinutes >= 600 },
];

function isCategoryMastered(state, cats, key) {
  if (!cats) return false;
  const cat = cats.find(c => c.id === key);
  if (!cat || !cat.products?.length) return false;
  return cat.products.every(p => state.masteredPLUs[p.plu]);
}

/**
 * Returns array of newly-unlocked achievement IDs.
 * Call after any state change and dispatch UNLOCK_ACHIEVEMENT for each.
 */
export function checkAchievements(state, categories = []) {
  const unlocked = new Set(state.achievements || []);
  const newlyUnlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (unlocked.has(a.id)) continue;
    try {
      if (a.check(state, categories)) newlyUnlocked.push(a.id);
    } catch { /* ignore */ }
  }
  return newlyUnlocked;
}

export function getAchievementById(id) {
  return ACHIEVEMENTS.find(a => a.id === id);
}
