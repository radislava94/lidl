/* ══════════════════════════════════════════════════
   LIDL PLU LEARN — APPLICATION LOGIC
   ══════════════════════════════════════════════════ */

/* ─────────────────────────────────────────────────
   STATE
   ───────────────────────────────────────────────── */
const state = {
  user: null,
  xp: 0,
  level: 1,
  streak: 1,
  totalCorrect: 0,
  totalAnswered: 0,
  quizzesPlayed: 0,
  studyMinutes: 0,
  masteredIds: new Set(),
  mistakesMap: {},          // { productId: count }
  todayAnswered: 0,
  dailyGoal: 10,
  learnedToday: 0,
  sessionStart: Date.now(),

  quiz: {
    mode: 'classic',
    cat: 'all',
    questions: [],
    currentIdx: 0,
    score: 0,
    correct: 0,
    timerInterval: null,
    timeLeft: 0,
    lives: 3,
    answered: false,
  },

  flashcards: { items: [], idx: 0 },
  memory: { pairs: [], flipped: [], matched: 0, moves: 0, timer: null, seconds: 0, locked: false },
};

/* ─────────────────────────────────────────────────
   BOOT
   ───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  loadPersisted();
  populateCategoryDropdowns();
});

/* ─────────────────────────────────────────────────
   PERSISTENCE  (localStorage — demo-safe)
   ───────────────────────────────────────────────── */
function savePersisted() {
  try {
    const data = {
      user: state.user,
      xp: state.xp,
      level: state.level,
      streak: state.streak,
      totalCorrect: state.totalCorrect,
      totalAnswered: state.totalAnswered,
      quizzesPlayed: state.quizzesPlayed,
      studyMinutes: state.studyMinutes,
      masteredIds: [...state.masteredIds],
      mistakesMap: state.mistakesMap,
      learnedToday: state.learnedToday,
      todayAnswered: state.todayAnswered,
    };
    localStorage.setItem('plulearn', JSON.stringify(data));
  } catch (_) { /* storage may be unavailable */ }
}

function loadPersisted() {
  try {
    const raw = localStorage.getItem('plulearn');
    if (!raw) return;
    const data = JSON.parse(raw);
    Object.assign(state, data);
    state.masteredIds = new Set(data.masteredIds || []);
    if (state.user) {
      showScreen('app');
      updateAllUI();
    }
  } catch (_) { /* ignore corrupt data */ }
}

/* ─────────────────────────────────────────────────
   SCREEN MANAGEMENT
   ───────────────────────────────────────────────── */
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById('screen-' + name);
  if (target) target.classList.add('active');
}

/* ─────────────────────────────────────────────────
   LOGIN / LOGOUT
   ───────────────────────────────────────────────── */
function doLogin() {
  const name = document.getElementById('loginName').value.trim();
  if (!name) { document.getElementById('loginName').focus(); return; }
  state.user = name;
  savePersisted();
  showScreen('app');
  updateAllUI();
  showPage('dashboard', document.querySelector('[data-page="dashboard"]'));
}

function doLogout() {
  state.user = null;
  savePersisted();
  showScreen('login');
}

/* ─────────────────────────────────────────────────
   PAGE NAVIGATION
   ───────────────────────────────────────────────── */
function showPage(pageId, linkEl) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (linkEl) linkEl.classList.add('active');

  closeSidebar();

  // Lazy rendering per page
  const renders = {
    dashboard:   renderDashboard,
    categories:  renderCategories,
    learn:       loadLearnItems,
    flashcards:  loadFlashcards,
    quiz:        renderQuizLobby,
    progress:    renderProgress,
    mistakes:    renderMistakes,
    leaderboard: renderLeaderboard,
    memory:      () => {},
  };
  if (renders[pageId]) renders[pageId]();
}

/* ─────────────────────────────────────────────────
   SIDEBAR TOGGLE
   ───────────────────────────────────────────────── */
function toggleSidebar() {
  const sb = document.getElementById('sidebar');
  const ov = document.getElementById('sidebarOverlay');
  sb.classList.toggle('open');
  ov.classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ─────────────────────────────────────────────────
   DARK MODE
   ───────────────────────────────────────────────── */
function toggleDark() {
  const html = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? 'light' : 'dark');
  const icon = document.querySelector('.dark-toggle-btn i');
  if (icon) { icon.className = isDark ? 'fa fa-moon' : 'fa fa-sun'; }
}

/* ─────────────────────────────────────────────────
   XP & LEVEL SYSTEM
   ───────────────────────────────────────────────── */
const XP_PER_LEVEL = 200;
function addXP(amount) {
  state.xp += amount;
  const newLevel = Math.floor(state.xp / XP_PER_LEVEL) + 1;
  if (newLevel > state.level) { state.level = newLevel; showLevelUp(); }
  updateXPUI();
  showXPPopup(amount);
  savePersisted();
}

