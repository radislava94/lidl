/**
 * auth.js — Simple localStorage player system.
 * No accounts, no passwords, no internet required.
 */

const PLAYER_KEY  = 'plu_player';
const PLAYERS_KEY = 'plu_players';

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

// ─── Current player ───────────────────────────────────────────────────────────

export function getPlayer() {
  try {
    const raw = localStorage.getItem(PLAYER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function createPlayer(name) {
  const player = {
    id:          generateId(),
    name:        name.trim(),
    displayName: name.trim(),
    avatarColor: randomColor(),
    avatarEmoji: '',
    storeNumber: '',
    role:        '',
    createdAt:   new Date().toISOString(),
  };
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
  _upsertInList(player.id, {
    name:        player.name,
    avatarColor: player.avatarColor,
    xp:          0,
    level:       1,
    streak:      0,
  });
  return player;
}

export function updatePlayer(fields) {
  const player = getPlayer();
  if (!player) return null;
  const updated = {
    ...player,
    ...fields,
    displayName: fields.name ?? player.displayName,
  };
  localStorage.setItem(PLAYER_KEY, JSON.stringify(updated));
  const listUpdate = {};
  if (fields.name)        listUpdate.name        = fields.name;
  if (fields.avatarColor) listUpdate.avatarColor = fields.avatarColor;
  if (Object.keys(listUpdate).length) _upsertInList(player.id, listUpdate);
  return updated;
}

export function logoutPlayer() {
  localStorage.removeItem(PLAYER_KEY);
}

// ─── Progress ─────────────────────────────────────────────────────────────────

const _defaults = () => ({
  xp: 0, level: 1, streak: 0, lastActiveDate: null,
  masteredPLUs: {}, favorites: {}, mistakes: {},
  totalCorrect: 0, totalAnswered: 0, quizzesPlayed: 0,
  studyMinutes: 0, learnedToday: 0, dailyGoal: 10,
  dailyChallengeDate: null, achievements: [], _perfectStreak: 0,
  isDarkMode: false,
});

export function getProgress(playerId) {
  try {
    const raw = localStorage.getItem(`plu_progress_${playerId}`);
    return raw ? { ..._defaults(), ...JSON.parse(raw) } : _defaults();
  } catch { return _defaults(); }
}

export function saveProgress(playerId, progress) {
  try {
    // Strip UI-only fields before storing
    const {
      products, categories, isLoadingProducts, xpPopup,
      authUser, currentPage, isAuthLoading, ...rest
    } = progress;
    localStorage.setItem(`plu_progress_${playerId}`, JSON.stringify(rest));
    _upsertInList(playerId, {
      xp:     rest.xp     ?? 0,
      level:  rest.level  ?? 1,
      streak: rest.streak ?? 0,
    });
  } catch { /* storage quota exceeded — progress already in memory */ }
}

// ─── Local leaderboard ────────────────────────────────────────────────────────

export function getAllPlayers() {
  try {
    const raw = localStorage.getItem(PLAYERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _upsertInList(id, data) {
  try {
    const raw  = localStorage.getItem(PLAYERS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    const idx  = list.findIndex(p => p.id === id);
    if (idx >= 0) list[idx] = { ...list[idx], ...data };
    else          list.push({ id, ...data });
    localStorage.setItem(PLAYERS_KEY, JSON.stringify(list));
  } catch { /* ignore */ }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = ['#0050AA','#e63946','#2ec4b6','#f4a261','#9b5de5','#06d6a0','#ef476f','#118ab2'];
function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

// Kept for backward compat — not used in the no-auth system
export const SECURITY_QUESTIONS = [];

