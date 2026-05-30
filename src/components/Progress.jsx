import { useApp }         from '../store/AppContext';
import { getXPProgress }  from '../utils/scoring';
import { pct }            from '../utils/helpers';

// ── Achievement definitions ────────────────────────────────────────────────
function buildAchievements(state) {
  const masteredCount  = Object.keys(state.masteredPLUs).length;
  const totalProducts  = state.products.length;
  const accuracy       = state.totalAnswered > 0
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100) : 0;

  return [
    { id: 'first_steps',  label: 'First Steps',    icon: '👶', desc: 'Master your first PLU',       earned: masteredCount >= 1  },
    { id: 'ten',          label: 'Ten Down',        icon: '🔟', desc: 'Master 10 PLUs',              earned: masteredCount >= 10 },
    { id: 'halfway',      label: 'Halfway There',   icon: '🌗', desc: 'Master 50% of all products', earned: masteredCount >= totalProducts / 2 },
    { id: 'full_house',   label: 'Full House',      icon: '🏠', desc: 'Master every product',       earned: masteredCount >= totalProducts },
    { id: 'streak_3',     label: '3-Day Streak',    icon: '🔥', desc: 'Log in 3 days in a row',     earned: state.streak >= 3  },
    { id: 'streak_7',     label: 'Week Warrior',    icon: '📅', desc: 'Log in 7 days in a row',     earned: state.streak >= 7  },
    { id: 'quiz_fan',     label: 'Quiz Fan',        icon: '🎯', desc: 'Play 5 quizzes',             earned: state.quizzesPlayed >= 5 },
    { id: 'sharp_mind',   label: 'Sharp Mind',      icon: '🧠', desc: '90%+ overall accuracy',      earned: accuracy >= 90 && state.totalAnswered >= 20 },
    { id: 'xp_500',       label: 'Rising Star',     icon: '⭐', desc: 'Earn 500 XP',                earned: state.xp >= 500 },
    { id: 'xp_2000',      label: 'Superstar',       icon: '🌟', desc: 'Earn 2000 XP',               earned: state.xp >= 2000 },
  ];
}

// ── Per-category breakdown ─────────────────────────────────────────────────
function CategoryProgress({ categories, products, masteredPLUs }) {
  return (
    <div className="section-card">
      <h3 className="stat-label" style={{ marginBottom: 16 }}>Category Breakdown</h3>
      {categories.map(cat => {
        const catProducts  = products.filter(p => p.category === cat.id);
        const catMastered  = catProducts.filter(p => masteredPLUs[p.plu]).length;
        const percentage   = pct(catMastered, catProducts.length);
        return (
          <div key={cat.id} className="cat-progress-row">
            <div className="cat-progress-label">
              <span>{cat.emoji} {cat.name}</span>
              <span className="cat-progress-count">{catMastered}/{catProducts.length}</span>
            </div>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: percentage + '%', background: cat.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Weekly activity chart (simulated with stored data) ────────────────────
function WeeklyChart({ learnedToday }) {
  const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // Simulate past 7-day activity; today = last bar
  const todayIdx = new Date().getDay(); // 0=Sun
  const ordered  = [...Array(7).keys()].map(i => {
    const idx = (todayIdx + i) % 7;
    return { label: DAY_LABELS[idx === 0 ? 6 : idx - 1], value: i === 6 ? learnedToday : Math.round(Math.random() * 8) };
  });

  const maxVal = Math.max(...ordered.map(d => d.value), 1);

  return (
    <div className="section-card">
      <h3 className="stat-label" style={{ marginBottom: 16 }}>This Week</h3>
      <div className="weekly-chart">
        {ordered.map((d, i) => (
          <div key={i} className="week-bar-col">
            <div className="week-bar-track">
              <div className="week-bar" style={{ height: pct(d.value, maxVal) + '%' }} />
            </div>
            <div className="week-bar-label">{d.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Achievements grid ──────────────────────────────────────────────────────
function Achievements({ achievements }) {
  return (
    <div className="section-card">
      <h3 className="stat-label" style={{ marginBottom: 16 }}>
        Achievements
        <span className="badge-count"> {achievements.filter(a => a.earned).length}/{achievements.length}</span>
      </h3>
      <div className="achievements-grid">
        {achievements.map(a => (
          <div key={a.id} className={`achievement-badge${a.earned ? ' earned' : ''}`} title={a.desc}>
            <div className="ach-icon">{a.icon}</div>
            <div className="ach-label">{a.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main export ────────────────────────────────────────────────────────────
export default function Progress() {
  const { state } = useApp();

  const xpProgress     = getXPProgress(state.xp);
  const accuracy       = state.totalAnswered > 0
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100) : 0;
  const masteredCount  = Object.keys(state.masteredPLUs).length;
  const achievements   = buildAchievements(state);

  return (
    <div className="page active">
      <div className="page-header">
        <h2 className="page-title"><i className="fa fa-chart-bar" /> Progress</h2>
        <p className="page-sub">Track your learning journey</p>
      </div>

      {/* XP Level card */}
      <div className="section-card">
        <div className="level-progress-row">
          <div className="level-badge">Lv {xpProgress.level}</div>
          <div style={{ flex: 1, margin: '0 12px' }}>
            <div className="progress-bar-track">
              <div className="progress-bar-fill" style={{ width: xpProgress.percentage + '%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginTop: 4, color: 'var(--text-sec)' }}>
              <span>{xpProgress.progress} XP</span>
              <span>{xpProgress.max} XP</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: 700, fontSize: '1.2rem' }}>{state.xp}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-sec)' }}>Total XP</div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-value">{masteredCount}</div>
          <div className="stat-label">PLUs Mastered</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{state.streak}</div>
          <div className="stat-label">Day Streak</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{accuracy}%</div>
          <div className="stat-label">Accuracy</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{state.quizzesPlayed}</div>
          <div className="stat-label">Quizzes Played</div>
        </div>
      </div>

      {/* Additional stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-value">{state.totalAnswered}</div>
          <div className="stat-label">Total Answers</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{state.totalCorrect}</div>
          <div className="stat-label">Correct</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{state.studyMinutes}</div>
          <div className="stat-label">Study Minutes</div>
        </div>
      </div>

      <WeeklyChart learnedToday={state.learnedToday} />

      <CategoryProgress
        categories={state.categories}
        products={state.products}
        masteredPLUs={state.masteredPLUs}
      />

      <Achievements achievements={achievements} />
    </div>
  );
}