function showXPPopup(amount) {
  const el = document.getElementById('xpPopup');
  el.textContent = '+' + amount + ' XP';
  el.classList.remove('show');
  void el.offsetWidth;
  el.classList.add('show');
}

function showLevelUp() {
  launchConfetti();
}

function updateXPUI() {
  document.getElementById('topXP').textContent       = state.xp;
  document.getElementById('sidebarXP').textContent   = state.xp;
  document.getElementById('sidebarLevel').textContent = state.level;
  document.getElementById('statXP').textContent      = state.xp;
}

/* ─────────────────────────────────────────────────
   UPDATE ALL UI
   ───────────────────────────────────────────────── */
function updateAllUI() {
  if (!state.user) return;
  const initial = state.user.charAt(0).toUpperCase();
  document.getElementById('avatarInitial').textContent   = initial;
  document.getElementById('sidebarInitial').textContent  = initial;
  document.getElementById('sidebarName').textContent     = state.user;
  document.getElementById('dashGreeting').textContent    = 'Welcome back, ' + state.user + '!';
  updateXPUI();
  document.getElementById('sidebarStreak').textContent   = state.streak;
  document.getElementById('statStreak').textContent      = state.streak;
  document.getElementById('statLearned').textContent     = state.masteredIds.size;
  const acc = state.totalAnswered > 0
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100) : 0;
  document.getElementById('statAccuracy').textContent    = acc + '%';
}

/* ─────────────────────────────────────────────────
   DASHBOARD
   ───────────────────────────────────────────────── */
function renderDashboard() {
  updateAllUI();

  // Today's progress bar
  const pct = Math.min(100, Math.round((state.learnedToday / state.dailyGoal) * 100));
  document.getElementById('todayProgressBar').style.width = pct + '%';
  document.getElementById('todayProgressPct').textContent = pct + '%';
  document.getElementById('todayGoalBadge').textContent   =
    state.learnedToday + ' / ' + state.dailyGoal + ' goal';

  // Mini category cards
  const grid = document.getElementById('dashCatGrid');
  grid.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const count = PRODUCTS.filter(p => p.cat === cat.id).length;
    const mastered = PRODUCTS.filter(p => p.cat === cat.id && state.masteredIds.has(p.id)).length;
    const card = document.createElement('div');
    card.className = 'cat-mini-card';
    card.innerHTML = `<div class="cat-mini-emoji">${cat.emoji}</div>
      <div class="cat-mini-name">${cat.name}</div>
      <div class="cat-mini-count">${mastered}/${count}</div>`;
    card.onclick = () => {
      const link = document.querySelector('[data-page="categories"]');
      showPage('categories', link);
    };
    grid.appendChild(card);
  });

  // Most missed
  renderMostMissed();
}

function renderMostMissed() {
  const list = document.getElementById('mostMissedList');
  list.innerHTML = '';
  const sorted = Object.entries(state.mistakesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  if (sorted.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem;">No mistakes tracked yet — keep quizzing!</p>';
    return;
  }
  sorted.forEach(([id, count]) => {
    const p = PRODUCTS.find(x => x.id === parseInt(id));
    if (!p) return;
    const item = document.createElement('div');
    item.className = 'missed-item';
    item.innerHTML = `<div class="missed-emoji">${p.emoji}</div>
      <div><div class="missed-name">${p.name}</div><div class="missed-plu">PLU: ${p.plu}</div></div>
      <div class="missed-times">${count}×</div>`;
    list.appendChild(item);
  });
}

/* ─────────────────────────────────────────────────
   CATEGORIES PAGE
   ───────────────────────────────────────────────── */
function renderCategories() {
  const grid = document.getElementById('bigCatGrid');
  grid.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const count   = PRODUCTS.filter(p => p.cat === cat.id).length;
    const mastered = PRODUCTS.filter(p => p.cat === cat.id && state.masteredIds.has(p.id)).length;
    const pct = Math.round((mastered / count) * 100);
    const card = document.createElement('div');
    card.className = 'big-cat-card';
    card.style.setProperty('--cat-color', cat.color);
    card.innerHTML = `<div class="big-cat-emoji">${cat.emoji}</div>
      <div class="big-cat-name">${cat.name}</div>
      <div class="big-cat-count">${mastered}/${count} mastered</div>
      <div class="big-cat-bar"><div class="big-cat-bar-fill" style="width:${pct}%"></div></div>`;
    card.onclick = () => {
      document.getElementById('learnCatSelect').value = cat.id;
      const link = document.querySelector('[data-page="learn"]');
      showPage('learn', link);
    };
    grid.appendChild(card);
  });
}

