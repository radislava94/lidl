import { useState } from 'react';
import { useApp }   from '../store/AppContext';

export default function Login() {
  const { actions } = useApp();
  const [name,  setName]  = useState('');
  const [store, setStore] = useState('');
  const [role,  setRole]  = useState('');
  const [error, setError] = useState('');

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Please enter your name or employee ID.'); return; }
    actions.login(name.trim(), store, role);
    actions.updateStreak();
  }

  return (
    <div className="screen active">
      <div className="login-bg">
        <div className="login-card">
          <div className="login-logo">
            <div className="logo-badge">
              <span className="logo-lidl">lidl</span>
            </div>
            <h1 className="login-title">PLU Trainer</h1>
            <p className="login-subtitle">Master product codes the fun way</p>
          </div>

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="input-group">
              <i className="fa fa-user input-icon" />
              <input
                type="text"
                placeholder="Your name or employee ID"
                value={name}
                onChange={e => { setName(e.target.value); setError(''); }}
                autoComplete="off"
                required
              />
            </div>

            <div className="input-group">
              <i className="fa fa-store input-icon" />
              <select value={store} onChange={e => setStore(e.target.value)}>
                <option value="">Select your store (optional)</option>
                <option>Store #1001 – Berlin</option>
                <option>Store #1042 – Hamburg</option>
                <option>Store #2018 – Munich</option>
                <option>Store #3005 – Frankfurt</option>
                <option>Store #4011 – Cologne</option>
              </select>
            </div>

            <div className="input-group">
              <i className="fa fa-tag input-icon" />
              <select value={role} onChange={e => setRole(e.target.value)}>
                <option value="">Your role (optional)</option>
                <option>Cashier</option>
                <option>Team Leader</option>
                <option>Trainee</option>
                <option>Manager</option>
              </select>
            </div>

            {error && <p style={{ color: 'var(--red)', fontSize: '.88rem', marginTop: 4 }}>{error}</p>}

            <button type="submit" className="btn-primary btn-lg login-btn">
              <i className="fa fa-play" /> Start Learning
            </button>
            <p className="login-hint">No account needed — just jump in!</p>
          </form>

          <div className="login-features">
            <span><i className="fa fa-bolt" /> Quick quizzes</span>
            <span><i className="fa fa-fire" /> Daily streaks</span>
            <span><i className="fa fa-trophy" /> Leaderboard</span>
          </div>
        </div>
      </div>
    </div>
  );
}
