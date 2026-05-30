import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { changePassword } from '../utils/auth';
import { ACHIEVEMENTS } from '../utils/achievements';
import { getXPProgress } from '../utils/scoring';

const AVATAR_COLORS = [
  '#0050AA', '#e63946', '#2ec4b6', '#f4a261',
  '#9b5de5', '#06d6a0', '#ef476f', '#118ab2',
  '#ffd166', '#073b4c', '#ff6b6b', '#4ecdc4',
];
const AVATAR_EMOJIS = ['', '⭐', '🔥', '🏆', '🚀', '🎯', '💎', '🌟', '🎓', '🦁', '🐯', '🦊'];

const TAB_OVERVIEW  = 'overview';
const TAB_EDIT      = 'edit';
const TAB_SECURITY  = 'security';

export default function Profile() {
  const { state, actions } = useApp();
  const [tab, setTab] = useState(TAB_OVERVIEW);

  const user     = state.authUser;
  const progress = getXPProgress(state.xp);
  const accuracy = state.totalAnswered > 0
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100)
    : 0;
  const masteredCount = Object.keys(state.masteredPLUs || {}).length;
  const achievementCount = (state.achievements || []).length;

  if (!user) return null;

  const initial = (user.firstName || '?').charAt(0).toUpperCase();

  return (
    <div className="profile-page">
      {/* ── Hero ── */}
      <div className="profile-hero">
        <div className="profile-hero-blur" />
        <div className="profile-hero-body">
          <div className="profile-avatar-wrap">
            <div
              className="profile-avatar"
              style={{ background: user.avatarColor || '#0050AA' }}
            >
              {user.avatarEmoji || initial}
            </div>
            {state.streak > 0 && (
              <div className="profile-streak-badge">🔥 {state.streak}</div>
            )}
          </div>
          <div className="profile-hero-info">
            <h1 className="profile-name">{user.displayName}</h1>
            <p className="profile-username">@{user.username}</p>
            <div className="profile-chips">
              <span className="profile-chip gold">Level {state.level}</span>
              <span className="profile-chip blue">{state.xp} XP</span>
              {user.storeNumber && <span className="profile-chip slate">Store #{user.storeNumber}</span>}
              {user.role        && <span className="profile-chip slate">{user.role}</span>}
            </div>
            {/* XP progress bar */}
            <div className="profile-xp-track">
              <div className="profile-xp-fill" style={{ width: `${progress.percentage}%` }} />
            </div>
            <p className="profile-xp-hint">{state.xp} / {progress.nextLevelXP} XP to Level {state.level + 1}</p>
          </div>
        </div>

        {/* Tab bar */}
        <div className="profile-tabs">
          {[
            { id: TAB_OVERVIEW, label: 'Overview', icon: 'fa-user' },
            { id: TAB_EDIT,     label: 'Edit Profile', icon: 'fa-edit' },
            { id: TAB_SECURITY, label: 'Security', icon: 'fa-lock' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              className={`profile-tab${tab === t.id ? ' on' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <i className={`fa ${t.icon}`} /> {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tabs ── */}
      {tab === TAB_OVERVIEW && (
        <OverviewTab
          state={state}
          accuracy={accuracy}
          masteredCount={masteredCount}
          achievementCount={achievementCount}
        />
      )}
      {tab === TAB_EDIT     && <EditTab user={user} actions={actions} />}
      {tab === TAB_SECURITY && <SecurityTab user={user} />}
    </div>
  );
}

// ─── OVERVIEW ─────────────────────────────────────────────────────────────────
function OverviewTab({ state, accuracy, masteredCount, achievementCount }) {
  const STATS = [
    { icon: 'fa-star',        label: 'Total XP',          value: state.xp.toLocaleString() },
    { icon: 'fa-trophy',      label: 'Level',              value: state.level },
    { icon: 'fa-fire',        label: 'Streak',             value: `${state.streak} days` },
    { icon: 'fa-bolt',        label: 'Quizzes Played',     value: state.quizzesPlayed },
    { icon: 'fa-bullseye',    label: 'Quiz Accuracy',      value: `${accuracy}%` },
    { icon: 'fa-check-circle',label: 'Products Learned',   value: masteredCount },
    { icon: 'fa-clock',       label: 'Study Time',         value: `${state.studyMinutes} min` },
    { icon: 'fa-medal',       label: 'Achievements',       value: achievementCount },
  ];

  const unlockedSet = new Set(state.achievements || []);

  return (
    <div className="profile-section-grid">
      {/* Stats grid */}
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

      {/* Achievements */}
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

// ─── EDIT PROFILE ─────────────────────────────────────────────────────────────
function EditTab({ user, actions }) {
  const [firstName,   setFirstName]   = useState(user.firstName);
  const [lastName,    setLastName]    = useState(user.lastName);
  const [storeNumber, setStoreNumber] = useState(user.storeNumber || '');
  const [role,        setRole]        = useState(user.role || '');
  const [color,       setColor]       = useState(user.avatarColor || '#0050AA');
  const [emoji,       setEmoji]       = useState(user.avatarEmoji || '');
  const [saved,       setSaved]       = useState(false);

  function handleSave(e) {
    e.preventDefault();
    actions.updateProfile({ firstName, lastName, storeNumber, role, avatarColor: color, avatarEmoji: emoji });
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const previewInitial = (firstName || '?').charAt(0).toUpperCase();

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
        <div className="profile-edit-row2">
          <div className="auth-field">
            <label className="auth-label">First Name</label>
            <div className="auth-input-wrap">
              <i className="fa fa-user auth-input-icon" />
              <input className="auth-input" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label">Last Name</label>
            <div className="auth-input-wrap">
              <i className="fa fa-user auth-input-icon" />
              <input className="auth-input" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label">Store Number</label>
          <div className="auth-input-wrap">
            <i className="fa fa-store auth-input-icon" />
            <input className="auth-input" placeholder="e.g. 1042" value={storeNumber}
              onChange={e => setStoreNumber(e.target.value)} />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label">Role</label>
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

        <button type="submit" className="auth-btn-primary">
          {saved ? <><i className="fa fa-check" /> Saved!</> : <><i className="fa fa-save" /> Save Changes</>}
        </button>
      </form>
    </div>
  );
}

// ─── SECURITY ─────────────────────────────────────────────────────────────────
function SecurityTab({ user }) {
  const [current,  setCurrent]  = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState('');
  const [loading,  setLoading]  = useState(false);

  async function handleChange(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!current)             { setError('Enter your current password.'); return; }
    if (newPass.length < 6)   { setError('New password must be at least 6 characters.'); return; }
    if (newPass !== confirm)  { setError('Passwords do not match.'); return; }
    setLoading(true);
    const result = await changePassword(current, newPass);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setSuccess('Password changed successfully!');
    setCurrent(''); setNewPass(''); setConfirm('');
  }

  return (
    <div className="profile-card profile-edit-card">
      <h2 className="profile-card-title"><i className="fa fa-lock" /> Change Password</h2>
      <form className="profile-edit-form" onSubmit={handleChange} noValidate>
        <div className="auth-field">
          <label className="auth-label">Current Password</label>
          <div className="auth-input-wrap">
            <i className="fa fa-lock auth-input-icon" />
            <input className="auth-input" type="password" value={current}
              onChange={e => { setCurrent(e.target.value); setError(''); }}
              autoComplete="current-password" />
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label">New Password</label>
          <div className="auth-input-wrap">
            <i className="fa fa-lock auth-input-icon" />
            <input className="auth-input" type="password" placeholder="Min. 6 characters"
              value={newPass} onChange={e => { setNewPass(e.target.value); setError(''); }}
              autoComplete="new-password" />
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label">Confirm New Password</label>
          <div className="auth-input-wrap">
            <i className="fa fa-lock auth-input-icon" />
            <input className="auth-input" type="password" placeholder="Repeat password"
              value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }}
              autoComplete="new-password" />
          </div>
        </div>
        {error   && <p className="auth-error"><i className="fa fa-exclamation-circle" /> {error}</p>}
        {success && <p className="profile-success"><i className="fa fa-check-circle" /> {success}</p>}
        <button type="submit" className="auth-btn-primary" disabled={loading}>
          {loading ? <i className="fa fa-spinner fa-spin" /> : <><i className="fa fa-key" /> Change Password</>}
        </button>
      </form>

      <div className="profile-account-info">
        <h3 className="profile-card-title" style={{ marginTop: 24 }}><i className="fa fa-info-circle" /> Account Info</h3>
        <div className="profile-info-row"><span>Username</span><strong>@{user.username}</strong></div>
        <div className="profile-info-row"><span>Email</span><strong>{user.email}</strong></div>
        <div className="profile-info-row"><span>Member since</span><strong>{new Date(user.createdAt).toLocaleDateString()}</strong></div>
      </div>
    </div>
  );
}