function filterProducts() {
  const q = document.getElementById('catSearch').value.trim().toLowerCase();
  const resultsEl = document.getElementById('searchResults');
  const gridEl    = document.getElementById('bigCatGrid');
  if (!q) {
    resultsEl.classList.add('hidden');
    gridEl.style.display = '';
    return;
  }
  gridEl.style.display = 'none';
  resultsEl.classList.remove('hidden');
  resultsEl.innerHTML = '';
  const matches = PRODUCTS.filter(p =>
    p.name.toLowerCase().includes(q) || p.plu.includes(q));
  if (matches.length === 0) {
    resultsEl.innerHTML = '<p style="color:var(--text-muted)">No products found.</p>';
    return;
  }
  matches.forEach(p => {
    const cat = CATEGORIES.find(c => c.id === p.cat);
    const item = document.createElement('div');
    item.className = 'search-item';
    item.innerHTML = `<div class="si-emoji">${p.emoji}</div>
      <div><div class="si-name">${p.name}</div>
      <div class="si-cat">${cat ? cat.emoji + ' ' + cat.name : ''}</div></div>
      <div class="si-plu">${p.plu}</div>`;
    resultsEl.appendChild(item);
  });
}

/* ─────────────────────────────────────────────────
   CATEGORY DROPDOWNS POPULATION
   ───────────────────────────────────────────────── */
function populateCategoryDropdowns() {
  const selectors = ['#learnCatSelect','#flashCatSelect','#quizCatSelect','#memCatSelect'];
  selectors.forEach(sel => {
    const el = document.querySelector(sel);
    if (!el) return;
    // Keep first option (All / existing)
    const firstOpt = el.querySelector('option');
    el.innerHTML = '';
    if (firstOpt) el.appendChild(firstOpt);
    CATEGORIES.forEach(cat => {
      const o = document.createElement('option');
      o.value = cat.id;
      o.textContent = cat.emoji + ' ' + cat.name;
      el.appendChild(o);
    });
  });
}

/* ─────────────────────────────────────────────────
   LEARN MODE
   ───────────────────────────────────────────────── */
function loadLearnItems() {
  const catId = document.getElementById('learnCatSelect').value;
  const items = catId === 'all' ? PRODUCTS : PRODUCTS.filter(p => p.cat === catId);
  document.getElementById('learnCatLabel').textContent =
    catId === 'all' ? 'All Products' :
    (CATEGORIES.find(c => c.id === catId)?.name || catId);
  document.getElementById('learnCount').textContent = items.length + ' items';

  const grid = document.getElementById('learnGrid');
  grid.innerHTML = '';
  items.forEach(p => {
    const mastered = state.masteredIds.has(p.id);
    const card = document.createElement('div');
    card.className = 'learn-card' + (mastered ? ' mastered' : '');
    card.innerHTML = `<div class="learn-emoji">${p.emoji}</div>
      <div class="learn-name">${p.name}</div>
      <div class="learn-plu">${p.plu}</div>
      <div class="learn-cat">${CATEGORIES.find(c=>c.id===p.cat)?.name||''}</div>`;
    card.onclick = () => markMastered(p.id, card);
    grid.appendChild(card);
  });
  trackStudyTime();
}

function markMastered(id, card) {
  if (!state.masteredIds.has(id)) {
    state.masteredIds.add(id);
    state.learnedToday++;
    card.classList.add('mastered');
    addXP(5);
    savePersisted();
    if (state.learnedToday % 5 === 0 && state.learnedToday <= state.dailyGoal) {
      launchConfetti();
    }
  }
}

function trackStudyTime() {
  clearInterval(state._studyTimer);
  state._studyTimer = setInterval(() => {
    state.studyMinutes++;
    savePersisted();
  }, 60000);
}

/* ─────────────────────────────────────────────────
   FLASHCARDS
   ───────────────────────────────────────────────── */
function loadFlashcards() {
  const catId = document.getElementById('flashCatSelect').value;
  state.flashcards.items = catId === 'all' ? [...PRODUCTS] : PRODUCTS.filter(p => p.cat === catId);
  state.flashcards.idx = 0;
  renderFlashcard();
}

function renderFlashcard() {
  const { items, idx } = state.flashcards;
  if (items.length === 0) return;
  const p = items[idx];
  const total = items.length;
  document.getElementById('flashCardIndex').textContent = idx + 1;
  document.getElementById('flashCardTotal').textContent = total;
  document.getElementById('flashProgressBar').style.width = ((idx + 1) / total * 100) + '%';
  document.getElementById('fcEmoji').textContent = p.emoji;
  document.getElementById('fcName').textContent  = p.name;
  document.getElementById('fcPLU').textContent   = p.plu;
  document.getElementById('fcCat').textContent   =
    CATEGORIES.find(c => c.id === p.cat)?.name || '';

  // Reset flip
  document.getElementById('theFlashcard').classList.remove('flipped');

  // Dots (max 10)
  const dotsEl = document.getElementById('fcDots');
  dotsEl.innerHTML = '';
  const display = Math.min(total, 10);
  for (let i = 0; i < display; i++) {
    const d = document.createElement('div');
    d.className = 'fc-dot' + (i === (idx % display) ? ' active' : '');
    dotsEl.appendChild(d);
  }
}

