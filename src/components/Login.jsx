import { useState } from 'react';
import { useApp } from '../store/AppContext';

export default function Login() {
  const { actions } = useApp();
  const [name,    setName]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);

  function handleStart(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed)          { setError('Please enter your name.'); return; }
    if (trimmed.length < 2){ setError('Name must be at least 2 characters.'); return; }
    if (trimmed.length > 40){ setError('Name is too long (max 40 characters).'); return; }
    setLoading(true);
    // Small delay for button feedback, then create player + enter app
    setTimeout(() => {
      actions.loginWithName(trimmed);
    }, 150);
  }

  return (
    <div className="auth-bg">
      <div className="auth-card welcome-card">

        {/* Logo */}
        <div className="auth-logo">
          <div className="logo-badge">
            <span className="logo-lidl">lidl</span>
          </div>
          <h1 className="auth-title">PLU Trainer</h1>
          <p className="auth-subtitle">Master product codes the fun way</p>
        </div>

        {/* Name form */}
        <form className="auth-form welcome-form" onSubmit={handleStart} noValidate>
          <div className="welcome-prompt">
            <span className="welcome-wave">👋</span>
            <span>Welcome! What&apos;s your name?</span>
          </div>

          <div className="auth-field">
            <div className="auth-input-wrap">
              <i className="fa fa-user auth-input-icon" />
              <input
                type="text"
                className="auth-input welcome-input"
                placeholder="e.g. Radislava"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                autoFocus
                autoComplete="given-name"
                maxLength={40}
              />
            </div>
          </div>

          {error && (
            <p className="auth-error">
              <i className="fa fa-exclamation-circle" /> {error}
            </p>
          )}

          <button type="submit" className="auth-btn-primary welcome-btn" disabled={loading || !name.trim()}>
            {loading
              ? <i className="fa fa-spinner fa-spin" />
              : <><i className="fa fa-play" /> Start Learning</>
            }
          </button>
        </form>

        {/* Feature pills */}
        <div className="auth-features">
          <span><i className="fa fa-bolt" /> Quick quizzes</span>
          <span><i className="fa fa-fire" /> Daily streaks</span>
          <span><i className="fa fa-trophy" /> Leaderboard</span>
          <span><i className="fa fa-wifi-slash" style={{ fontSize: 11 }} /> Works offline</span>
        </div>

      </div>
    </div>
  );
}

