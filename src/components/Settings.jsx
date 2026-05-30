import { useState } from 'react';
import { useApp }       from '../store/AppContext';
import { getXPProgress } from '../utils/scoring';

export default function Settings() {
  const { state, actions }     = useApp();
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved]      = useState(false);
  const xpProg                 = getXPProgress(state.xp);

  function handleDailyGoalChange(val) {
    actions.setDailyGoal(Number(val));
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  return (
    <div className="page active">
      <div className="page-header">
        <h2 className="page-title"><i className="fa fa-cog" /> Settings</h2>
        <p className="page-sub">Manage your profile and preferences</p>
      </div>

      {/* Profile Card */}
      <div className="section-card settings-profile-card">
        <div className="settings-avatar">{(state.user || '?').charAt(0).toUpperCase()}</div>
        <div className="settings-profile-info">
          <div className="settings-username">{state.user}</div>
          <div className="settings-store">
            {[state.store, state.role].filter(Boolean).join(' · ') || 'No store set'}
          </div>
          <div className="settings-level">Level {xpProg.level} · {state.xp} XP total</div>
        </div>
      </div>

      {/* Preferences */}
      <div className="section-card" style={{ marginBottom: 18 }}>
        <div className="section-card-header">
          <h3><i className="fa fa-sliders-h" /> Preferences</h3>
          {saved && <span style={{ color: 'var(--green)', fontSize: '.85rem', fontWeight: 700 }}>Saved ✓</span>}
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Dark Mode</div>
            <div className="settings-row-desc">Switch between light and dark theme</div>
          </div>
          <button
            type="button"
            className={`settings-toggle${state.isDarkMode ? ' active' : ''}`}
            onClick={actions.toggleDark}
            aria-pressed={state.isDarkMode}
            aria-label="Toggle dark mode"
          >
            <span className="settings-toggle-knob" />
          </button>
        </div>

        <div className="settings-row">
          <div>
            <div className="settings-row-label">Daily Goal</div>
            <div className="settings-row-desc">Products to master per day</div>
          </div>
          <select
            className="select-styled"
            value={state.dailyGoal}
            onChange={e => handleDailyGoalChange(e.target.value)}
          >
            {[5, 10, 15, 20, 25, 30].map(n => (
              <option key={n} value={n}>{n} per day</option>
            ))}
          </select>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="section-card" style={{ marginBottom: 18 }}>
        <div className="section-card-header">
          <h3><i className="fa fa-chart-bar" /> Your Stats</h3>
        </div>
        <div className="stats-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="stat-card blue">
            <div className="stat-icon"><i className="fa fa-graduation-cap" /></div>
            <div className="stat-val">{Object.keys(state.masteredPLUs).length}</div>
            <div className="stat-lbl">PLUs Mastered</div>
          </div>
          <div className="stat-card yellow">
            <div className="stat-icon"><i className="fa fa-fire" /></div>
            <div className="stat-val">{state.streak}</div>
            <div className="stat-lbl">Day Streak</div>
          </div>
          <div className="stat-card gray">
            <div className="stat-icon"><i className="fa fa-brain" /></div>
            <div className="stat-val">{state.quizzesPlayed}</div>
            <div className="stat-lbl">Quizzes Played</div>
          </div>
        </div>

        {/* XP Progress */}
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontWeight: 700 }}>
            <span>Level {xpProg.level}</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '.88rem' }}>
              {xpProg.progress} / {xpProg.max} XP to next level
            </span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill blue-fill" style={{ width: xpProg.percentage + '%' }} />
          </div>
        </div>
      </div>

      {/* Account / Danger zone */}
      <div className="section-card settings-danger-card">
        <div className="section-card-header">
          <h3 style={{ color: 'var(--red)' }}>
            <i className="fa fa-exclamation-triangle" /> Account
          </h3>
        </div>
        <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '.9rem', lineHeight: 1.6 }}>
          Your progress is stored locally on this device. You can switch players, reset progress, or delete the current profile.
        </p>

        {!confirmReset ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button type="button" className="btn-outline" onClick={actions.logout}>
              <i className="fa fa-users" /> Switch Player
            </button>
            <button type="button" className="btn-red" onClick={() => setConfirmReset(true)}>
              <i className="fa fa-trash" /> Reset Current Player
            </button>
          </div>
        ) : (
          <div className="confirm-row">
            <span style={{ fontWeight: 700, color: 'var(--red)' }}>
              ⚠️ This will delete this player&apos;s progress!
            </span>
            <button
              type="button"
              className="btn-red btn-sm"
              onClick={() => { setConfirmReset(false); actions.resetProgress(); }}
            >
              Yes, reset everything
            </button>
            <button
              type="button"
              className="btn-outline btn-sm"
              onClick={() => setConfirmReset(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