function flipCard() {
  document.getElementById('theFlashcard').classList.toggle('flipped');
}

function nextCard() {
  const len = state.flashcards.items.length;
  if (len === 0) return;
  state.flashcards.idx = (state.flashcards.idx + 1) % len;
  renderFlashcard();
}

function prevCard() {
  const len = state.flashcards.items.length;
  if (len === 0) return;
  state.flashcards.idx = (state.flashcards.idx - 1 + len) % len;
  renderFlashcard();
}

function shuffleFlashcards() {
  state.flashcards.items = shuffle([...state.flashcards.items]);
  state.flashcards.idx = 0;
  renderFlashcard();
}

function markCard(correct) {
  const p = state.flashcards.items[state.flashcards.idx];
  if (!correct) {
    state.mistakesMap[p.id] = (state.mistakesMap[p.id] || 0) + 1;
  } else {
    state.masteredIds.add(p.id);
    addXP(3);
  }
  savePersisted();
  nextCard();
}

/* ─────────────────────────────────────────────────
   QUIZ MODE
   ───────────────────────────────────────────────── */
function renderQuizLobby() {
  document.getElementById('quiz-lobby').classList.remove('hidden');
  document.getElementById('quiz-active').classList.add('hidden');
  document.getElementById('quiz-results').classList.add('hidden');
}

function startQuiz(mode) {
  const catId  = document.getElementById('quizCatSelect').value;
  const pool   = catId === 'all' ? [...PRODUCTS] : PRODUCTS.filter(p => p.cat === catId);
  if (pool.length < 4) { alert('Need at least 4 products in this category for a quiz.'); return; }

  const q = state.quiz;
  q.mode     = mode;
  q.cat      = catId;
  q.currentIdx = 0;
  q.score    = 0;
  q.correct  = 0;
  q.answered = false;
  q.lives    = 3;

  const numQ = mode === 'speed' ? 20 : mode === 'survival' ? 999 : 10;

  // Build questions
  q.questions = buildQuestions(pool, Math.min(numQ, pool.length * 4), mode);

  document.getElementById('quiz-lobby').classList.add('hidden');
  document.getElementById('quiz-active').classList.remove('hidden');
  document.getElementById('quiz-results').classList.add('hidden');

  renderLives();
  showQuestion();
}

function buildQuestions(pool, count, mode) {
  const questions = [];
  for (let i = 0; i < count; i++) {
    const product    = pool[Math.floor(Math.random() * pool.length)];
    const isReverse  = mode === 'reverse' || (mode === 'survival' && Math.random() > .5);

    // Build wrong options
    const others = pool.filter(p => p.id !== product.id);
    const wrongs = shuffle(others).slice(0, 3);

    if (isReverse) {
      // Show PLU → choose product name
      const answers = shuffle([product, ...wrongs]).map(p => p.name);
      questions.push({ product, isReverse: true, answers, correct: product.name });
    } else {
      // Show product → choose PLU
      const answers = shuffle([product, ...wrongs]).map(p => p.plu);
      questions.push({ product, isReverse: false, answers, correct: product.plu });
    }
  }
  return questions;
}

function showQuestion() {
  const q   = state.quiz;
  const idx = q.currentIdx;

  if (idx >= q.questions.length) { endQuiz(); return; }

  const qs    = q.questions[idx];
  const total = q.questions.length;

  document.getElementById('qNum').textContent           = idx + 1;
  document.getElementById('qTotal').textContent         = Math.min(total, 999);
  document.getElementById('quizScore').textContent      = q.score;
  document.getElementById('quizProgressBar').style.width = ((idx / total) * 100) + '%';
  document.getElementById('quizFeedback').classList.add('hidden');
  document.getElementById('quizFeedback').className     = 'quiz-feedback hidden';

  if (qs.isReverse) {
    document.getElementById('qEmoji').textContent      = '';
    document.getElementById('qQuestion').textContent   = 'Which product has PLU:';
    document.getElementById('qProductName').textContent = qs.product.plu;
  } else {
    document.getElementById('qEmoji').textContent      = qs.product.emoji;
    document.getElementById('qQuestion').textContent   = 'What is the PLU for:';
    document.getElementById('qProductName').textContent = qs.product.name;
  }

  // Options
  const optsEl = document.getElementById('quizOptions');
  optsEl.innerHTML = '';
  qs.answers.forEach(ans => {
    const btn = document.createElement('button');
    btn.className = 'option-btn';
    btn.textContent = ans;
    btn.onclick = () => handleAnswer(ans, qs.correct);
    optsEl.appendChild(btn);
  });

  q.answered = false;
  startQuizTimer();
}

