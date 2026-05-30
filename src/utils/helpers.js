// ─── Array / Random helpers ───────────────────────────────────────────────────

/** Fisher-Yates shuffle (returns a new array) */
export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick one random element */
export function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Pick `n` unique random elements */
export function randomPickN(arr, n) {
  return shuffle(arr).slice(0, n);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function todayString() {
  return new Date().toDateString();
}

export function yesterdayString() {
  return new Date(Date.now() - 86_400_000).toDateString();
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = String(seconds % 60).padStart(2, '0');
  return `${m}:${s}`;
}

export function pct(value, total) {
  if (!total) return 0;
  return Math.min(100, Math.round((value / total) * 100));
}

// ─── ID generator ─────────────────────────────────────────────────────────────

export const uid = () => Math.random().toString(36).slice(2, 9);
