import { useState } from 'react';
import { useApp } from '../store/AppContext';
import {
  registerUser, loginUser,
  verifySecurityAnswer, resetPassword,
  SECURITY_QUESTIONS,
} from '../utils/auth';

// ─── Tab types ────────────────────────────────────────────────────────────────
const TAB_LOGIN    = 'login';
const TAB_REGISTER = 'register';
const TAB_FORGOT   = 'forgot';

export default function Login() {
  const [tab, setTab] = useState(TAB_LOGIN);

  return (
    <div className="auth-bg">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="logo-badge">
            <span className="logo-lidl">lidl</span>
          </div>
          <h1 className="auth-title">PLU Trainer</h1>
          <p className="auth-subtitle">Master product codes the fun way</p>
        </div>

        {tab !== TAB_FORGOT && (
          <div className="auth-tabs">
            <button type="button" className={`auth-tab${tab === TAB_LOGIN ? ' on' : ''}`} onClick={() => setTab(TAB_LOGIN)}>
              Sign In
            </button>
            <button type="button" className={`auth-tab${tab === TAB_REGISTER ? ' on' : ''}`} onClick={() => setTab(TAB_REGISTER)}>
              Create Account
            </button>
          </div>
        )}

        {tab === TAB_LOGIN    && <LoginForm    onForgot={() => setTab(TAB_FORGOT)} />}
        {tab === TAB_REGISTER && <RegisterForm onSwitch={() => setTab(TAB_LOGIN)} />}
        {tab === TAB_FORGOT   && <ForgotForm   onBack={() => setTab(TAB_LOGIN)} />}

        <div className="auth-features">
          <span><i className="fa fa-bolt" /> Quick quizzes</span>
          <span><i className="fa fa-fire" /> Daily streaks</span>
          <span><i className="fa fa-trophy" /> Leaderboard</span>
          <span><i className="fa fa-shield-alt" /> Progress saved</span>
        </div>
      </div>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function LoginForm({ onForgot }) {
  const { actions } = useApp();
  const [identity,   setIdentity]   = useState('');
  const [password,   setPassword]   = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPass,   setShowPass]   = useState(false);
  const [error,      setError]      = useState('');
  const [loading,    setLoading]    = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!identity.trim()) { setError('Enter your username or email.'); return; }
    if (!password)        { setError('Enter your password.'); return; }
    setLoading(true);
    const result = await loginUser(identity.trim(), password, rememberMe);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    actions.loginWithUser(result.user);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-field">
        <label className="auth-label">Username or Email</label>
        <div className="auth-input-wrap">
          <i className="fa fa-user auth-input-icon" />
          <input type="text" className="auth-input" placeholder="radislava94 or email@example.com"
            value={identity} onChange={e => { setIdentity(e.target.value); setError(''); }}
            autoComplete="username" />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label">Password</label>
        <div className="auth-input-wrap">
          <i className="fa fa-lock auth-input-icon" />
          <input type={showPass ? 'text' : 'password'} className="auth-input" placeholder="Your password"
            value={password} onChange={e => { setPassword(e.target.value); setError(''); }}
            autoComplete="current-password" />
          <button type="button" className="auth-eye" tabIndex={-1} onClick={() => setShowPass(v => !v)}>
            <i className={`fa fa-${showPass ? 'eye-slash' : 'eye'}`} />
          </button>
        </div>
      </div>

      <div className="auth-row-between">
        <label className="auth-check-label">
          <input type="checkbox" checked={rememberMe} onChange={e => setRememberMe(e.target.checked)} />
          <span>Remember me</span>
        </label>
        <button type="button" className="auth-link" onClick={onForgot}>Forgot password?</button>
      </div>

      {error && <p className="auth-error"><i className="fa fa-exclamation-circle" /> {error}</p>}

      <button type="submit" className="auth-btn-primary" disabled={loading}>
        {loading ? <i className="fa fa-spinner fa-spin" /> : <><i className="fa fa-sign-in-alt" /> Sign In</>}
      </button>
    </form>
  );
}

