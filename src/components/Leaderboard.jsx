import { useState, useMemo } from 'react';
import { useApp }            from '../store/AppContext';
import { getXPProgress }     from '../utils/scoring';

// ── Fake competitor data ───────────────────────────────────────────────────
const FAKE_PLAYERS = [
  { name: 'Emma W.',    store: 'Store #42', xp: 3480, streak: 14, quizzes: 22, avatar: '👩' },
  { name: 'Liam K.',    store: 'Store #7',  xp: 2950, streak: 9,  quizzes: 18, avatar: '👨' },
  { name: 'Sophia M.',  store: 'Store #42', xp: 2100, streak: 7,  quizzes: 14, avatar: '👩‍🦱' },
  { name: 'Noah P.',    store: 'Store #15', xp: 1840, streak: 5,  quizzes: 11, avatar: '🧑' },
  { name: 'Olivia T.',  store: 'Store #7',  xp: 1200, streak: 3,  quizzes: 8,  avatar: '👩‍🦰' },
  { name: 'James A.',   store: 'Store #42', xp:  900, streak: 2,  quizzes: 6,  avatar: '👦' },
  { name: 'Mia B.',     store: 'Store #99', xp:  640, streak: 1,  quizzes: 4,  avatar: '👧' },
  { name: 'Lucas R.',   store: 'Store #15', xp:  310, streak: 0,  quizzes: 2,  avatar: '🧒' },
];

const TABS = ['All Time', 'This Week', 'My Store'];

const MEDAL = ['🥇', '🥈', '🥉'];

export default function Leaderboard() {
  const { state } = useApp();
  const [tab, setTab] = useState('All Time');

  const xpProgress = getXPProgress(state.xp);

  const players = useMemo(() => {
    const me = {
      name:    state.user || 'You',
      store:   state.store || 'My Store',
      xp:      state.xp,
      streak:  state.streak,
      quizzes: state.quizzesPlayed,
      avatar:  '🙋',
      isMe:    true,
    };

    let list = [...FAKE_PLAYERS.map(p => ({ ...p, isMe: false })), me];

    if (tab === 'This Week') {
      // Simulate weekly by halving XP
      list = list.map(p => ({ ...p, xp: Math.round(p.xp * (p.isMe ? 1 : 0.15)) }));
    } else if (tab === 'My Store') {
      list = list.filter(p => p.isMe || p.store === (state.store || 'Store #42'));
    }

    return list.sort((a, b) => b.xp - a.xp);
  }, [tab, state.xp, state.streak, state.quizzesPlayed, state.user, state.store]);

  const myRank = players.findIndex(p => p.isMe) + 1;

  return (
    <div className="page active">
      <div className="page-header">
        <h2 className="page-title"><i className="fa fa-trophy" /> Leaderboard</h2>
        <p className="page-sub">See how you compare</p>
      </div>

      {/* Your rank summary */}
      <div className="section-card your-rank-card">
        <div className="rank-avatar">{state.user ? state.user.charAt(0).toUpperCase() : '?'}</div>
        <div className="rank-info">
          <div className="rank-name">{state.user || 'You'}</div>
          <div className="rank-meta">Rank #{myRank} · Level {xpProgress.level} · {state.xp} XP</div>
        </div>
        <div className="rank-badge">#{myRank}</div>
      </div>

      {/* Tabs */}
      <div className="tabs-row">
        {TABS.map(t => (
          <button key={t} type="button" className={`tab-btn${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="leaderboard-list">
        {players.map((player, i) => (
          <div key={player.name + i} className={`lb-row${player.isMe ? ' lb-me' : ''}`}>
            <div className="lb-rank">
              {i < 3 ? MEDAL[i] : <span className="lb-num">{i + 1}</span>}
            </div>
            <div className="lb-avatar">{player.avatar}</div>
            <div className="lb-info">
              <div className="lb-name">{player.name}{player.isMe && <span className="you-tag">You</span>}</div>
              <div className="lb-meta">{player.store} · 🔥{player.streak} · {player.quizzes} quizzes</div>
            </div>
            <div className="lb-xp">
              <div className="lb-xp-val">{player.xp}</div>
              <div className="lb-xp-label">XP</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
