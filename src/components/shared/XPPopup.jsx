import { useEffect } from 'react';
import { useApp }    from '../../store/AppContext';
import { getAchievementById } from '../../utils/achievements';

export default function XPPopup() {
  const { state, actions } = useApp();
  const { show, amount, didLevelUp, achievementId } = state.xpPopup;

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => actions.hideXPPopup(), achievementId ? 3000 : 1800);
    return () => clearTimeout(t);
  }, [show]); // eslint-disable-line

  if (!show) return null;

  if (achievementId) {
    const ach = getAchievementById(achievementId);
    return (
      <div className="xp-popup show xp-popup-ach" aria-live="polite">
        <span className="xp-pop-icon">{ach?.emoji ?? '🏅'}</span>
        <div>
          <div className="xp-pop-text">Achievement Unlocked!</div>
          <div className="xp-pop-ach-name">{ach?.title}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="xp-popup show" aria-live="polite">
      {didLevelUp ? (
        <>
          <span className="xp-pop-icon">🎉</span>
          <span className="xp-pop-text">Level Up!</span>
          <span className="xp-pop-amount">+{amount} XP</span>
        </>
      ) : (
        <>
          <span className="xp-pop-icon">⭐</span>
          <span className="xp-pop-amount">+{amount} XP</span>
        </>
      )}
    </div>
  );
}
