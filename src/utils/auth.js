/**
 * auth.js — Simple localStorage player system.
 * No accounts, no passwords, no internet required.
 */

const PLAYER_KEY  = 'plu_player';
const PLAYERS_KEY = 'plu_players';

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeName(name) {
  return String(name || '').trim();
}

function createProgressDefaults() {
  return {
    xp: 0,
    level: 1,
    streak: 0,
    lastActiveDate: null,
    masteredPLUs: {},
    favorites: {},
    mistakes: {},
    totalCorrect: 0,
    totalAnswered: 0,
    quizzesPlayed: 0,
    studyMinutes: 0,
    learnedToday: 0,
    dailyGoal: 10,
    dailyChallengeDate: null,
    achievements: [],
    _perfectStreak: 0,
    isDarkMode: false,
  };
}

function calcAccuracy(correct, answered) {
  return answered > 0 ? Math.round((correct / answered) * 100) : 0;
}

function toLeaderboardEntry(player, progress = {}) {
  return {
    id: player.id,
    name: player.name,
    avatarColor: player.avatarColor,
    avatarEmoji: player.avatarEmoji,
    storeNumber: player.storeNumber ?? '',
    role: player.role ?? '',
    xp: progress.xp ?? player.xp ?? 0,
    level: progress.level ?? player.level ?? 1,
    streak: progress.streak ?? player.streak ?? 0,
    accuracy: calcAccuracy(progress.totalCorrect ?? player.totalCorrect ?? 0, progress.totalAnswered ?? player.totalAnswered ?? 0),
    masteredProducts: Object.keys(progress.masteredPLUs ?? player.masteredPLUs ?? {}).length,
    achievements: progress.achievements ?? player.achievements ?? [],
    totalCorrect: progress.totalCorrect ?? player.totalCorrect ?? 0,
    totalAnswered: progress.totalAnswered ?? player.totalAnswered ?? 0,
    quizzesPlayed: progress.quizzesPlayed ?? player.quizzesPlayed ?? 0,
    studyMinutes: progress.studyMinutes ?? player.studyMinutes ?? 0,
    masteredPLUs: progress.masteredPLUs ?? player.masteredPLUs ?? {},
    favorites: progress.favorites ?? player.favorites ?? {},
    mistakes: progress.mistakes ?? player.mistakes ?? {},
    isDarkMode: progress.isDarkMode ?? player.isDarkMode ?? false,
  };
}

function getPlayerList() {
  return readJSON(PLAYERS_KEY, []);
}

function setPlayerList(list) {
  writeJSON(PLAYERS_KEY, list);
}

function upsertPlayerListEntry(id, data) {
  const list = getPlayerList();
  const idx = list.findIndex(player => player.id === id);
  const existing = idx >= 0 ? list[idx] : { id };
  const next = { ...existing, ...data, id };
  if (idx >= 0) list[idx] = next;
  else list.push(next);
  setPlayerList(list);
  return next;
}

function getProgressKey(playerId) {
  return `plu_progress_${playerId}`;
}

function buildPlayerFromName(name) {
  const cleanName = normalizeName(name);
  return {
    id: generateId(),
    name: cleanName,
    displayName: cleanName,
    avatarColor: randomColor(),
    avatarEmoji: '',
    storeNumber: '',
    role: '',
    createdAt: new Date().toISOString(),
    xp: 0,
    level: 1,
    streak: 0,
    totalCorrect: 0,
    totalAnswered: 0,
    quizzesPlayed: 0,
    studyMinutes: 0,
    masteredPLUs: {},
    favorites: {},
    mistakes: {},
    achievements: [],
    isDarkMode: false,
  };
}

// ─── Current player ───────────────────────────────────────────────────────────

export function getPlayer() {
  return readJSON(PLAYER_KEY, null);
}

export function setCurrentPlayer(player) {
  writeJSON(PLAYER_KEY, player);
  return player;
}

export function getPlayerById(id) {
  return getPlayerList().find(player => player.id === id) || null;
}