function handleAnswer(chosen, correct) {
  if (state.quiz.answered) return;
  state.quiz.answered = true;
  clearInterval(state.quiz.timerInterval);

  const isCorrect  = chosen === correct;
  const qs         = state.quiz.questions[state.quiz.currentIdx];

  // Visual feedback on buttons
  document.querySelectorAll('.option-btn').forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === correct)    btn.classList.add('correct');
    if (btn.textContent === chosen && !isCorrect) btn.classList.add('wrong');
  });

  // Feedback banner
  const fb = document.getElementById('quizFeedback');
  fb.classList.remove('hidden');
  if (isCorrect) {
    const pts = getQuizPoints();
    state.quiz.score   += pts;
    state.quiz.correct += 1;
    state.totalCorrect++;
    state.masteredIds.add(qs.product.id);
    fb.className        = 'quiz-feedback correct-fb';
    document.getElementById('feedbackIcon').textContent = '✅';
    document.getElementById('feedbackText').textContent = 'Correct! +' + pts + ' pts';
    if (state.quiz.correct > 0 && state.quiz.correct % 5 === 0) launchConfetti();
  } else {
    document.getElementById('quizCard').classList.add('shake');
    setTimeout(() => document.getElementById('quizCard').classList.remove('shake'), 500);
    fb.className = 'quiz-feedback wrong-fb';
    document.getElementById('feedbackIcon').textContent = '❌';
    document.getElementById('feedbackText').textContent = 'The answer was: ' + correct;
    state.mistakesMap[qs.product.id] = (state.mistakesMap[qs.product.id] || 0) + 1;

    if (state.quiz.mode === 'survival') {
      state.quiz.lives = Math.max(0, state.quiz.lives - 1);
      renderLives();
      if (state.quiz.lives === 0) {
        setTimeout(endQuiz, 900);
        return;
      }
    }
  }
  state.totalAnswered++;
  state.learnedToday++;
  document.getElementById('quizScore').textContent = state.quiz.score;

  setTimeout(() => {
    state.quiz.currentIdx++;
    showQuestion();
  }, 1100);
}

function getQuizPoints() {
  const mode  = state.quiz.mode;
  const tLeft = state.quiz.timeLeft;
  if (mode === 'speed')    return 10 + Math.max(0, tLeft);
  if (mode === 'survival') return 15;
  return 10;
}

function startQuizTimer() {
  clearInterval(state.quiz.timerInterval);
  const timerEl = document.getElementById('hudTimer');
  const valEl   = document.getElementById('timerVal');

  if (state.quiz.mode === 'classic' || state.quiz.mode === 'reverse') {
    timerEl.style.opacity = '.4';
    valEl.textContent = '--';
    state.quiz.timeLeft = 0;
    return;
  }
  timerEl.style.opacity = '1';
  state.quiz.timeLeft = 10;
  valEl.textContent = 10;
  timerEl.classList.remove('danger');

  state.quiz.timerInterval = setInterval(() => {
    state.quiz.timeLeft--;
    valEl.textContent = state.quiz.timeLeft;
    if (state.quiz.timeLeft <= 3) timerEl.classList.add('danger');
    if (state.quiz.timeLeft <= 0) {
      clearInterval(state.quiz.timerInterval);
      handleAnswer('__timeout__', '__correct__');
    }
  }, 1000);
}

function renderLives() {
  const el = document.getElementById('livesHud');
  if (state.quiz.mode !== 'survival') { el.innerHTML = ''; return; }
  el.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const h = document.createElement('span');
    h.className = 'heart' + (i >= state.quiz.lives ? ' lost' : '');
    h.textContent = '❤️';
    el.appendChild(h);
  }
}

function endQuiz() {
  clearInterval(state.quiz.timerInterval);
  const q        = state.quiz;
  const answered = q.correct + (q.currentIdx - q.correct);
  const acc      = answered > 0 ? Math.round((q.correct / answered) * 100) : 0;
  const gained   = Math.round(q.score * 0.5);

  state.quizzesPlayed++;
  addXP(gained);
  savePersisted();

  document.getElementById('quiz-active').classList.add('hidden');
  const res = document.getElementById('quiz-results');
  res.classList.remove('hidden');
  document.getElementById('resScore').textContent    = q.score;
  document.getElementById('resCorrect').textContent  = q.correct + '/' + answered;
  document.getElementById('resAccuracy').textContent = acc + '%';
  document.getElementById('resXP').textContent       = '+' + gained;

  setTimeout(() => {
    const pct = Math.min(100, ((state.xp % XP_PER_LEVEL) / XP_PER_LEVEL) * 100);
    document.getElementById('xpBarFill').style.width = pct + '%';
  }, 300);

  if (acc >= 80) launchConfetti();
}

