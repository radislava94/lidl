import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import { loadAllProducts, buildCategories } from '../utils/dataLoader';
import { getLevelFromXP }                   from '../utils/scoring';
import { todayString, yesterdayString }     from '../utils/helpers';
import { restoreSession, logoutUser, getProgress, saveProgress, updateProfile } from '../utils/auth';
import { checkAchievements }                from '../utils/achievements';

// ─── Initial per-user progress (also the "empty" state) ──────────────────────
const blankProgress = {
  xp:                 0,
  level:              1,
  streak:             0,
  lastActiveDate:     null,
  masteredPLUs:       {},
  favorites:          {},
  mistakes:           {},
  totalCorrect:       0,
  totalAnswered:      0,
  quizzesPlayed:      0,
  studyMinutes:       0,
  learnedToday:       0,
  dailyGoal:          10,
  dailyChallengeDate: null,
  achievements:       [],
  _perfectStreak:     0,
  isDarkMode:         false,
  currentPage:        'dashboard',
};

// ─── Full app state (products are always ephemeral) ───────────────────────────
const initialState = {
  // ── Auth ──
  authUser: null,           // UserRecord from auth.js (no password hash exposed to UI)

  // ── Per-user progress (merged from blankProgress + localStorage) ──
  ...blankProgress,

  // ── Ephemeral ──
  products:          [],
  categories:        [],
  isLoadingProducts: true,
  xpPopup: { show: false, amount: 0, didLevelUp: false, achievementId: null },
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    // ── Auth ──────────────────────────────────────────────────────────────────
    case 'LOGIN': {
      const progress = getProgress(action.user.id);
      return {
        ...initialState,
        authUser:          action.user,
        ...progress,
        products:          state.products,
        categories:        state.categories,
        isLoadingProducts: state.isLoadingProducts,
        xpPopup:           { show: false, amount: 0, didLevelUp: false, achievementId: null },
      };
    }

    case 'LOGOUT':
      logoutUser();
      return {
        ...initialState,
        products:          state.products,
        categories:        state.categories,
        isLoadingProducts: false,
      };

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
      const earned   = Math.max(0, action.amount);
      const newXP    = state.xp + earned;
      const newLevel = getLevelFromXP(newXP);
      return {
        ...state,
        xp:      newXP,
        level:   newLevel,
        xpPopup: { show: true, amount: earned, didLevelUp: newLevel > state.level, achievementId: null },
      };
    }

    case 'HIDE_XP_POPUP':
      return { ...state, xpPopup: { show: false, amount: 0, didLevelUp: false, achievementId: null } };

    // ── Streak ────────────────────────────────────────────────────────────────
    case 'UPDATE_STREAK': {
      const today     = todayString();
      const yesterday = yesterdayString();
      const last      = state.lastActiveDate;
      let streak      = state.streak;
      if      (last === today)     streak = state.streak;
      else if (last === yesterday) streak = state.streak + 1;
      else                         streak = 1;
      return { ...state, streak, lastActiveDate: today };
    }

    // ── Mastered PLUs ─────────────────────────────────────────────────────────
    case 'MARK_MASTERED':
      if (state.masteredPLUs[action.plu]) return state;
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
        mistakes: { ...state.mistakes, [action.plu]: (state.mistakes[action.plu] || 0) + 1 },
        _perfectStreak: 0,
      };

    case 'CLEAR_MISTAKES':
      return { ...state, mistakes: {} };

    case 'REMOVE_MISTAKE': {
      const m = { ...state.mistakes };
      delete m[action.plu];
      return { ...state, mistakes: m };
    }

    // ── Quiz stats ────────────────────────────────────────────────────────────
    case 'RECORD_ANSWER': {
      const perfect = action.isCorrect ? (state._perfectStreak || 0) + 1 : 0;
      return {
        ...state,
        totalCorrect:   state.totalCorrect  + (action.isCorrect ? 1 : 0),
        totalAnswered:  state.totalAnswered + 1,
        _perfectStreak: perfect,
      };
    }

    case 'INCREMENT_QUIZ':
      return { ...state, quizzesPlayed: state.quizzesPlayed + 1 };

    // ── Study time ────────────────────────────────────────────────────────────
    case 'INCREMENT_STUDY_MINUTE':
      return { ...state, studyMinutes: state.studyMinutes + 1 };

    // ── Daily Challenge ───────────────────────────────────────────────────────
    case 'COMPLETE_DAILY_CHALLENGE': {
      const today = todayString();
      if (state.dailyChallengeDate === today) return state;
      const earnedXP = 50;
      const newXP    = state.xp + earnedXP;
      const newLevel = getLevelFromXP(newXP);
      return {
        ...state,
        dailyChallengeDate: today,
        xp:      newXP,
        level:   newLevel,
        xpPopup: { show: true, amount: earnedXP, didLevelUp: newLevel > state.level, achievementId: null },
      };
    }

    case 'SET_DAILY_GOAL':
      return { ...state, dailyGoal: Math.max(1, Math.min(100, action.goal)) };

    case 'RESET_TODAY':
      return { ...state, learnedToday: 0 };

    // ── Achievements ──────────────────────────────────────────────────────────
    case 'UNLOCK_ACHIEVEMENT': {
      if (state.achievements.includes(action.id)) return state;
      return {
        ...state,
        achievements: [...state.achievements, action.id],
        xpPopup: { show: true, amount: 0, didLevelUp: false, achievementId: action.id },
      };
    }

    // ── Profile update (name, avatar colour) ──────────────────────────────────
    case 'UPDATE_PROFILE': {
      if (!state.authUser) return state;
      const updated = updateProfile(state.authUser.id, action.fields);
      return { ...state, authUser: updated ?? state.authUser };
    }

    // ── Products (import) ─────────────────────────────────────────────────────
    case 'SET_PRODUCTS_IMPORT': {
      const cats = buildCategories(action.products);
      return { ...state, products: action.products, categories: cats };
    }

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, () => {
    // Try to restore session (remember-me)
    const user = restoreSession();
    if (user) {
      const progress = getProgress(user.id);
      return {
        ...initialState,
        authUser: user,
        ...progress,
      };
    }
    return initialState;
  });

  // Persist progress whenever state changes
  useEffect(() => {
    if (!state.authUser) return;
    const { products, categories, isLoadingProducts, xpPopup, authUser, ...progress } = state;
    saveProgress(state.authUser.id, progress);
  }, [state]);

  // Load products on mount
  useEffect(() => {
    loadAllProducts().then(products => dispatch({ type: 'SET_PRODUCTS', products }));
  }, []);

  // Apply dark mode on mount & auth change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.isDarkMode ? 'dark' : 'light');
  }, [state.isDarkMode]);

  // Study-time ticker
  useEffect(() => {
    if (!state.authUser) return;
    const id = setInterval(() => dispatch({ type: 'INCREMENT_STUDY_MINUTE' }), 60_000);
    return () => clearInterval(id);
  }, [state.authUser]);

  // Achievement checker — runs after every state change
  const prevAchievements = useRef(state.achievements);
  useEffect(() => {
    if (!state.authUser) return;
    const newIds = checkAchievements(state, state.categories);
    newIds.forEach(id => dispatch({ type: 'UNLOCK_ACHIEVEMENT', id }));
    prevAchievements.current = state.achievements;
  }); // intentionally no deps — runs after every render, achievement check is idempotent

  // ── Action creators ──────────────────────────────────────────────────────
  const actions = {
    loginWithUser: user => {
      dispatch({ type: 'LOGIN', user });
      // Restore dark mode preference
    },
    logout: () => dispatch({ type: 'LOGOUT' }),

    setPage:    page  => dispatch({ type: 'SET_PAGE', page }),
    toggleDark: ()    => dispatch({ type: 'TOGGLE_DARK' }),

    addXP:         amount    => dispatch({ type: 'ADD_XP', amount }),
    hideXPPopup:   ()        => dispatch({ type: 'HIDE_XP_POPUP' }),
    updateStreak:  ()        => dispatch({ type: 'UPDATE_STREAK' }),

    markMastered:   plu      => dispatch({ type: 'MARK_MASTERED', plu }),
    toggleFavorite: plu      => dispatch({ type: 'TOGGLE_FAVORITE', plu }),

    recordMistake:  plu      => dispatch({ type: 'RECORD_MISTAKE', plu }),
    removeMistake:  plu      => dispatch({ type: 'REMOVE_MISTAKE', plu }),
    clearMistakes:  ()       => dispatch({ type: 'CLEAR_MISTAKES' }),

    recordAnswer:   isCorrect => dispatch({ type: 'RECORD_ANSWER', isCorrect }),
    incrementQuiz:  ()        => dispatch({ type: 'INCREMENT_QUIZ' }),

    completeDailyChallenge: () => dispatch({ type: 'COMPLETE_DAILY_CHALLENGE' }),
    setDailyGoal: goal         => dispatch({ type: 'SET_DAILY_GOAL', goal }),

    updateProfile: fields      => dispatch({ type: 'UPDATE_PROFILE', fields }),

    setProducts: products      => dispatch({ type: 'SET_PRODUCTS', products }),
  };

  // Back-compat: state.user still works (was used by many components)
  const stateWithCompat = {
    ...state,
    user: state.authUser ? state.authUser.displayName : null,
    store: state.authUser?.storeNumber || '',
    role:  state.authUser?.role || '',
  };

  return (
    <AppContext.Provider value={{ state: stateWithCompat, dispatch, actions }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}

