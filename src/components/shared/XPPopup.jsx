import { useEffect } from 'react';
import { useApp }    from '../../store/AppContext';

export default function XPPopup() {
  const { state, actions } = useApp();
  const { show, amount, didLevelUp } = state.xpPopup;

  useEffect(() => {
    if (!show) return;
    const t = setTimeout(() => actions.hideXPPopup(), 1800);
    return () => clearTimeout(t);
  }, [show]);  // eslint-disable-line

  if (!show) return null;

  return (
    <div className={`xp-popup${show ? ' show' : ''}`} aria-live="polite">
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