function restartQuiz() {
  startQuiz(state.quiz.mode);
}

/* ─────────────────────────────────────────────────
   QUIZ MY MISTAKES
   ───────────────────────────────────────────────── */
function quizMistakes() {
  const ids  = Object.keys(state.mistakesMap).map(Number);
  const pool = PRODUCTS.filter(p => ids.includes(p.id));
  if (pool.length < 4) {
    alert('You need at least 4 mistakes tracked to start a mistakes quiz. Keep playing!');
    return;
  }
  const link = document.querySelector('[data-page="quiz"]');
  showPage('quiz', link);
  // Override pool
  const q = state.quiz;
  q.mode   = 'classic';
  q.questions = buildQuestions(pool, Math.min(10, pool.length * 2), 'classic');
  q.currentIdx = 0; q.score = 0; q.correct = 0; q.answered = false; q.lives = 3;

  document.getElementById('quiz-lobby').classList.add('hidden');
  document.getElementById('quiz-active').classList.remove('hidden');
  document.getElementById('quiz-results').classList.add('hidden');
  renderLives();
  showQuestion();
}

/* ─────────────────────────────────────────────────
   MEMORY GAME
   ───────────────────────────────────────────────── */
function startMemory() {
  const catId  = document.getElementById('memCatSelect').value;
  const diff   = parseInt(document.getElementById('memDifficulty').value);
  const pool   = catId === 'all' ? [...PRODUCTS] : PRODUCTS.filter(p => p.cat === catId);
  const count  = Math.min(diff, pool.length);

  if (pool.length < 4) { alert('Need more products in this category.'); return; }

  const selected = shuffle(pool).slice(0, count);

  // Build pairs: product card + PLU card
  const pairs = [];
  selected.forEach((p, i) => {
    pairs.push({ id: 'p' + i, matchId: i, type: 'product', product: p });
    pairs.push({ id: 'k' + i, matchId: i, type: 'plu',     product: p });
  });

  const m = state.memory;
  m.pairs   = shuffle(pairs);
  m.flipped = [];
  m.matched = 0;
  m.moves   = 0;
  m.locked  = false;

  clearInterval(m.timer);
  m.seconds = 0;
  document.getElementById('memTime').textContent    = '0:00';
  document.getElementById('memMatched').textContent = 0;
  document.getElementById('memTotal').textContent   = count;
  document.getElementById('memMoves').textContent   = 0;

  m.timer = setInterval(() => {
    m.seconds++;
    const mm = Math.floor(m.seconds / 60);
    const ss = String(m.seconds % 60).padStart(2, '0');
    document.getElementById('memTime').textContent = mm + ':' + ss;
  }, 1000);

  renderMemoryGrid(count);
}

function renderMemoryGrid(count) {
  const grid = document.getElementById('memoryGrid');
  const cols = count <= 8 ? 4 : count <= 12 ? 4 : 4;
  grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
  grid.innerHTML = '';

  state.memory.pairs.forEach((pair, idx) => {
    const card = document.createElement('div');
    card.className = 'mem-card';
    card.dataset.idx = idx;
    card.innerHTML = `
      <div class="mem-card-inner">
        <div class="mem-front"><i class="fa fa-question"></i></div>
        <div class="mem-back ${pair.type === 'plu' ? 'plu-side' : 'product-side'}">
          ${pair.type === 'plu'
            ? `<span>${pair.product.plu}</span>`
            : `<span class="mem-emoji">${pair.product.emoji}</span><span style="font-size:.75rem">${pair.product.name}</span>`}
        </div>
      </div>`;
    card.onclick = () => flipMemCard(idx);
    grid.appendChild(card);
  });
}

function flipMemCard(idx) {
  const m = state.memory;
  if (m.locked) return;
  const card = document.querySelector(`.mem-card[data-idx="${idx}"]`);
  if (!card || card.classList.contains('flipped') || card.classList.contains('matched')) return;

  card.classList.add('flipped');
  m.flipped.push(idx);

  if (m.flipped.length === 2) {
    m.moves++;
    document.getElementById('memMoves').textContent = m.moves;
    m.locked = true;
    const [a, b] = m.flipped;
    const pa = m.pairs[a], pb = m.pairs[b];

    if (pa.matchId === pb.matchId && pa.type !== pb.type) {
      // Match!
      [a, b].forEach(i => {
        document.querySelector(`.mem-card[data-idx="${i}"]`).classList.add('matched');
      });
      m.matched++;
      document.getElementById('memMatched').textContent = m.matched;
      m.flipped = [];
      m.locked  = false;
      addXP(8);
      if (m.matched === m.pairs.length / 2) {
        clearInterval(m.timer);
        setTimeout(() => { launchConfetti(); alert('🎉 You matched all pairs in ' + m.moves + ' moves!'); }, 300);
      }
    } else {
      setTimeout(() => {
        [a, b].forEach(i => {
          document.querySelector(`.mem-card[data-idx="${i}"]`)?.classList.remove('flipped');
        });
        m.flipped = [];
        m.locked  = false;
      }, 900);
    }
  }
}

