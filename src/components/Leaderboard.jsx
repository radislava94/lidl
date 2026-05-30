/* eslint-disable react/prop-types */
import { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { getLevelFromXP, LEVEL_THRESHOLDS } from '../utils/scoring';
import { getAllPlayers } from '../utils/auth';

// ─── Demo roster (shown when only 1 registered user exists) ───────────────────
const DEMO_RIVALS = [
  { id: 'r1',  name: 'Emma W.',   av: 'E', store: '3570', allXP: 4820, streak: 18, color: '#e11d48' },
  { id: 'r2',  name: 'Liam K.',   av: 'L', store: '114',  allXP: 4200, streak: 13, color: '#7c3aed' },
  { id: 'r3',  name: 'Sophia M.', av: 'S', store: '204',  allXP: 3580, streak: 10, color: '#0891b2' },
  { id: 'r4',  name: 'Noah P.',   av: 'N', store: '3570', allXP: 2900, streak: 8,  color: '#059669' },
  { id: 'r5',  name: 'Olivia T.', av: 'O', store: '114',  allXP: 2350, streak: 6,  color: '#d97706' },
  { id: 'r6',  name: 'James A.',  av: 'J', store: '204',  allXP: 1920, streak: 5,  color: '#be185d' },
  { id: 'r7',  name: 'Mia B.',    av: 'M', store: '3570', allXP: 1540, streak: 4,  color: '#0e7490' },
  { id: 'r8',  name: 'Lucas R.',  av: 'L', store: '989',  allXP: 1180, streak: 3,  color: '#6d28d9' },
  { id: 'r9',  name: 'Ava D.',    av: 'A', store: '989',  allXP:  870, streak: 2,  color: '#b45309' },
  { id: 'r10', name: 'Mason C.',  av: 'M', store: '114',  allXP:  640, streak: 1,  color: '#166534' },
];
const TABS = [
  { id: 'all',   label: 'All Time' },
  { id: 'week',  label: 'This Week' },
  { id: 'month', label: 'This Month' },
];
function tabXP(p, tab) {
  if (tab === 'week')  return Math.round(p.allXP * 0.18 + p.streak * 20);
  if (tab === 'month') return Math.round(p.allXP * 0.52 + p.streak * 38);
  return p.allXP;
}
function norStore(s) {
  const d = String(s || '').replace(/\D/g, '');
  return d || '3570';
}
// Animated counter
function CountUp({ value, dur = 900 }) {
  const [n, setN] = useState(0);
  const raf = useRef(null);
  useEffect(() => {
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min((now - t0) / dur, 1);
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{n.toLocaleString()}</>;
}
// Avatar
function Av({ letter, size = 44, color, glow, ring }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color || 'linear-gradient(135deg,#0050aa,#003d82)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 900, fontSize: size * 0.38,
      boxShadow: glow
        ? '0 0 0 3px #fff, 0 0 18px 6px rgba(255,208,0,.55), 0 8px 24px rgba(0,0,0,.22)'
        : ring ? '0 0 0 3px rgba(255,255,255,.6)' : '0 4px 12px rgba(0,0,0,.18)',
    }}>{letter}</div>
  );
}
// Podium sub-component
const P_CFG = {
  1: { bg: 'linear-gradient(160deg,#ffd700 0%,#ffb300 50%,#e08800 100%)', medal: '🥇', sh: '0 28px 70px rgba(255,178,0,.50)', h: 224 },
  2: { bg: 'linear-gradient(160deg,#dde4ef 0%,#b8c8dc 50%,#98aec6 100%)', medal: '🥈', sh: '0 22px 50px rgba(100,130,170,.38)', h: 190 },
  3: { bg: 'linear-gradient(160deg,#f4a261 0%,#e07030 50%,#c25020 100%)', medal: '🥉', sh: '0 20px 44px rgba(200,90,30,.35)', h: 170 },
};
function PodCard({ p, pos }) {
  const c = P_CFG[pos];
  return (
    <div className={`lb2-pod lb2-pod-${pos}`} style={{ background: c.bg, boxShadow: c.sh }}>
      <div className="lb2-pod-medal">{c.medal}</div>
      <Av letter={p.av} size={60} color={p.color} ring={p.isMe} />
      <div className="lb2-pod-name">{p.name}{p.isMe && <span className="lb2-you-dot">●</span>}</div>
      <div className="lb2-pod-lv">Level {p.level}</div>
      <div className="lb2-pod-xp"><CountUp value={p.xp} /> XP</div>
    </div>
  );
}
// Rank row in global list
const RANK_BG = {
  1: 'linear-gradient(135deg,#ffd700,#e69900)',
  2: 'linear-gradient(135deg,#dde4ef,#98aec6)',
  3: 'linear-gradient(135deg,#f4a261,#c0622c)',
};
function RankRow({ p }) {
  return (
    <div className={`lb2-rrow${p.isMe ? ' lb2-rrow-me' : ''}`}>
      <div className="lb2-rbadge" style={{
        background: RANK_BG[p.rank] || (p.isMe ? 'linear-gradient(135deg,#0050aa,#003d82)' : '#f1f5f9'),
        color: p.rank <= 3 ? '#fff' : p.isMe ? '#fff' : '#334155',
      }}>
        {p.rank <= 3 ? ['🥇','🥈','🥉'][p.rank-1] : `#${p.rank}`}
      </div>
      <Av letter={p.av} size={40} color={p.color} />
      <div className="lb2-rinfo">
        <div className="lb2-rname">{p.name}{p.isMe && <span className="lb2-you-tag">You</span>}</div>
        <div className="lb2-rsub">Level {p.level}</div>
      </div>
      <div className="lb2-rlv">Lv {p.level}</div>
      <div className="lb2-rxp"><CountUp value={p.xp} /> XP</div>
      <div className="lb2-rstr">🔥 {p.streak}</div>
    </div>
  );
}
// Rival row
function RivalRow({ p, rel }) {
  const isMe = rel === 'me';
  return (
    <div className={`lb2-rivalrow${isMe ? ' lb2-rivalrow-me' : ''}`}>
      <span className={`lb2-rivalrank${rel === 'above' ? ' above' : ''}`}>#{p.rank}</span>
      <Av letter={p.av} size={44} color={p.color} glow={isMe} />
      <div className="lb2-rivalinfo">
        <div className="lb2-rivalname">{p.name}{isMe && <span className="lb2-you-tag">You</span>}</div>
        <div className="lb2-rivalsub">🔥 {p.streak} day streak</div>
      </div>
      <div className="lb2-rivalxp">{p.xp.toLocaleString()} XP</div>
    </div>
  );
}
// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const { state, actions } = useApp();
  const [tab, setTab] = useState('all');

  const { ranked, me, myRank, above, below } = useMemo(() => {
    const myId     = state.authUser?.id;

    // Build pool from all players saved locally
    let pool = getAllPlayers().map(u => ({
      id:     u.id,
      name:   u.name || 'Player',
      av:     (u.name || '?').charAt(0).toUpperCase(),
      store:  '—',
      allXP:  u.xp     || 0,
      streak: u.streak || 0,
      color:  u.avatarColor || '#0050aa',
      isMe:   u.id === myId,
    }));

    // Always add demo rivals when few real players exist
    if (pool.length <= 1) {
      pool = [
        ...pool,
        ...DEMO_RIVALS.map(r => ({ ...r, isMe: false })),
      ];
    }

    const ranked = pool
      .map(p => ({ ...p, xp: tabXP(p, tab), level: getLevelFromXP(tabXP(p, tab)) }))
      .sort((a, b) => b.xp - a.xp)
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const meIdx  = ranked.findIndex(p => p.isMe);
    const meBase = { id: myId || 'me', name: state.user || 'You',
      av: (state.user || 'Y').charAt(0).toUpperCase(),
      store: '—', allXP: state.xp, streak: state.streak,
      color: state.authUser?.avatarColor || '#0050aa', isMe: true };
    const me    = meIdx >= 0 ? ranked[meIdx] : { ...meBase, xp: state.xp, level: getLevelFromXP(state.xp), rank: ranked.length + 1 };
    const above = meIdx > 0 ? ranked[meIdx - 1] : null;
    const below = meIdx >= 0 && meIdx < ranked.length - 1 ? ranked[meIdx + 1] : null;

    return { ranked, me, myRank: me.rank, above, below };
  }, [tab, state.authUser, state.user, state.xp, state.streak]);

  const top3  = ranked.slice(0, 3);
  const top10 = ranked.slice(0, 10);
  const xpGap    = above ? Math.max(0, above.xp - me.xp) : 0;
  const rivalPct = above ? Math.min(100, Math.round((me.xp / Math.max(above.xp, 1)) * 100)) : 100;
  const curLvlXP  = LEVEL_THRESHOLDS[me.level - 1] ?? 0;
  const nextLvlXP = LEVEL_THRESHOLDS[me.level] ?? null;
  const lvlPct    = nextLvlXP ? Math.min(100, Math.round(((me.xp - curLvlXP) / (nextLvlXP - curLvlXP)) * 100)) : 100;

  return (
    <div className="lb2">
      {/* HERO */}
      <section className="lb2-hero">
        <div className="lb2-hero-blur" />
        <div className="lb2-hero-body">
          <div className="lb2-hero-trophy">🏆</div>
          <h1 className="lb2-hero-h">Leaderboard</h1>
          <p className="lb2-hero-p">Compete with coworkers and become the ultimate PLU Master.</p>
          <div className="lb2-hero-stats">
            {[['Rank', `#${myRank}`],['Level', me.level],['Total XP', null],['Streak', `🔥 ${state.streak}`]].map(([lbl, val], i) => (
              <div key={lbl} className="lb2-hstat">
                <span className="lb2-hstat-l">{lbl}</span>
                <span className="lb2-hstat-v">{i === 2 ? <CountUp value={me.xp} dur={1200} /> : val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TABS */}
      <div className="lb2-tabs">
        {TABS.map(t => (
          <button key={t.id} type="button" className={`lb2-tab${tab === t.id ? ' on' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* MY CARD */}
      <section className="lb2-me">
        <div className="lb2-me-glow" />
        <div className="lb2-me-body">
          <div className="lb2-me-row1">
            <Av letter={me.av} size={76} glow />
            <div className="lb2-me-text">
              <div className="lb2-me-name">🔥 {me.name}</div>
              <div className="lb2-me-chips">
                <span className="lb2c gold">Level {me.level}</span>
                <span className="lb2c blue">Rank #{myRank}</span>
                <span className="lb2c slate">Store {me.store}</span>
                <span className="lb2c fire">🔥 {state.streak} Day Streak</span>
              </div>
            </div>
            <div className="lb2-me-xpbig"><CountUp value={me.xp} dur={1000} /><span className="lb2-xpunit">XP</span></div>
          </div>
          <div className="lb2-prog-block">
            <div className="lb2-prog-labels"><span>Level {me.level}</span>{nextLvlXP ? <span>Level {me.level+1} — {(nextLvlXP - me.xp).toLocaleString()} XP away</span> : <span>Max Level 🎉</span>}</div>
            <div className="lb2-track"><div className="lb2-fill lb2f-gold" style={{width:`${lvlPct}%`}} /></div>
          </div>
          {above ? (
            <div className="lb2-prog-block">
              <div className="lb2-prog-labels"><span>You — {me.xp.toLocaleString()} XP</span><span>{above.name} (#{above.rank}) — {above.xp.toLocaleString()} XP</span></div>
              <div className="lb2-track"><div className="lb2-fill lb2f-blue" style={{width:`${rivalPct}%`}} /></div>
              <div className="lb2-rankhint">Only <strong>{xpGap.toLocaleString()} XP</strong> until Rank #{above.rank} 🚀</div>
            </div>
          ) : (
            <div className="lb2-rankhint" style={{marginTop:10}}>👑 You lead this board — keep your streak alive!</div>
          )}
        </div>
      </section>

      {/* PODIUM */}
      <section className="lb2-section">
        <h2 className="lb2-sh"><i className="fa fa-medal"/> Top 3 Podium</h2>
        <div className="lb2-podium">
          {top3[1] && <PodCard p={top3[1]} pos={2} />}
          {top3[0] && <PodCard p={top3[0]} pos={1} />}
          {top3[2] && <PodCard p={top3[2]} pos={3} />}
        </div>
      </section>

      {/* NEARBY RIVALS */}
      {(above || below) && (
        <section className="lb2-section">
          <h2 className="lb2-sh"><i className="fa fa-fire"/> Nearby Rivals</h2>
          <div className="lb2-rivallist">
            {above && <RivalRow p={above} rel="above" />}
            <RivalRow p={me} rel="me" />
            {below && <RivalRow p={below} rel="below" />}
          </div>
          {above && (
            <div className="lb2-rivalmotiv">
              <div className="lb2-rivalmsg">⚡ You need <strong>{xpGap.toLocaleString()} XP</strong> to pass <strong>{above.name}</strong>!</div>
              <div className="lb2-track lb2-track-lg"><div className="lb2-fill lb2f-fire" style={{width:`${rivalPct}%`}} /></div>
              <button type="button" className="lb2-cta" onClick={() => actions.setPage('quiz')}><i className="fa fa-bolt"/> Start Quiz to Catch Up</button>
            </div>
          )}
        </section>
      )}

      {/* GLOBAL RANKINGS */}
      <section className="lb2-section">
        <h2 className="lb2-sh"><i className="fa fa-globe"/> Global Rankings</h2>
        <div className="lb2-rlist">
          {top10.map(p => <RankRow key={p.id} p={p} />)}
        </div>
        {ranked.length > 10 && <div className="lb2-more">Showing top 10 of {ranked.length} players</div>}
      </section>
    </div>
  );
}
