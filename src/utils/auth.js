/**
 * auth.js — Multi-user authentication & storage system
 *
 * Architecture:
 *   localStorage['plu_users']          → { [username]: UserRecord }
 *   localStorage['plu_session']        → { username, rememberMe }
 *   localStorage['plu_progress_<id>']  → UserProgress (per-user)
 *
 * Supabase migration: replace the functions below with Supabase calls.
 * The shape of UserRecord and UserProgress stays identical.
 */

// ─── Keys ────────────────────────────────────────────────────────────────────
const USERS_KEY    = 'plu_users';
const SESSION_KEY  = 'plu_session';
const progressKey  = id => `plu_progress_${id}`;

// ─── Crypto: SHA-256 hash password ───────────────────────────────────────────
export async function hashPassword(password) {
  const encoded = new TextEncoder().encode(password);
  const hash    = await crypto.subtle.digest('SHA-256', encoded);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// ─── Users registry ──────────────────────────────────────────────────────────
function getUsers() {
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '{}'); }
  catch { return {}; }
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

/** Create a new user record */
export async function registerUser({ firstName, lastName, username, email, password, storeNumber, securityQuestion, securityAnswer }) {
  const users = getUsers();

  if (users[username.toLowerCase()])
    return { error: 'Username already taken.' };
  if (Object.values(users).some(u => u.email === email.toLowerCase()))
    return { error: 'Email already registered.' };

  const passwordHash = await hashPassword(password);
  const answerHash   = await hashPassword(securityAnswer.toLowerCase().trim());

  const id = `${username.toLowerCase()}_${Date.now()}`;
  const now = new Date().toISOString();

  /** @type {UserRecord} */
  const user = {
    id,
    firstName,
    lastName,
    username: username.toLowerCase(),
    displayName: `${firstName} ${lastName}`,
    email: email.toLowerCase(),
    passwordHash,
    storeNumber: storeNumber || '',
    role: '',
    avatarColor: randomColor(),
    avatarEmoji: '',
    createdAt: now,
    lastLoginAt: now,
    securityQuestion,
    securityAnswerHash: answerHash,
  };

  users[username.toLowerCase()] = user;
  saveUsers(users);

  // Initialise empty progress for this user
  saveProgress(id, defaultProgress());

  return { user };
}

/** Sign in with username + password */
export async function loginUser(usernameOrEmail, password, rememberMe = false) {
  const users = getUsers();
  const hash  = usernameOrEmail.toLowerCase();

  const user =
    users[hash] ??
    Object.values(users).find(u => u.email === hash);

  if (!user) return { error: 'No account found with that username or email.' };

  const passwordHash = await hashPassword(password);
  if (user.passwordHash !== passwordHash)
    return { error: 'Incorrect password.' };

  // Update last login
  user.lastLoginAt = new Date().toISOString();
  users[user.username] = user;
  saveUsers(users);

  // Write session
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, username: user.username, rememberMe }));

  return { user };
}

/** Restore session from localStorage (called on app boot) */
export function restoreSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    const users = getUsers();
    const user = Object.values(users).find(u => u.id === session.userId);
    return user ?? null;
  } catch { return null; }
}

/** Clear session (logout) */
export function logoutUser() {
  localStorage.removeItem(SESSION_KEY);
}

/** Verify security answer for password reset */
export async function verifySecurityAnswer(username, answer) {
  const users = getUsers();
  const user = users[username.toLowerCase()];
  if (!user) return { error: 'Username not found.' };
  const hash = await hashPassword(answer.toLowerCase().trim());
  if (hash !== user.securityAnswerHash) return { error: 'Incorrect answer.' };
  return { user };
}

/** Change password after security verification */
export async function resetPassword(username, newPassword) {
  const users = getUsers();
  const user = users[username.toLowerCase()];
  if (!user) return { error: 'Username not found.' };
  user.passwordHash = await hashPassword(newPassword);
  users[username.toLowerCase()] = user;
  saveUsers(users);
  return { ok: true };
}

/** Update profile fields (firstName, lastName, avatarColor, avatarEmoji, storeNumber, role) */
export function updateProfile(userId, fields) {
  const users = getUsers();
  const user = Object.values(users).find(u => u.id === userId);
  if (!user) return;
  const allowed = ['firstName','lastName','displayName','avatarColor','avatarEmoji','storeNumber','role'];
  allowed.forEach(k => { if (k in fields) user[k] = fields[k]; });
  if (fields.firstName || fields.lastName) {
    user.displayName = `${user.firstName} ${user.lastName}`;
  }
  users[user.username] = user;
  saveUsers(users);
  return user;
}

/** Change password when already logged in */
export async function changePassword(userId, currentPassword, newPassword) {
  const users = getUsers();
  const user = Object.values(users).find(u => u.id === userId);
  if (!user) return { error: 'User not found.' };
  const currentHash = await hashPassword(currentPassword);
  if (currentHash !== user.passwordHash) return { error: 'Current password is incorrect.' };
  user.passwordHash = await hashPassword(newPassword);
  users[user.username] = user;
  saveUsers(users);
  return { ok: true };
}

/** Get all users (for leaderboard) */
export function getAllUsers() {
  const users = getUsers();
  return Object.values(users).map(u => {
    const progress = getProgress(u.id);
    return { ...u, progress };
  });
}

// ─── Per-user progress ───────────────────────────────────────────────────────
function defaultProgress() {
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
    isDarkMode: false,
    currentPage: 'dashboard',
  };
}

export function getProgress(userId) {
  try {
    const raw = localStorage.getItem(progressKey(userId));
    if (!raw) return defaultProgress();
    return { ...defaultProgress(), ...JSON.parse(raw) };
  } catch { return defaultProgress(); }
}

export function saveProgress(userId, progress) {
  try {
    // Don't store ephemeral UI keys
    const { products, categories, isLoadingProducts, xpPopup, ...rest } = progress;
    localStorage.setItem(progressKey(userId), JSON.stringify(rest));
  } catch { /* quota exceeded */ }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const COLORS = ['#0050AA','#e63946','#2ec4b6','#f4a261','#9b5de5','#06d6a0','#ef476f','#118ab2'];
function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

export const SECURITY_QUESTIONS = [
  "What was the name of your first pet?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favourite film?",
];