/* ─────────────────────────────────────────────────
   PROGRESS PAGE
   ───────────────────────────────────────────────── */
function renderProgress() {
  document.getElementById('progLearned').textContent  = state.masteredIds.size;
  document.getElementById('progTime').textContent     = state.studyMinutes + 'm';
  document.getElementById('progQuizzes').textContent  = state.quizzesPlayed;
  const acc = state.totalAnswered > 0
    ? Math.round((state.totalCorrect / state.totalAnswered) * 100) : 0;
  document.getElementById('progAcc').textContent = acc + '%';

  // Per-category progress
  const catProg = document.getElementById('catProgress');
  catProg.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const all      = PRODUCTS.filter(p => p.cat === cat.id).length;
    const mastered = PRODUCTS.filter(p => p.cat === cat.id && state.masteredIds.has(p.id)).length;
    const pct      = all > 0 ? Math.round((mastered / all) * 100) : 0;
    const item     = document.createElement('div');
    item.className = 'cat-progress-item';
    item.innerHTML = `<div class="cpi-header">
        <div class="cpi-name">${cat.emoji} ${cat.name}</div>
        <div class="cpi-pct">${mastered}/${all} · ${pct}%</div>
      </div>
      <div class="progress-bar-track">
        <div class="progress-bar-fill blue-fill" style="width:${pct}%"></div>
      </div>`;
    catProg.appendChild(item);
  });

  // Weekly bars (simulated)
  const days = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const vals = [40, 70, 55, 90, 30, 80, 100];
  const wb   = document.getElementById('weeklyBars');
  wb.innerHTML = '';
  days.forEach((d, i) => {
    const wrap = document.createElement('div');
    wrap.className = 'weekly-bar-wrap';
    wrap.innerHTML = `<div class="weekly-bar" style="height:${vals[i]}%"></div><div class="weekly-day">${d}</div>`;
    wb.appendChild(wrap);
  });

  // Achievements
  renderAchievements();
}

const ACHIEVEMENTS = [
  { id: 'first',    icon: '🎯', name: 'First Steps',  desc: 'Play your first quiz',  check: () => state.quizzesPlayed >= 1    },
  { id: 'streak3',  icon: '🔥', name: 'On Fire',      desc: '3-day streak',          check: () => state.streak >= 3           },
  { id: 'master10', icon: '🏅', name: 'PLU Rookie',   desc: 'Master 10 PLUs',        check: () => state.masteredIds.size >= 10},
  { id: 'master50', icon: '🥇', name: 'PLU Pro',      desc: 'Master 50 PLUs',        check: () => state.masteredIds.size >= 50},
  { id: 'acc100',   icon: '💯', name: 'Perfect',      desc: '100% quiz accuracy',    check: () => state.totalAnswered>=10 && (state.totalCorrect/state.totalAnswered)>=1 },
  { id: 'xp500',    icon: '⭐', name: 'Star Learner', desc: 'Earn 500 XP',           check: () => state.xp >= 500             },
  { id: 'quiz10',   icon: '🎮', name: 'Quiz Fanatic', desc: 'Play 10 quizzes',       check: () => state.quizzesPlayed >= 10   },
  { id: 'allcat',   icon: '🗺️', name: 'Explorer',    desc: 'Study all categories',  check: () => CATEGORIES.every(c => PRODUCTS.some(p => p.cat===c.id && state.masteredIds.has(p.id))) },
];

function renderAchievements() {
  const grid = document.getElementById('achievementsGrid');
  grid.innerHTML = '';
  ACHIEVEMENTS.forEach(ach => {
    const unlocked = ach.check();
    const card = document.createElement('div');
    card.className = 'ach-card' + (unlocked ? ' unlocked' : ' locked');
    card.innerHTML = `<div class="ach-icon">${ach.icon}</div>
      <div class="ach-name">${ach.name}</div>
      <div class="ach-desc">${ach.desc}</div>`;
    grid.appendChild(card);
  });
}

/* ─────────────────────────────────────────────────
   MISTAKES PAGE
   ───────────────────────────────────────────────── */