// ─── REGISTER ─────────────────────────────────────────────────────────────────
function RegisterForm({ onSwitch }) {
  const { actions } = useApp();
  const [form, setForm] = useState({
    firstName: '', lastName: '', username: '', email: '',
    password: '', confirmPassword: '', storeNumber: '',
    securityQuestion: SECURITY_QUESTIONS[0], securityAnswer: '',
  });
  const [showPass, setShowPass] = useState(false);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);

  function set(k, v) { setForm(f => ({ ...f, [k]: v })); setError(''); }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.firstName.trim())  { setError('First name is required.'); return; }
    if (!form.lastName.trim())   { setError('Last name is required.'); return; }
    if (!form.username.trim())   { setError('Username is required.'); return; }
    if (!/^[a-z0-9_]{3,20}$/i.test(form.username)) { setError('Username: 3-20 chars, letters/numbers/underscore only.'); return; }
    if (!form.email.trim() || !form.email.includes('@')) { setError('Valid email is required.'); return; }
    if (form.password.length < 6)               { setError('Password must be at least 6 characters.'); return; }
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    if (!form.securityAnswer.trim())            { setError('Security answer is required.'); return; }

    setLoading(true);
    const result = await registerUser(form);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    actions.loginWithUser(result.user);
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit} noValidate>
      <div className="auth-row-2col">
        <div className="auth-field">
          <label className="auth-label">First Name</label>
          <div className="auth-input-wrap">
            <i className="fa fa-user auth-input-icon" />
            <input className="auth-input" placeholder="Radislava" value={form.firstName}
              onChange={e => set('firstName', e.target.value)} autoComplete="given-name" />
          </div>
        </div>
        <div className="auth-field">
          <label className="auth-label">Last Name</label>
          <div className="auth-input-wrap">
            <i className="fa fa-user auth-input-icon" />
            <input className="auth-input" placeholder="Maneska" value={form.lastName}
              onChange={e => set('lastName', e.target.value)} autoComplete="family-name" />
          </div>
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label">Username</label>
        <div className="auth-input-wrap">
          <i className="fa fa-at auth-input-icon" />
          <input className="auth-input" placeholder="radislava94" value={form.username}
            onChange={e => set('username', e.target.value.toLowerCase().replace(/\s/g, ''))}
            autoComplete="username" />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label">Email</label>
        <div className="auth-input-wrap">
          <i className="fa fa-envelope auth-input-icon" />
          <input className="auth-input" type="email" placeholder="you@example.com" value={form.email}
            onChange={e => set('email', e.target.value)} autoComplete="email" />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label">Password</label>
        <div className="auth-input-wrap">
          <i className="fa fa-lock auth-input-icon" />
          <input className="auth-input" type={showPass ? 'text' : 'password'}
            placeholder="Min. 6 characters" value={form.password}
            onChange={e => set('password', e.target.value)} autoComplete="new-password" />
          <button type="button" className="auth-eye" tabIndex={-1} onClick={() => setShowPass(v => !v)}>
            <i className={`fa fa-${showPass ? 'eye-slash' : 'eye'}`} />
          </button>
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label">Confirm Password</label>
        <div className="auth-input-wrap">
          <i className="fa fa-lock auth-input-icon" />
          <input className="auth-input" type={showPass ? 'text' : 'password'}
            placeholder="Repeat password" value={form.confirmPassword}
            onChange={e => set('confirmPassword', e.target.value)} autoComplete="new-password" />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label">Store Number <span className="auth-optional">(optional)</span></label>
        <div className="auth-input-wrap">
          <i className="fa fa-store auth-input-icon" />
          <input className="auth-input" placeholder="e.g. 1042" value={form.storeNumber}
            onChange={e => set('storeNumber', e.target.value)} />
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label">Security Question</label>
        <div className="auth-input-wrap">
          <i className="fa fa-question-circle auth-input-icon" />
          <select className="auth-input" value={form.securityQuestion}
            onChange={e => set('securityQuestion', e.target.value)}>
            {SECURITY_QUESTIONS.map(q => <option key={q}>{q}</option>)}
          </select>
        </div>
      </div>

      <div className="auth-field">
        <label className="auth-label">Security Answer</label>
        <div className="auth-input-wrap">
          <i className="fa fa-key auth-input-icon" />
          <input className="auth-input" placeholder="Used to reset your password"
            value={form.securityAnswer} onChange={e => set('securityAnswer', e.target.value)} />
        </div>
      </div>

      {error && <p className="auth-error"><i className="fa fa-exclamation-circle" /> {error}</p>}

      <button type="submit" className="auth-btn-primary" disabled={loading}>
        {loading ? <i className="fa fa-spinner fa-spin" /> : <><i className="fa fa-user-plus" /> Create Account</>}
      </button>

      <p className="auth-switch">
        Already have an account?{' '}
        <button type="button" className="auth-link" onClick={onSwitch}>Sign in</button>
      </p>
    </form>
  );
}

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
function ForgotForm({ onBack }) {
  const [step,     setStep]    = useState(1);
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const [answer,   setAnswer]  = useState('');
  const [newPass,  setNewPass] = useState('');
  const [confirm,  setConfirm] = useState('');
  const [error,    setError]   = useState('');
  const [loading,  setLoading] = useState(false);

  function handleUsername(e) {
    e.preventDefault(); setError('');
    if (!username.trim()) { setError('Enter your username.'); return; }
    const users = JSON.parse(localStorage.getItem('plu_users') || '{}');
    const user  = users[username.toLowerCase()];
    if (!user) { setError('Username not found.'); return; }
    setQuestion(user.securityQuestion);
    setStep(2);
  }

  async function handleAnswer(e) {
    e.preventDefault(); setError(''); setLoading(true);
    const result = await verifySecurityAnswer(username.trim(), answer);
    setLoading(false);
    if (result.error) { setError(result.error); return; }
    setStep(3);
  }

  async function handleReset(e) {
    e.preventDefault(); setError('');
    if (newPass.length < 6)    { setError('Password must be at least 6 characters.'); return; }
    if (newPass !== confirm)   { setError('Passwords do not match.'); return; }
    setLoading(true);
    await resetPassword(username.trim(), newPass);
    setLoading(false);
    setStep(4);
  }

  return (
    <div className="auth-form">
      <button type="button" className="auth-back-btn" onClick={onBack}>
        <i className="fa fa-arrow-left" /> Back to sign in
      </button>
      <h2 className="auth-section-title">Reset Password</h2>

      {step === 1 && (
        <form onSubmit={handleUsername} noValidate>
          <div className="auth-field">
            <label className="auth-label">Your Username</label>
            <div className="auth-input-wrap">
              <i className="fa fa-user auth-input-icon" />
              <input className="auth-input" placeholder="radislava94" value={username}
                onChange={e => { setUsername(e.target.value); setError(''); }} />
            </div>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-btn-primary">Continue <i className="fa fa-arrow-right" /></button>
        </form>
      )}

      {step === 2 && (
        <form onSubmit={handleAnswer} noValidate>
          <p className="auth-question-label">{question}</p>
          <div className="auth-field">
            <div className="auth-input-wrap">
              <i className="fa fa-key auth-input-icon" />
              <input className="auth-input" placeholder="Your answer"
                value={answer} onChange={e => { setAnswer(e.target.value); setError(''); }} />
            </div>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-btn-primary" disabled={loading}>
            {loading ? <i className="fa fa-spinner fa-spin" /> : <>Verify <i className="fa fa-check" /></>}
          </button>
        </form>
      )}

      {step === 3 && (
        <form onSubmit={handleReset} noValidate>
          <div className="auth-field">
            <label className="auth-label">New Password</label>
            <div className="auth-input-wrap">
              <i className="fa fa-lock auth-input-icon" />
              <input className="auth-input" type="password" placeholder="Min. 6 characters"
                value={newPass} onChange={e => { setNewPass(e.target.value); setError(''); }} />
            </div>
          </div>
          <div className="auth-field">
            <label className="auth-label">Confirm New Password</label>
            <div className="auth-input-wrap">
              <i className="fa fa-lock auth-input-icon" />
              <input className="auth-input" type="password" placeholder="Repeat password"
                value={confirm} onChange={e => { setConfirm(e.target.value); setError(''); }} />
            </div>
          </div>
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="auth-btn-primary" disabled={loading}>
            {loading ? <i className="fa fa-spinner fa-spin" /> : <>Set New Password <i className="fa fa-check" /></>}
          </button>
        </form>
      )}

      {step === 4 && (
        <div className="auth-success">
          <div className="auth-success-icon">✅</div>
          <p>Password reset successfully!</p>
          <button type="button" className="auth-btn-primary" onClick={onBack}>Sign In Now</button>
        </div>
      )}
    </div>
  );
}

