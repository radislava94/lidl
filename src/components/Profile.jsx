import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { ACHIEVEMENTS } from '../utils/achievements';
import { getXPProgress } from '../utils/scoring';

const AVATAR_COLORS = [
  '#0050AA', '#e63946', '#2ec4b6', '#f4a261',
  '#9b5de5', '#06d6a0', '#ef476f', '#118ab2',
  '#ffd166', '#073b4c', '#ff6b6b', '#4ecdc4',
];
const AVATAR_EMOJIS = ['', '⭐', '🔥', '🏆', '🚀', '🎯', '💎', '🌟', '🎓', '🦁', '🐯', '🦊'];

const TAB_OVERVIEW = 'overview';
const TAB_EDIT     = 'edit';

export default function Profile() {
  const { state, actions } = useApp();
  const [tab, setTab] = useState(TAB_OVERVIEW);

  const player   = state.authUser;
  const progress = getXPProgress(state.xp);
  const accuracy = state.totalAnswered > 0
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100) : 0;
  const masteredCount    = Object.keys(state.masteredPLUs  || {}).length;
  const achievementCount = (state.achievements || []).length;

  if (!player) return null;

  const initial = (player.displayName || player.name || '?').charAt(0).toUpperCase();

  return (
    <div className="profile-page">
      {/* Hero */}
      <div className="profile-hero">
        <div className="profile-hero-blur" />
        <div className="profile-hero-body">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar" style={{ background: player.avatarColor || '#0050AA' }}>
              {player.avatarEmoji || initial}
            </div>
            {state.streak > 0 && (
              <div className="profile-streak-badge">🔥 {state.streak}</div>
            )}
          </div>
          <div className="profile-hero-info">
            <h1 className="profile-name">{player.displayName || player.name}</h1>
            <div className="profile-chips">
              <span className="profile-chip gold">Level {state.level}</span>
              <span className="profile-chip blue">{state.xp} XP</span>
              {player.storeNumber && <span className="profile-chip slate">Store #{player.storeNumber}</span>}
              {player.role        && <span className="profile-chip slate">{player.role}</span>}
            </div>
            <div className="profile-xp-track">
              <div className="profile-xp-fill" style={{ width: `${progress.percentage}%` }} />
            </div>
            <p className="profile-xp-hint">{state.xp} / {progress.nextLevelXP} XP to Level {state.level + 1}</p>
          </div>
        </div>

        <div className="profile-tabs">
          {[
            { id: TAB_OVERVIEW, label: 'Overview',    icon: 'fa-user' },
            { id: TAB_EDIT,     label: 'Edit Profile', icon: 'fa-edit' },
          ].map(t => (
            <button key={t.id} type="button"
              className={`profile-tab${tab === t.id ? ' on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <i className={`fa ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === TAB_OVERVIEW && (
        <OverviewTab state={state} accuracy={accuracy} masteredCount={masteredCount} achievementCount={achievementCount} />
      )}
      {tab === TAB_EDIT && (
        <EditTab player={player} actions={actions} />
      )}
    </div>
  );
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
function OverviewTab({ state, accuracy, masteredCount, achievementCount }) {
  const STATS = [
    { icon: 'fa-star',         label: 'Total XP',        value: state.xp.toLocaleString() },
    { icon: 'fa-trophy',       label: 'Level',            value: state.level },
    { icon: 'fa-fire',         label: 'Streak',           value: `${state.streak} days` },
    { icon: 'fa-bolt',         label: 'Quizzes Played',   value: state.quizzesPlayed },
    { icon: 'fa-bullseye',     label: 'Quiz Accuracy',    value: `${accuracy}%` },
    { icon: 'fa-check-circle', label: 'Products Learned', value: masteredCount },
    { icon: 'fa-clock',        label: 'Study Time',       value: `${state.studyMinutes} min` },
    { icon: 'fa-medal',        label: 'Achievements',     value: achievementCount },
  ];
  const unlockedSet = new Set(state.achievements || []);

  return (
    <div className="profile-section-grid">
      <div className="profile-card">
        <h2 className="profile-card-title"><i className="fa fa-chart-bar" /> Statistics</h2>
        <div className="profile-stats-grid">
          {STATS.map(s => (
            <div key={s.label} className="profile-stat">
              <i className={`fa ${s.icon} profile-stat-icon`} />
              <div className="profile-stat-value">{s.value}</div>
              <div className="profile-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="profile-card">
        <h2 className="profile-card-title"><i className="fa fa-medal" /> Achievements</h2>
        <div className="profile-achievements-grid">
          {ACHIEVEMENTS.map(a => {
            const unlocked = unlockedSet.has(a.id);
            return (
              <div key={a.id} className={`profile-achievement${unlocked ? ' unlocked' : ' locked'}`} title={a.desc}>
                <span className="profile-ach-emoji">{unlocked ? a.emoji : '🔒'}</span>
                <span className="profile-ach-title">{a.title}</span>
                {unlocked && <span className="profile-ach-check">✓</span>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── EDIT ─────────────────────────────────────────────────────────────────────
function EditTab({ player, actions }) {
  const [name,   setName]   = useState(player.displayName || player.name || '');
  const [color,  setColor]  = useState(player.avatarColor || '#0050AA');
  const [emoji,  setEmoji]  = useState(player.avatarEmoji || '');
  const [store,  setStore]  = useState(player.storeNumber || '');
  const [role,   setRole]   = useState(player.role || '');
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  function handleSave(e) {
    e.preventDefault();
    if (!name.trim())          { setError('Name cannot be empty.'); return; }
    if (name.trim().length < 2){ setError('Name must be at least 2 characters.'); return; }
    setError('');
    actions.updateProfile({
      name:        name.trim(),
      avatarColor: color,
      avatarEmoji: emoji,
      storeNumber: store,
      role,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const previewInitial = (name || '?').charAt(0).toUpperCase();

  return (
    <div className="profile-card profile-edit-card">
      <h2 className="profile-card-title"><i className="fa fa-edit" /> Edit Profile</h2>

      {/* Avatar preview */}
      <div className="profile-edit-avatar-row">
        <div className="profile-edit-avatar" style={{ background: color }}>
          {emoji || previewInitial}
        </div>
        <div>
          <p className="profile-edit-hint">Choose avatar colour and emoji</p>
          <div className="profile-color-swatches">
            {AVATAR_COLORS.map(c => (
              <button key={c} type="button"
                className={`profile-swatch${color === c ? ' selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
          <div className="profile-emoji-row">
            {AVATAR_EMOJIS.map(em => (
              <button key={em || 'none'} type="button"
                className={`profile-emoji-btn${emoji === em ? ' selected' : ''}`}
                onClick={() => setEmoji(em)}
              >
                {em || previewInitial}
              </button>
            ))}
          </div>
        </div>
      </div>

      <form className="profile-edit-form" onSubmit={handleSave}>
        <div className="auth-field">
          <label className="auth-label">Your Name</label>
          <div className="auth-input-wrap">
            <i className="fa fa-user auth-input-icon" />
            <input className="auth-input" value={name}
              onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="Your name" maxLength={40} />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label">Store Number <span className="auth-optional">(optional)</span></label>
          <div className="auth-input-wrap">
            <i className="fa fa-store auth-input-icon" />
            <input className="auth-input" placeholder="e.g. 1042" value={store}
              onChange={e => setStore(e.target.value)} />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label">Role <span className="auth-optional">(optional)</span></label>
          <div className="auth-input-wrap">
            <i className="fa fa-tag auth-input-icon" />
            <select className="auth-input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="">Select role</option>
              <option>Cashier</option>
              <option>Team Leader</option>
              <option>Trainee</option>
              <option>Manager</option>
            </select>
          </div>
        </div>

        {error && <p className="auth-error"><i className="fa fa-exclamation-circle" /> {error}</p>}

        <button type="submit" className="auth-btn-primary">
          {saved ? <><i className="fa fa-check" /> Saved!</> : <><i className="fa fa-save" /> Save Changes</>}
        </button>
      </form>

      <div className="profile-danger-zone">
        <div className="profile-danger-copy">
          <h3>Player Data</h3>
          <p>Reset this player&apos;s progress or delete the player from this device.</p>
        </div>
        <div className="profile-danger-actions">
          <button type="button" className="btn-outline" onClick={actions.resetProgress}>
            <i className="fa fa-undo" /> Reset Progress
          </button>
          <button type="button" className="btn-red" onClick={() => actions.deleteProfile(player.id)}>
            <i className="fa fa-trash" /> Delete Profile
          </button>
        </div>
      </div>
    </div>
  );
}

