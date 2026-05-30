import { useEffect } from 'react';
import { useApp }     from '../store/AppContext';
import { pct }        from '../utils/helpers';
import { getXPProgress } from '../utils/scoring';

export default function Dashboard() {
  const { state, actions } = useApp();

  // Update streak when dashboard mounts (first interaction of the day)
  useEffect(() => { actions.updateStreak(); }, []); // eslint-disable-line

  const accuracy = state.totalAnswered > 0
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100)
    : 0;

  const todayPct = pct(state.learnedToday, state.dailyGoal);
  const { level, progress, max, percentage } = getXPProgress(state.xp);

  // Top missed products
  const topMissed = Object.entries(state.mistakes)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([plu, count]) => ({ product: state.products.find(p => p.plu === plu), count }))
    .filter(x => x.product);

  return (
    <div className="page active">
      <div className="page-header">
        <h2 className="page-title">Dashboard <span className="wave">👋</span></h2>
        <p className="page-sub">Welcome back, <strong>{state.user}</strong>!</p>
      </div>

      {/* XP level bar */}
      <div className="section-card" style={{ marginBottom: 20 }}>
        <div className="level-progress-row">
          <span className="level-badge">Level {level}</span>
          <div className="progress-bar-track" style={{ flex: 1 }}>
            <div className="progress-bar-fill yellow-fill" style={{ width: percentage + '%' }} />
          </div>
          <span style={{ fontSize: '.82rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {progress} / {max} XP
          </span>
        </div>
      </div>

      {/* Stats */}
      <div className="stats-row">
        <div className="stat-card blue">
          <i className="fa fa-tags stat-icon" />
          <div className="stat-val">{Object.keys(state.masteredPLUs).length}</div>
          <div className="stat-lbl">PLUs Mastered</div>
        </div>
        <div className="stat-card yellow">
          <i className="fa fa-fire stat-icon" />
          <div className="stat-val">{state.streak}</div>
          <div className="stat-lbl">Day Streak</div>
        </div>
        <div className="stat-card red">
          <i className="fa fa-star stat-icon" />
          <div className="stat-val">{state.xp}</div>
          <div className="stat-lbl">Total XP</div>
        </div>
        <div className="stat-card gray">
          <i className="fa fa-check-circle stat-icon" />
          <div className="stat-val">{accuracy}%</div>
          <div className="stat-lbl">Accuracy</div>
        </div>
      </div>

      {/* Today's progress */}
      <div className="section-card">
        <div className="section-card-header">
          <h3><i className="fa fa-sun" /> Today's Progress</h3>
          <span className="badge-pill">{state.learnedToday} / {state.dailyGoal} goal</span>
        </div>
        <div className="progress-bar-wrap">
          <div className="progress-bar-track">
            <div className="progress-bar-fill blue-fill" style={{ width: todayPct + '%' }} />
          </div>
          <span>{todayPct}%</span>
        </div>
        <div className="quick-actions">
          <button className="btn-primary" onClick={() => actions.setPage('learn')}>
            <i className="fa fa-book-open" /> Start Learn Path
          </button>
          <button className="btn-yellow" onClick={() => actions.setPage('quiz')}>
            <i className="fa fa-bolt" /> Daily Challenge
          </button>
        </div>
      </div>

      {/* Category overview */}
      <div className="section-card">
        <div className="section-card-header">
          <h3><i className="fa fa-th-large" /> Categories</h3>
          <a href="#" className="link-sm" onClick={e => { e.preventDefault(); actions.setPage('categories'); }}>See all</a>
        </div>
        {state.categories.length === 0 ? (
          <div className="loading-screen"><div className="spinner" /></div>
        ) : (
          <div className="cat-grid">
            {state.categories.map(cat => {
              const mastered = cat.products.filter(p => state.masteredPLUs[p.plu]).length;
              return (
                <div key={cat.id} className="cat-mini-card" onClick={() => actions.setPage('categories')}>
                  <div className="cat-mini-emoji">{cat.emoji}</div>
                  <div className="cat-mini-name">{cat.name}</div>
                  <div className="cat-mini-count">{mastered}/{cat.count}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Most missed */}
      <div className="section-card">
        <div className="section-card-header">
          <h3><i className="fa fa-exclamation-circle" /> Most Missed</h3>
          <a href="#" className="link-sm" onClick={e => { e.preventDefault(); actions.setPage('mistakes'); }}>Review all</a>
        </div>
        {topMissed.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: '.9rem' }}>No mistakes tracked yet — keep quizzing!</p>
        ) : (
          <div className="missed-list">
            {topMissed.map(({ product: p, count }) => (
              <div key={p.plu} className="missed-item">
                <div className="missed-emoji">{p.emoji}</div>
                <div>
                  <div className="missed-name">{p.name}</div>
                  <div className="missed-plu">PLU: {p.plu}</div>
                </div>
                <div className="missed-times">{count}×</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