export function findPlayerByName(name) {
  const cleanName = normalizeName(name).toLowerCase();
  if (!cleanName) return null;
  return getPlayerList().find(player => String(player.name || '').trim().toLowerCase() === cleanName) || null;
}

export function createPlayer(name) {
  const player = buildPlayerFromName(name);
  setCurrentPlayer(player);
  upsertPlayerListEntry(player.id, toLeaderboardEntry(player));
  return player;
}

export function loginOrCreatePlayer(name) {
  const existing = findPlayerByName(name);
  if (existing) {
    const loaded = loadPlayer(existing.id);
    return { player: loaded, isReturning: true };
  }
  return { player: createPlayer(name), isReturning: false };
}

export function loadPlayer(playerId) {
  const profile = getPlayerById(playerId);
  if (!profile) return null;
  const progress = getProgress(playerId);
  const player = {
    ...buildPlayerFromName(profile.name || profile.displayName || 'Player'),
    ...profile,
    ...toLeaderboardEntry(profile, progress),
    displayName: profile.displayName || profile.name || 'Player',
  };
  setCurrentPlayer(player);
  return player;
}

export function switchPlayer(playerId) {
  return loadPlayer(playerId);
}

export function updatePlayer(fields) {
  const player = getPlayer();
  if (!player) return null;

  const updated = {
    ...player,
    ...fields,
    name: normalizeName(fields.name ?? player.name),
    displayName: normalizeName(fields.name ?? player.displayName),
  };

  setCurrentPlayer(updated);
  upsertPlayerListEntry(player.id, toLeaderboardEntry(updated, getProgress(player.id)));
  return updated;
}

export function deletePlayer(playerId) {
  const id = playerId || getPlayer()?.id;
  if (!id) return;

  const list = getPlayerList().filter(player => player.id !== id);
  setPlayerList(list);
  localStorage.removeItem(getProgressKey(id));

  const current = getPlayer();
  if (current?.id === id) localStorage.removeItem(PLAYER_KEY);
}

export function resetProgress(playerId) {
  const id = playerId || getPlayer()?.id;
  if (!id) return null;

  const progress = createProgressDefaults();
  writeJSON(getProgressKey(id), progress);

  const current = getPlayer();
  if (current?.id === id) {
    const refreshed = { ...current, ...progress };
    setCurrentPlayer(refreshed);
  }

  const profile = getPlayerById(id);
  if (profile) upsertPlayerListEntry(id, toLeaderboardEntry(profile, progress));
  return progress;
}

export function logoutPlayer() {
  localStorage.removeItem(PLAYER_KEY);
}

// ─── Progress ─────────────────────────────────────────────────────────────────

export function getProgress(playerId) {
  return { ...createProgressDefaults(), ...readJSON(getProgressKey(playerId), {}) };
}

export function saveProgress(playerId, progress) {
  try {
    const {
      products, categories, isLoadingProducts, xpPopup,
      authUser, currentPage, playerDirectoryVersion, ...rest
    } = progress;

    const nextProgress = { ...createProgressDefaults(), ...rest };
    writeJSON(getProgressKey(playerId), nextProgress);

    const profile = getPlayerById(playerId) || getPlayer();
    if (profile) {
      upsertPlayerListEntry(playerId, toLeaderboardEntry(profile, nextProgress));
    }

    const current = getPlayer();
    if (current?.id === playerId) {
      setCurrentPlayer({
        ...current,
        ...toLeaderboardEntry(current, nextProgress),
        displayName: current.displayName || current.name || 'Player',
      });
    }
  } catch {
    /* storage quota exceeded — progress already in memory */
  }
}

// ─── Local leaderboard ────────────────────────────────────────────────────────

export function getAllPlayers() {
  const players = getPlayerList();
  return players
    .map(player => {
      const progress = getProgress(player.id);
      return toLeaderboardEntry(player, progress);
    })
    .sort((a, b) => (b.xp - a.xp) || a.name.localeCompare(b.name));
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const COLORS = ['#0050AA','#e63946','#2ec4b6','#f4a261','#9b5de5','#06d6a0','#ef476f','#118ab2'];
function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

// Kept for backward compat — not used in the no-auth system
export const SECURITY_QUESTIONS = [];

