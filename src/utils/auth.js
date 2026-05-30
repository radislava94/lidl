/**
 * auth.js — Supabase-based authentication & user data
 *
 * Tables (run SQL in Supabase SQL Editor — see README):
 *   public.profiles       — user profile info
 *   public.user_progress  — per-user game progress (XP, level, etc.)
 */
import { supabase } from './supabaseClient';

// ─── Register ─────────────────────────────────────────────────────────────────
export async function registerUser({ firstName, lastName, username, email, password, storeNumber }) {
  // Check username uniqueness (profiles is publicly readable)
  const { data: existingUser } = await supabase
    .from('profiles')
    .select('id')
    .eq('username', username.toLowerCase())
    .maybeSingle();

  if (existingUser) return { error: 'Username already taken.' };

  // Supabase Auth signup
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: email.toLowerCase(),
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, username: username.toLowerCase() },
    },
  });

  if (authError) {
    if (authError.message.toLowerCase().includes('already registered')) return { error: 'Email already registered.' };
    return { error: authError.message };
  }

  const userId = authData.user.id;
  const color  = randomColor();

  // Insert profile row
  const { error: profileError } = await supabase.from('profiles').insert({
    id:           userId,
    first_name:   firstName,
    last_name:    lastName,
    display_name: `${firstName} ${lastName}`,
    username:     username.toLowerCase(),
    email:        email.toLowerCase(),
    store_number: storeNumber || '',
    role:         '',
    avatar_color: color,
    avatar_emoji: '',
  });
  if (profileError) return { error: profileError.message };

  // Insert empty progress row
  await supabase.from('user_progress').insert({ id: userId });

  // If email confirmation is required, the session won't be set yet
  if (!authData.session) return { needsConfirmation: true };

  const profile = await getUserProfile(userId);
  return { user: profile };
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function loginUser(usernameOrEmail, password) {
  let email = usernameOrEmail.trim();

  // If not an email address, look up email by username
  if (!email.includes('@')) {
    const { data: profileData } = await supabase
      .from('profiles')
      .select('email')
      .eq('username', email.toLowerCase())
      .maybeSingle();

    if (!profileData) return { error: 'No account found with that username.' };
    email = profileData.email;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.toLowerCase().includes('invalid login')) return { error: 'Incorrect email or password.' };
    return { error: error.message };
  }

  const profile = await getUserProfile(data.user.id);
  return { user: profile };
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function logoutUser() {
  await supabase.auth.signOut();
}

// ─── Auth state listener ──────────────────────────────────────────────────────
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(callback);
}

// ─── Profile ──────────────────────────────────────────────────────────────────
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  return formatProfile(data);
}

function formatProfile(row) {
  return {
    id:          row.id,
    firstName:   row.first_name   || '',
    lastName:    row.last_name    || '',
    displayName: row.display_name || `${row.first_name} ${row.last_name}`,
    username:    row.username     || '',
    email:       row.email        || '',
    storeNumber: row.store_number || '',
    role:        row.role         || '',
    avatarColor: row.avatar_color || '#0050AA',
    avatarEmoji: row.avatar_emoji || '',
    createdAt:   row.created_at,
  };
}

export async function updateProfile(userId, fields) {
  const updates = {};
  if ('firstName'   in fields) updates.first_name   = fields.firstName;
  if ('lastName'    in fields) updates.last_name     = fields.lastName;
  if ('storeNumber' in fields) updates.store_number  = fields.storeNumber;
  if ('role'        in fields) updates.role          = fields.role;
  if ('avatarColor' in fields) updates.avatar_color  = fields.avatarColor;
  if ('avatarEmoji' in fields) updates.avatar_emoji  = fields.avatarEmoji;
  if (fields.firstName !== undefined && fields.lastName !== undefined) {
    updates.display_name = `${fields.firstName} ${fields.lastName}`;
  }

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single();

  if (error) return null;
  return formatProfile(data);
}

