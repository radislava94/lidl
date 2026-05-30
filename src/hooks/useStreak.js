import { useCallback } from 'react';
import { todayString, yesterdayString } from '../utils/helpers';

/**
 * Daily streak logic.
 *
 * Usage:
 *   const { checkStreak } = useStreak();
 *   // Call on application load / daily activity:
 *   const updated = checkStreak(lastActiveDate, currentStreak);
 *   // updated = { streak, lastActiveDate }
 */
export function useStreak() {
  /**
   * Compute the new streak value given persisted data.
   *
   * @param {string|null} lastActiveDate – stored toDateString()
   * @param {number}      currentStreak
   * @returns {{ streak: number, lastActiveDate: string }}
   */
  const checkStreak = useCallback((lastActiveDate, currentStreak) => {
    const today     = todayString();
    const yesterday = yesterdayString();

    if (lastActiveDate === today) {
      // Already counted today — no change
      return { streak: currentStreak, lastActiveDate };
    }

    if (lastActiveDate === yesterday) {
      // Consecutive day — extend streak
      return { streak: currentStreak + 1, lastActiveDate: today };
    }

    // First launch or streak broke
    return { streak: 1, lastActiveDate: today };
  }, []);

  /**
   * Mark today as active (call after any learning interaction).
   */
  const markActiveToday = useCallback((lastActiveDate, currentStreak) => {
    return checkStreak(lastActiveDate, currentStreak);
  }, [checkStreak]);

  return { checkStreak, markActiveToday };
}
