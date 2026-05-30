import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { loadAllProducts, buildCategories }      from '../utils/dataLoader';
import { getLevelFromXP }                         from '../utils/scoring';
import { todayString, yesterdayString }           from '../utils/helpers';

// ─── Storage key ──────────────────────────────────────────────────────────────
const STORAGE_KEY = 'plulearn_v2';

// ─── Initial state ────────────────────────────────────────────────────────────
const initialState = {
  // ── Products (ephemeral — reloaded each session) ──
  products:            [],
  categories:          [],
  isLoadingProducts:   true,

  // ── User ──
  user:     null,
  store:    '',
  role:     '',

  // ── Progress ──
  xp:              0,
  level:           1,
  streak:          0,
  lastActiveDate:  null,
  masteredPLUs:    {},   // { [plu]: true }
  favorites:       {},   // { [plu]: true }
  mistakes:        {},   // { [plu]: count }

  // ── Stats ──
  totalCorrect:   0,
  totalAnswered:  0,
  quizzesPlayed:  0,
  studyMinutes:   0,
  learnedToday:   0,
  dailyGoal:      10,

  // ── Daily Challenge ──
  dailyChallengeDate: null,   // date string of last completion (YYYY-MM-DD)

  // ── UI ──
  currentPage: 'dashboard',
  isDarkMode:  false,

  // ── XP Popup ──
  xpPopup: { show: false, amount: 0, didLevelUp: false },
};

// ─── Serialise / deserialise ──────────────────────────────────────────────────
function serialise(state) {
  const { products, categories, isLoadingProducts, xpPopup, ...rest } = state;
  return rest;
}

