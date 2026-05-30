/* eslint-disable react/prop-types */
import { useMemo, useState, useEffect, useRef } from 'react';
import { useApp } from '../store/AppContext';
import { getLevelFromXP, LEVEL_THRESHOLDS } from '../utils/scoring';
import { getAllPlayers } from '../utils/auth';

// ─── Title by level ───────────────────────────────────────────────────────────
const TITLES = [
  'PLU Rookie',   // 1
  'PLU Rookie',   // 2
  'PLU Learner',  // 3
  'PLU Learner',  // 4
  'PLU Pro',      // 5
  'PLU Pro',      // 6
  'PLU Expert',   // 7
  'PLU Expert',   // 8
  'PLU Champion', // 9
  'PLU Champion', // 10
  'PLU Master',   // 11+
];
function getTitle(level) {
  return TITLES[Math.min(level - 1, TITLES.length - 1)];
}

// ─── Animated counter ─────────────────────────────────────────────────────────
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

// ─── Avatar ───────────────────────────────────────────────────────────────────
function Av({ player, size = 44, glow, ring }) {
  const letter = (player?.name || '?').charAt(0).toUpperCase();
  const color  = player?.avatarColor || '#0050aa';
  const emoji  = player?.avatarEmoji || '';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: '#fff', fontWeight: 900, fontSize: emoji ? size * 0.55 : size * 0.38,
      boxShadow: glow
        ? '0 0 0 3px #fff, 0 0 18px 6px rgba(255,208,0,.55), 0 8px 24px rgba(0,0,0,.22)'
        : ring ? '0 0 0 3px rgba(255,255,255,.6)' : '0 4px 12px rgba(0,0,0,.18)',
    }}>{emoji || letter}</div>
  );
}

// ─── Podium card ──────────────────────────────────────────────────────────────
const POD_CFG = {
  1: { bg: 'linear-gradient(160deg,#ffd700 0%,#ffb300 50%,#e08800 100%)', medal: '🥇', sh: '0 28px 70px rgba(255,178,0,.50)' },
  2: { bg: 'linear-gradient(160deg,#dde4ef 0%,#b8c8dc 50%,#98aec6 100%)', medal: '🥈', sh: '0 22px 50px rgba(100,130,170,.38)' },
  3: { bg: 'linear-gradient(160deg,#f4a261 0%,#e07030 50%,#c25020 100%)', medal: '🥉', sh: '0 20px 44px rgba(200,90,30,.35)' },
};
function PodCard({ p, pos }) {
  const c = POD_CFG[pos];
  return (
    <div className={`lb2-pod lb2-pod-${pos}`} style={{ background: c.bg, boxShadow: c.sh }}>
      <div className="lb2-pod-medal">{c.medal}</div>
      <Av player={p} size={60} ring={p.isMe} />
      <div className="lb2-pod-name">
        {p.name}
        {p.isMe && <span className="lb2-you-dot"> ●</span>}
      </div>
      {p.storeNumber && <div className="lb2-pod-store">🏪 {p.storeNumber}</div>}
      <div className="lb2-pod-lv">Level {p.level}</div>
      <div className="lb2-pod-xp"><CountUp value={p.xp} /> XP</div>
    </div>
  );
}