// ─── Password ─────────────────────────────────────────────────────────────────
export async function changePassword(currentPassword, newPassword) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'Not authenticated.' };

  // Verify current password by re-authenticating
  const { error: checkError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (checkError) return { error: 'Current password is incorrect.' };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function resetPasswordByEmail(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.toLowerCase(), {
    redirectTo: `${window.location.origin}`,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

// ─── Progress ─────────────────────────────────────────────────────────────────
const defaultProgress = () => ({
  xp: 0, level: 1, streak: 0, lastActiveDate: null,
  masteredPLUs: {}, favorites: {}, mistakes: {},
  totalCorrect: 0, totalAnswered: 0, quizzesPlayed: 0,
  studyMinutes: 0, learnedToday: 0, dailyGoal: 10,
  dailyChallengeDate: null, achievements: [], _perfectStreak: 0,
  isDarkMode: false,
});

export async function getProgress(userId) {
  const { data, error } = await supabase
    .from('user_progress')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return defaultProgress();

  return {
    xp:                 data.xp                 ?? 0,
    level:              data.level               ?? 1,
    streak:             data.streak              ?? 0,
    lastActiveDate:     data.last_active_date    ?? null,
    masteredPLUs:       data.mastered_plus       ?? {},
    favorites:          data.favorites           ?? {},
    mistakes:           data.mistakes            ?? {},
    totalCorrect:       data.total_correct       ?? 0,
    totalAnswered:      data.total_answered      ?? 0,
    quizzesPlayed:      data.quizzes_played      ?? 0,
    studyMinutes:       data.study_minutes       ?? 0,
    learnedToday:       data.learned_today       ?? 0,
    dailyGoal:          data.daily_goal          ?? 10,
    dailyChallengeDate: data.daily_challenge_date ?? null,
    achievements:       data.achievements        ?? [],
    _perfectStreak:     data.perfect_streak      ?? 0,
    isDarkMode:         data.is_dark_mode        ?? false,
  };
}

let _saveTimer = null;

export function saveProgress(userId, progress) {
  // Immediate localStorage cache (keeps UI snappy)
  try {
    const { products, categories, isLoadingProducts, xpPopup, authUser, ...rest } = progress;
    localStorage.setItem(`plu_progress_${userId}`, JSON.stringify(rest));
  } catch { /* quota */ }

  // Debounced Supabase upsert (2 s after last change)
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => _flushToSupabase(userId, progress), 2000);
}

async function _flushToSupabase(userId, progress) {
  try {
    const { products, categories, isLoadingProducts, xpPopup, authUser, currentPage, ...rest } = progress;
    await supabase.from('user_progress').upsert({
      id:                   userId,
      xp:                   rest.xp                ?? 0,
      level:                rest.level              ?? 1,
      streak:               rest.streak             ?? 0,
      last_active_date:     rest.lastActiveDate     ?? null,
      mastered_plus:        rest.masteredPLUs       ?? {},
      favorites:            rest.favorites          ?? {},
      mistakes:             rest.mistakes           ?? {},
      total_correct:        rest.totalCorrect       ?? 0,
      total_answered:       rest.totalAnswered      ?? 0,
      quizzes_played:       rest.quizzesPlayed      ?? 0,
      study_minutes:        rest.studyMinutes       ?? 0,
      learned_today:        rest.learnedToday       ?? 0,
      daily_goal:           rest.dailyGoal          ?? 10,
      daily_challenge_date: rest.dailyChallengeDate ?? null,
      achievements:         rest.achievements       ?? [],
      perfect_streak:       rest._perfectStreak     ?? 0,
      is_dark_mode:         rest.isDarkMode         ?? false,
      updated_at:           new Date().toISOString(),
    });
  } catch { /* network error — data is safe in localStorage */ }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
export async function getAllUsers() {
  try {
    const [profilesRes, progressRes] = await Promise.all([
      supabase.from('profiles').select('*'),
      supabase.from('user_progress').select('id, xp, level, streak, achievements, quizzes_played, total_correct, total_answered'),
    ]);

    if (profilesRes.error) throw profilesRes.error;

    const progressMap = {};
    (progressRes.data || []).forEach(p => { progressMap[p.id] = p; });

    return (profilesRes.data || []).map(u => ({
      ...formatProfile(u),
      progress: progressMap[u.id] ?? { xp: 0, level: 1, streak: 0 },
    }));
  } catch {
    return [];
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const COLORS = ['#0050AA','#e63946','#2ec4b6','#f4a261','#9b5de5','#06d6a0','#ef476f','#118ab2'];
function randomColor() { return COLORS[Math.floor(Math.random() * COLORS.length)]; }

// Keep this export for backward compat with Login.jsx (registration no longer uses it but it's imported)
export const SECURITY_QUESTIONS = [];