function deserialise(raw) {
  return {
    ...initialState,
    ...raw,
    products:          [],
    categories:        [],
    isLoadingProducts: true,
    xpPopup:           { show: false, amount: 0, didLevelUp: false },
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    // ── Auth ──────────────────────────────────────────────────────────────────
    case 'LOGIN':
      return { ...state, user: action.user, store: action.store, role: action.role };

    case 'LOGOUT':
      return { ...initialState, products: state.products, categories: state.categories, isLoadingProducts: false };

    // ── Products ──────────────────────────────────────────────────────────────
    case 'SET_PRODUCTS': {
      const cats = buildCategories(action.products);
      return { ...state, products: action.products, categories: cats, isLoadingProducts: false };
    }

    // ── Navigation ────────────────────────────────────────────────────────────
    case 'SET_PAGE':
      return { ...state, currentPage: action.page };

    // ── Dark mode ─────────────────────────────────────────────────────────────
    case 'TOGGLE_DARK': {
      const next = !state.isDarkMode;
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
      return { ...state, isDarkMode: next };
    }

    // ── XP & Level ────────────────────────────────────────────────────────────
    case 'ADD_XP': {
      const earned  = Math.max(0, action.amount);
      const newXP   = state.xp + earned;
      const newLevel = getLevelFromXP(newXP);
      return {
        ...state,
        xp:       newXP,
        level:    newLevel,
        xpPopup:  { show: true, amount: earned, didLevelUp: newLevel > state.level },
      };
    }

    case 'HIDE_XP_POPUP':
      return { ...state, xpPopup: { show: false, amount: 0, didLevelUp: false } };

    // ── Streak ────────────────────────────────────────────────────────────────
    case 'UPDATE_STREAK': {
      const today     = todayString();
      const yesterday = yesterdayString();
      const last      = state.lastActiveDate;
      let streak      = state.streak;

      if (last === today)      streak = state.streak;
      else if (last === yesterday) streak = state.streak + 1;
      else                         streak = 1;

      return { ...state, streak, lastActiveDate: today };
    }

    // ── Mastered PLUs ─────────────────────────────────────────────────────────
    case 'MARK_MASTERED':
      if (state.masteredPLUs[action.plu]) return state; // already mastered
      return {
        ...state,
        masteredPLUs: { ...state.masteredPLUs, [action.plu]: true },
        learnedToday: state.learnedToday + 1,
      };

    // ── Favorites ─────────────────────────────────────────────────────────────
    case 'TOGGLE_FAVORITE': {
      const fav = { ...state.favorites };
      if (fav[action.plu]) delete fav[action.plu];
      else fav[action.plu] = true;
      return { ...state, favorites: fav };
    }

    // ── Mistakes ──────────────────────────────────────────────────────────────
    case 'RECORD_MISTAKE':
      return {
        ...state,
        mistakes: {
          ...state.mistakes,
          [action.plu]: (state.mistakes[action.plu] || 0) + 1,
        },
      };

    case 'CLEAR_MISTAKES':
      return { ...state, mistakes: {} };

    case 'REMOVE_MISTAKE': {
      const m = { ...state.mistakes };
      delete m[action.plu];
      return { ...state, mistakes: m };
    }

    // ── Quiz stats ────────────────────────────────────────────────────────────
    case 'RECORD_ANSWER':
      return {
        ...state,
        totalCorrect:  state.totalCorrect  + (action.isCorrect ? 1 : 0),
        totalAnswered: state.totalAnswered + 1,
      };

    case 'INCREMENT_QUIZ':
      return { ...state, quizzesPlayed: state.quizzesPlayed + 1 };

    // ── Study time ────────────────────────────────────────────────────────────
    case 'INCREMENT_STUDY_MINUTE':
      return { ...state, studyMinutes: state.studyMinutes + 1 };
    // ── Daily Challenge ──────────────────────────────────────────────────────────────
    case 'COMPLETE_DAILY_CHALLENGE': {
      const today = todayString();
      if (state.dailyChallengeDate === today) return state; // idempotent
      const earnedXP = 50;
      const newXP    = state.xp + earnedXP;
      const newLevel = getLevelFromXP(newXP);
      return {
        ...state,
        dailyChallengeDate: today,
        xp:     newXP,
        level:  newLevel,
        xpPopup: { show: true, amount: earnedXP, didLevelUp: newLevel > state.level },
      };
    }

    case 'SET_DAILY_GOAL':
      return { ...state, dailyGoal: Math.max(1, Math.min(100, action.goal)) };
    // ── Misc ──────────────────────────────────────────────────────────────────
    case 'RESET_TODAY':
      return { ...state, learnedToday: 0 };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Hydrate from localStorage on first render
  const [state, dispatch] = useReducer(reducer, null, () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return deserialise(JSON.parse(raw));
    } catch { /* ignore */ }
    return initialState;
  });

  // Persist whenever state changes (skip products/UI ephemeral fields)
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialise(state)));
    } catch { /* quota exceeded – silent */ }
  }, [state]);

  // Load products on mount
  useEffect(() => {
    loadAllProducts().then(products => {
      dispatch({ type: 'SET_PRODUCTS', products });
    });
  }, []);

  // Apply dark mode class on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Study-time ticker (1 min interval while logged in)
  useEffect(() => {
    if (!state.user) return;
    const id = setInterval(() => dispatch({ type: 'INCREMENT_STUDY_MINUTE' }), 60_000);
    return () => clearInterval(id);
  }, [state.user]);

  // ── Convenience action creators ──────────────────────────────────────────
  const actions = {
    login:  (user, store, role) => dispatch({ type: 'LOGIN', user, store, role }),
    logout: ()                  => dispatch({ type: 'LOGOUT' }),

    setPage: page => dispatch({ type: 'SET_PAGE', page }),
    toggleDark:  () => dispatch({ type: 'TOGGLE_DARK' }),

    addXP:          amount      => dispatch({ type: 'ADD_XP', amount }),
    hideXPPopup:    ()          => dispatch({ type: 'HIDE_XP_POPUP' }),
    updateStreak:   ()          => dispatch({ type: 'UPDATE_STREAK' }),

    markMastered:   plu         => dispatch({ type: 'MARK_MASTERED', plu }),
    toggleFavorite: plu         => dispatch({ type: 'TOGGLE_FAVORITE', plu }),

    recordMistake:  plu         => dispatch({ type: 'RECORD_MISTAKE', plu }),
    removeMistake:  plu         => dispatch({ type: 'REMOVE_MISTAKE', plu }),
    clearMistakes:  ()          => dispatch({ type: 'CLEAR_MISTAKES' }),

    recordAnswer:   isCorrect   => dispatch({ type: 'RECORD_ANSWER', isCorrect }),
    incrementQuiz:  ()          => dispatch({ type: 'INCREMENT_QUIZ' }),

    completeDailyChallenge: () => dispatch({ type: 'COMPLETE_DAILY_CHALLENGE' }),
    setDailyGoal: goal          => dispatch({ type: 'SET_DAILY_GOAL', goal }),
  };

  return (
    <AppContext.Provider value={{ state, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
