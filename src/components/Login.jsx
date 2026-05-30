import { useMemo, useState } from 'react';
import { useApp } from '../store/AppContext';
import { getAllPlayers } from '../utils/auth';

export default function Login() {
  const { state, actions } = useApp();
  const [name,    setName]    = useState('');
  const [error,   setError]   = useState('');
  const [notice,  setNotice]  = useState('');
  const [loading, setLoading] = useState(false);
  const [showPlayers, setShowPlayers] = useState(true);

  const players = useMemo(() => getAllPlayers(), [state.playerDirectoryVersion]);

  function handleStart(e) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed)          { setError('Please enter your name.'); return; }
    if (trimmed.length < 2){ setError('Name must be at least 2 characters.'); return; }
    if (trimmed.length > 40){ setError('Name is too long (max 40 characters).'); return; }
    const existing = players.find(player => String(player.name || '').trim().toLowerCase() === trimmed.toLowerCase());
    setNotice('');
    setLoading(true);
    // Small delay for button feedback, then create/load player + enter app
    setTimeout(() => {
      actions.loginWithName(trimmed);
    }, existing ? 400 : 150);
    if (existing) {
      setNotice(`Welcome back, ${existing.name}!`);
    }
  }

  function handleSelectPlayer(player) {
    setNotice(`Welcome back, ${player.name}!`);
    setLoading(true);
    setTimeout(() => {
      actions.switchPlayer(player.id);
    }, 400);
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

          {notice && <p className="welcome-notice">{notice}</p>}

          <div className="auth-field">
            <div className="auth-input-wrap">
              <i className="fa fa-user auth-input-icon" />
              <input
                type="text"
                className="auth-input welcome-input"
                placeholder="e.g. Radislava"
                value={name}
                  onChange={e => { setName(e.target.value); setError(''); setNotice(''); }}
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

          <button
            type="button"
            className="auth-btn-secondary welcome-switch-btn"
            onClick={() => setShowPlayers(v => !v)}
          >
            <i className="fa fa-users" /> Switch Player
          </button>
        </form>

        {showPlayers && (
          <div className="player-picker">
            <div className="player-picker-head">
              <h2>Saved Players</h2>
              <span>{players.length} saved</span>
            </div>
            {players.length ? (
              <div className="player-list">
                {players.map(player => (
                  <div key={player.id} className="player-row">
                    <button type="button" className="player-row-main" onClick={() => handleSelectPlayer(player)}>
                      <span className="player-row-avatar">{(player.name || '?').charAt(0).toUpperCase()}</span>
                      <span className="player-row-info">
                        <strong>{player.name}</strong>
                        <small>Level {player.level} · {player.xp} XP · {player.streak} streak</small>
                      </span>
                    </button>
                    <button type="button" className="player-row-delete" onClick={() => actions.deleteProfile(player.id)}>
                      <i className="fa fa-trash" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="player-picker-empty">No saved players yet. Enter your name above to create the first one.</p>
            )}
          </div>
        )}

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