// ─── Rank row ─────────────────────────────────────────────────────────────────
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
        {p.rank <= 3 ? ['🥇','🥈','🥉'][p.rank - 1] : `#${p.rank}`}
      </div>
      <Av player={p} size={40} />
      <div className="lb2-rinfo">
        <div className="lb2-rname">
          {p.name}
          {p.isMe && <span className="lb2-you-tag">YOU</span>}
        </div>
        <div className="lb2-rsub">
          {p.storeNumber ? `🏪 ${p.storeNumber} · ` : ''}
          {getTitle(p.level)} · {p.accuracy}% accuracy
        </div>
      </div>
      <div className="lb2-rlv">Lv {p.level}</div>
      <div className="lb2-rxp"><CountUp value={p.xp} /> XP</div>
      <div className="lb2-rstr">🔥 {p.streak}</div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Leaderboard() {
  const { state, actions } = useApp();
  const myId = state.authUser?.id;

  // Rebuild whenever XP/streak change or the player directory changes
  const { ranked, me } = useMemo(() => {
    // Only real players saved in localStorage — no fake data
    const raw = getAllPlayers();

    const pool = raw.map(u => ({
      id:          u.id,
      name:        u.name || 'Player',
      avatarColor: u.avatarColor,
      avatarEmoji: u.avatarEmoji || '',
      storeNumber: u.storeNumber || '',
      xp:          u.xp     || 0,
      level:       getLevelFromXP(u.xp || 0),
      streak:      u.streak  || 0,
      accuracy:    u.accuracy || 0,
      isMe:        u.id === myId,
    }));

    // Sort: XP desc → level desc → streak desc
    const ranked = pool
      .sort((a, b) => (b.xp - a.xp) || (b.level - a.level) || (b.streak - a.streak))
      .map((p, i) => ({ ...p, rank: i + 1 }));

    const me = ranked.find(p => p.isMe) || null;
    return { ranked, me };

  // Re-run when XP/streak/accuracy or directory changes
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    state.playerDirectoryVersion,
    state.xp,
    state.streak,
    state.totalCorrect,
    state.totalAnswered,
    myId,
  ]);

  const myXP      = me?.xp    ?? (state.xp || 0);
  const myLevel   = me?.level ?? getLevelFromXP(myXP);
  const myStreak  = me?.streak ?? (state.streak || 0);
  const myAccuracy = me?.accuracy ?? (
    state.totalAnswered > 0
      ? Math.round((state.totalCorrect / state.totalAnswered) * 100)
      : 0
  );

  const curLvlXP  = LEVEL_THRESHOLDS[myLevel - 1] ?? 0;
  const nextLvlXP = LEVEL_THRESHOLDS[myLevel]     ?? null;
  const lvlPct    = nextLvlXP
    ? Math.min(100, Math.round(((myXP - curLvlXP) / (nextLvlXP - curLvlXP)) * 100))
    : 100;

  const above    = me && me.rank > 1 ? ranked[me.rank - 2] : null;
  const xpGap    = above ? Math.max(0, above.xp - myXP) : 0;
  const rivalPct = above ? Math.min(100, Math.round((myXP / Math.max(above.xp, 1)) * 100)) : 100;

  const top3 = ranked.slice(0, 3);

  // ── Empty state ────────────────────────────────────────────────────────────
  if (ranked.length === 0) {
    return (
      <div className="lb2">
        <section className="lb2-hero">
          <div className="lb2-hero-blur" />
          <div className="lb2-hero-body">
            <div className="lb2-hero-trophy">🏆</div>
            <h1 className="lb2-hero-h">Leaderboard</h1>
            <p className="lb2-hero-p">No players yet.</p>
          </div>
        </section>
        <div style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ color: '#64748b', marginBottom: 20, fontSize: 16 }}>
            Create your first player to start competing.
          </p>
          <button type="button" className="lb2-cta" onClick={() => actions.logout()}>
            <i className="fa fa-user-plus" /> Create Player
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="lb2">

      {/* HERO */}
      <section className="lb2-hero">
        <div className="lb2-hero-blur" />
        <div className="lb2-hero-body">
          <div className="lb2-hero-trophy">🏆</div>
          <h1 className="lb2-hero-h">Leaderboard</h1>
          <p className="lb2-hero-p">Rankings based on real progress — only players on this device.</p>
          {me && (
            <div className="lb2-hero-stats">
              {[
                ['Rank',     `#${me.rank}`],
                ['Level',    me.level],
                ['Total XP', null],
                ['Streak',   `🔥 ${myStreak}`],
                ['Accuracy', `${myAccuracy}%`],
              ].map(([lbl, val], i) => (
                <div key={lbl} className="lb2-hstat">
                  <span className="lb2-hstat-l">{lbl}</span>
                  <span className="lb2-hstat-v">
                    {i === 2 ? <CountUp value={myXP} dur={1200} /> : val}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* MY CARD */}
      {me && (
        <section className="lb2-me">
          <div className="lb2-me-glow" />
          <div className="lb2-me-body">
            <div className="lb2-me-row1">
              <Av player={me} size={76} glow />
              <div className="lb2-me-text">
                <div className="lb2-me-name">
                  {me.name}
                  <span className="lb2-you-tag" style={{ marginLeft: 8 }}>YOU</span>
                </div>
                <div className="lb2-me-chips">
                  <span className="lb2c gold">Level {me.level}</span>
                  <span className="lb2c blue">{getTitle(me.level)}</span>
                  <span className="lb2c fire">🔥 {myStreak} Day Streak</span>
                  <span className="lb2c slate">{myAccuracy}% Accuracy</span>
                  {me.storeNumber && <span className="lb2c slate">🏪 {me.storeNumber}</span>}
                </div>
              </div>
              <div className="lb2-me-xpbig">
                <CountUp value={myXP} dur={1000} />
                <span className="lb2-xpunit"> XP</span>
              </div>
            </div>

            {/* Level progress */}
            <div className="lb2-prog-block">
              <div className="lb2-prog-labels">
                <span>Level {me.level}</span>
                {nextLvlXP
                  ? <span>Level {me.level + 1} — {(nextLvlXP - myXP).toLocaleString()} XP away</span>
                  : <span>Max Level 🎉</span>}
              </div>
              <div className="lb2-track">
                <div className="lb2-fill lb2f-gold" style={{ width: `${lvlPct}%` }} />
              </div>
            </div>

            {/* Rival chase bar */}
            {above ? (
              <div className="lb2-prog-block">
                <div className="lb2-prog-labels">
                  <span>You — {myXP.toLocaleString()} XP</span>
                  <span>{above.name} (#{above.rank}) — {above.xp.toLocaleString()} XP</span>
                </div>
                <div className="lb2-track">
                  <div className="lb2-fill lb2f-blue" style={{ width: `${rivalPct}%` }} />
                </div>
                <div className="lb2-rankhint">
                  Only <strong>{xpGap.toLocaleString()} XP</strong> to reach Rank #{above.rank} 🚀
                </div>
              </div>
            ) : (
              <div className="lb2-rankhint" style={{ marginTop: 10 }}>
                👑 You lead the board — keep your streak alive!
              </div>
            )}
          </div>
        </section>
      )}

      {/* PODIUM — top 3 only when ≥ 3 real players */}
      {top3.length >= 3 && (
        <section className="lb2-section">
          <h2 className="lb2-sh"><i className="fa fa-medal" /> Top 3 Podium</h2>
          <div className="lb2-podium">
            {top3[1] && <PodCard p={top3[1]} pos={2} />}
            {top3[0] && <PodCard p={top3[0]} pos={1} />}
            {top3[2] && <PodCard p={top3[2]} pos={3} />}
          </div>
        </section>
      )}

      {/* CATCH-UP — only shown when there's someone above the current player */}
      {above && me && (
        <section className="lb2-section">
          <h2 className="lb2-sh"><i className="fa fa-fire" /> Catch Up</h2>
          <div className="lb2-rivallist">
            <div className="lb2-rivalrow">
              <span className="lb2-rivalrank above">#{above.rank}</span>
              <Av player={above} size={44} />
              <div className="lb2-rivalinfo">
                <div className="lb2-rivalname">{above.name}</div>
                <div className="lb2-rivalsub">
                  {above.storeNumber ? `🏪 ${above.storeNumber} · ` : ''}
                  Lv {above.level} · {above.accuracy}% acc · 🔥 {above.streak}
                </div>
              </div>
              <div className="lb2-rivalxp">{above.xp.toLocaleString()} XP</div>
            </div>
            <div className="lb2-rivalrow lb2-rivalrow-me">
              <span className="lb2-rivalrank">#{me.rank}</span>
              <Av player={me} size={44} glow />
              <div className="lb2-rivalinfo">
                <div className="lb2-rivalname">
                  {me.name} <span className="lb2-you-tag">YOU</span>
                </div>
                <div className="lb2-rivalsub">
                  {me.storeNumber ? `🏪 ${me.storeNumber} · ` : ''}
                  Lv {me.level} · {me.accuracy}% acc · 🔥 {me.streak}
                </div>
              </div>
              <div className="lb2-rivalxp">{myXP.toLocaleString()} XP</div>
            </div>
          </div>
          <div className="lb2-rivalmotiv">
            <div className="lb2-rivalmsg">
              ⚡ You need <strong>{xpGap.toLocaleString()} XP</strong> to pass <strong>{above.name}</strong>!
            </div>
            <div className="lb2-track lb2-track-lg">
              <div className="lb2-fill lb2f-fire" style={{ width: `${rivalPct}%` }} />
            </div>
            <button type="button" className="lb2-cta" onClick={() => actions.setPage('quiz')}>
              <i className="fa fa-bolt" /> Start Quiz to Catch Up
            </button>
          </div>
        </section>
      )}

      {/* ALL PLAYERS */}
      <section className="lb2-section">
        <h2 className="lb2-sh"><i className="fa fa-list-ol" /> All Players</h2>
        <div className="lb2-rlist">
          {ranked.map(p => <RankRow key={p.id} p={p} />)}
        </div>
        {ranked.length === 1 && (
          <p style={{ textAlign: 'center', color: '#94a3b8', marginTop: 16, fontSize: 14 }}>
            More players will appear here as they join on this device.
          </p>
        )}
      </section>

    </div>
  );
}