function renderMistakes() {
  const list   = document.getElementById('mistakesList');
  const noEl   = document.getElementById('noMistakes');
  const keys   = Object.keys(state.mistakesMap);
  if (keys.length === 0) {
    list.innerHTML = '';
    noEl.classList.remove('hidden');
    return;
  }
  noEl.classList.add('hidden');
  list.innerHTML = '';
  keys.sort((a,b) => state.mistakesMap[b] - state.mistakesMap[a])
      .forEach(id => {
        const p = PRODUCTS.find(x => x.id === parseInt(id));
        if (!p) return;
        const card = document.createElement('div');
        card.className = 'mistake-card';
        card.innerHTML = `<div class="mistake-emoji">${p.emoji}</div>
          <div class="mistake-name">${p.name}</div>
          <div class="mistake-plu">${p.plu}</div>
          <div class="mistake-count">Missed ${state.mistakesMap[id]}×</div>`;
        list.appendChild(card);
      });
}

function clearMistakes() {
  if (!confirm('Clear all tracked mistakes?')) return;
  state.mistakesMap = {};
  savePersisted();
  renderMistakes();
}

/* ─────────────────────────────────────────────────
   LEADERBOARD
   ───────────────────────────────────────────────── */
const FAKE_LB = [
  { name: 'Sarah K.',   store: 'Store #1001', xp: 3200, streak: 15 },
  { name: 'Marcus B.',  store: 'Store #1042', xp: 2950, streak: 12 },
  { name: 'Ines M.',    store: 'Store #2018', xp: 2700, streak: 9  },
  { name: 'Tom R.',     store: 'Store #3005', xp: 2400, streak: 7  },
  { name: 'Lena S.',    store: 'Store #4011', xp: 2100, streak: 14 },
  { name: 'Felix D.',   store: 'Store #1001', xp: 1900, streak: 5  },
  { name: 'Anna W.',    store: 'Store #2018', xp: 1650, streak: 3  },
  { name: 'David L.',   store: 'Store #1042', xp: 1400, streak: 6  },
  { name: 'Julia H.',   store: 'Store #3005', xp: 1200, streak: 2  },
  { name: 'Chris F.',   store: 'Store #4011', xp: 980,  streak: 4  },
];

function renderLeaderboard() {
  const myName = state.user || 'You';
  const myXP   = state.xp;

  // Insert player into sorted list
  const full = [...FAKE_LB, { name: myName, store: 'Your Store', xp: myXP, streak: state.streak, isMe: true }]
    .sort((a,b) => b.xp - a.xp);

  const list = document.getElementById('leaderboardList');
  list.innerHTML = '';
  full.forEach((pl, i) => {
    const rank  = i + 1;
    const rankCls = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
    const item  = document.createElement('div');
    item.className = 'lb-item' + (pl.isMe ? ' me' : '');
    item.innerHTML = `
      <div class="lb-rank ${rankCls}">${rank <= 3 ? ['🥇','🥈','🥉'][rank-1] : rank}</div>
      <div class="lb-avatar">${pl.name.charAt(0)}</div>
      <div class="lb-info">
        <div class="lb-name">${pl.name}${pl.isMe ? ' (You)' : ''}</div>
        <div class="lb-store">${pl.store}</div>
      </div>
      <div class="lb-score">
        <div class="lb-xp">${pl.xp} XP</div>
        <div class="lb-streak">🔥 ${pl.streak} days</div>
      </div>`;
    list.appendChild(item);
  });
}

function switchLBTab(tab, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLeaderboard(); // in real app, fetch different data per tab
}

/* ─────────────────────────────────────────────────
   CONFETTI
   ───────────────────────────────────────────────── */
function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const colors = ['#0050AA','#FFF000','#E3000F','#22c55e','#f59e0b','#8b5cf6'];
  const pieces = Array.from({ length: 120 }, () => ({
    x:  Math.random() * canvas.width,
    y:  Math.random() * canvas.height - canvas.height,
    w:  6 + Math.random() * 9,
    h:  10 + Math.random() * 8,
    vy: 3 + Math.random() * 5,
    vx: (Math.random() - .5) * 4,
    rot: Math.random() * 360,
    rv: (Math.random() - .5) * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    alpha: 1,
  }));

  let frame;
  let start = null;
  function draw(ts) {
    if (!start) start = ts;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = ts - start;
    let alive = false;
    pieces.forEach(p => {
      p.y   += p.vy;
      p.x   += p.vx;
      p.rot += p.rv;
      if (elapsed > 2000) p.alpha = Math.max(0, p.alpha - .018);
      if (p.y < canvas.height + 20) alive = true;
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rot * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    if (alive && elapsed < 4000) { frame = requestAnimationFrame(draw); }
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); cancelAnimationFrame(frame); }
  }
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(draw);
}

/* ─────────────────────────────────────────────────
   UTILITY
   ───────────────────────────────────────────────── */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
