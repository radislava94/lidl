import { createContext, useContext, useReducer, useEffect } from 'react';
import { loadAllProducts, buildCategories } from '../utils/dataLoader';
import { getLevelFromXP }                   from '../utils/scoring';
import { todayString, yesterdayString }     from '../utils/helpers';
import {
  getPlayer,
  getProgress,
  saveProgress,
  updatePlayer,
  logoutPlayer,
  loginOrCreatePlayer,
  loadPlayer,
  deletePlayer,
  resetProgress,
} from '../utils/auth';
import { checkAchievements }                from '../utils/achievements';

// ─── Blank progress defaults ──────────────────────────────────────────────────
const blankProgress = {
  xp: 0, level: 1, streak: 0, lastActiveDate: null,
  masteredPLUs: {}, favorites: {}, mistakes: {},
  totalCorrect: 0, totalAnswered: 0, quizzesPlayed: 0,
  studyMinutes: 0, learnedToday: 0, dailyGoal: 10,
  dailyChallengeDate: null, achievements: [], _perfectStreak: 0,
  isDarkMode: false, currentPage: 'dashboard',
};

// ─── Initial state (empty — overridden by initState below) ───────────────────
const initialState = {
  authUser:          null,
  ...blankProgress,
  products:          [],
  categories:        [],
  isLoadingProducts: true,
  playerDirectoryVersion: 0,
  xpPopup: { show: false, amount: 0, didLevelUp: false, achievementId: null },
};

// ─── Synchronous initializer — restores saved player from localStorage ────────
function initState() {
  try {
    const player = getPlayer();
    if (!player) return initialState;
    const progress = getProgress(player.id);
    document.documentElement.setAttribute('data-theme', progress.isDarkMode ? 'dark' : 'light');
    return { ...initialState, authUser: player, ...progress };
  } catch {
    return initialState;
  }
}

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case 'LOGIN': {
      const progress = action.progress || {};
      document.documentElement.setAttribute('data-theme', progress.isDarkMode ? 'dark' : 'light');
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
      return {
        ...initialState,
        products:          state.products,
        categories:        state.categories,
        isLoadingProducts: false,
      };

    case 'PLAYER_DIRECTORY_CHANGED':
      return { ...state, playerDirectoryVersion: state.playerDirectoryVersion + 1 };

    case 'SET_AUTH_USER':
      return { ...state, authUser: action.user };

    case 'SET_PRODUCTS': {
      const cats = buildCategories(action.products);
      return { ...state, products: action.products, categories: cats, isLoadingProducts: false };
    }

    case 'SET_PAGE':
      return { ...state, currentPage: action.page };

    case 'TOGGLE_DARK': {
      const next = !state.isDarkMode;
      document.documentElement.setAttribute('data-theme', next ? 'dark' : 'light');
      return { ...state, isDarkMode: next };
    }

    case 'ADD_XP': {
      const earned   = Math.max(0, action.amount);
      const newXP    = state.xp + earned;
      const newLevel = getLevelFromXP(newXP);
      return {
        ...state, xp: newXP, level: newLevel,
        xpPopup: { show: true, amount: earned, didLevelUp: newLevel > state.level, achievementId: null },
      };
    }

    case 'HIDE_XP_POPUP':
      return { ...state, xpPopup: { show: false, amount: 0, didLevelUp: false, achievementId: null } };

    case 'UPDATE_STREAK': {
      const today = todayString(), yesterday = yesterdayString(), last = state.lastActiveDate;
      const streak = last === today ? state.streak : last === yesterday ? state.streak + 1 : 1;
      return { ...state, streak, lastActiveDate: today };
    }

    case 'MARK_MASTERED':
      if (state.masteredPLUs[action.plu]) return state;
      return { ...state, masteredPLUs: { ...state.masteredPLUs, [action.plu]: true }, learnedToday: state.learnedToday + 1 };

    case 'TOGGLE_FAVORITE': {
      const fav = { ...state.favorites };
      if (fav[action.plu]) delete fav[action.plu]; else fav[action.plu] = true;
      return { ...state, favorites: fav };
    }

    case 'RECORD_MISTAKE':
      return { ...state, mistakes: { ...state.mistakes, [action.plu]: (state.mistakes[action.plu] || 0) + 1 }, _perfectStreak: 0 };

    case 'CLEAR_MISTAKES': return { ...state, mistakes: {} };

    case 'REMOVE_MISTAKE': {
      const m = { ...state.mistakes }; delete m[action.plu]; return { ...state, mistakes: m };
    }

    case 'RECORD_ANSWER': {
      const perfect = action.isCorrect ? (state._perfectStreak || 0) + 1 : 0;
      return { ...state, totalCorrect: state.totalCorrect + (action.isCorrect ? 1 : 0), totalAnswered: state.totalAnswered + 1, _perfectStreak: perfect };
    }

    case 'INCREMENT_QUIZ':         return { ...state, quizzesPlayed:  state.quizzesPlayed + 1 };
    case 'INCREMENT_STUDY_MINUTE': return { ...state, studyMinutes:   state.studyMinutes + 1 };

    case 'COMPLETE_DAILY_CHALLENGE': {
      const today = todayString();
      if (state.dailyChallengeDate === today) return state;
      const earnedXP = 50, newXP = state.xp + earnedXP, newLevel = getLevelFromXP(newXP);
      return { ...state, dailyChallengeDate: today, xp: newXP, level: newLevel, xpPopup: { show: true, amount: earnedXP, didLevelUp: newLevel > state.level, achievementId: null } };
    }

    case 'SET_DAILY_GOAL': return { ...state, dailyGoal: Math.max(1, Math.min(100, action.goal)) };
    case 'RESET_TODAY':    return { ...state, learnedToday: 0 };

    case 'UNLOCK_ACHIEVEMENT':
      if (state.achievements.includes(action.id)) return state;
      return { ...state, achievements: [...state.achievements, action.id], xpPopup: { show: true, amount: 0, didLevelUp: false, achievementId: action.id } };

    default: return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, null, initState);

  // ── Load products on mount ────────────────────────────────────────────────
  useEffect(() => {
    loadAllProducts().then(products => dispatch({ type: 'SET_PRODUCTS', products }));
  }, []);

  // ── Save progress to localStorage after every state change ────────────────
  useEffect(() => {
    if (!state.authUser) return;
    saveProgress(state.authUser.id, state);
  }); // no deps — runs after every render, keeps data fresh

  // ── Achievement checker ───────────────────────────────────────────────────
  useEffect(() => {
    if (!state.authUser) return;
    const newIds = checkAchievements(state, state.categories);
    newIds.forEach(id => dispatch({ type: 'UNLOCK_ACHIEVEMENT', id }));
  }); // no deps — runs after every render, idempotent

  // ── Study-time ticker ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!state.authUser) return;
    const id = setInterval(() => dispatch({ type: 'INCREMENT_STUDY_MINUTE' }), 60_000);
    return () => clearInterval(id);
  }, [state.authUser]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const actions = {
    // Called from the Welcome screen after entering a name.
    // Returns { player, isReturning } so callers know whether the player is new.
    loginWithName: (name) => {
      const { player, isReturning } = loginOrCreatePlayer(name);
      const progress = getProgress(player.id);
      dispatch({ type: 'LOGIN', user: player, progress });
      return { player, isReturning };
    },

    switchPlayer: (playerId) => {
      const player = loadPlayer(playerId);
      if (!player) return null;
      const progress = getProgress(player.id);
      dispatch({ type: 'LOGIN', user: player, progress });
      return player;
    },

    logout: () => {
      logoutPlayer();
      dispatch({ type: 'LOGOUT' });
    },

    deleteProfile: (playerId) => {
      const targetId = playerId || state.authUser?.id;
      if (!targetId) return;
      deletePlayer(targetId);
      dispatch({ type: 'PLAYER_DIRECTORY_CHANGED' });
      if (state.authUser?.id === targetId) {
        dispatch({ type: 'LOGOUT' });
      }
    },

    resetProgress: () => {
      const targetId = state.authUser?.id;
      if (!targetId) return;
      resetProgress(targetId);
      const player = loadPlayer(targetId);
      if (player) {
        dispatch({ type: 'LOGIN', user: player, progress: getProgress(targetId) });
      }
      dispatch({ type: 'PLAYER_DIRECTORY_CHANGED' });
    },

    setPage:    page => dispatch({ type: 'SET_PAGE', page }),
    toggleDark: ()   => dispatch({ type: 'TOGGLE_DARK' }),

    addXP:        amount    => dispatch({ type: 'ADD_XP', amount }),
    hideXPPopup:  ()        => dispatch({ type: 'HIDE_XP_POPUP' }),
    updateStreak: ()        => dispatch({ type: 'UPDATE_STREAK' }),

    markMastered:   plu => dispatch({ type: 'MARK_MASTERED', plu }),
    toggleFavorite: plu => dispatch({ type: 'TOGGLE_FAVORITE', plu }),

    recordMistake:  plu => dispatch({ type: 'RECORD_MISTAKE', plu }),
    removeMistake:  plu => dispatch({ type: 'REMOVE_MISTAKE', plu }),
    clearMistakes:  ()  => dispatch({ type: 'CLEAR_MISTAKES' }),

    recordAnswer:  isCorrect => dispatch({ type: 'RECORD_ANSWER', isCorrect }),
    incrementQuiz: ()        => dispatch({ type: 'INCREMENT_QUIZ' }),

    completeDailyChallenge: () => dispatch({ type: 'COMPLETE_DAILY_CHALLENGE' }),
    setDailyGoal: goal         => dispatch({ type: 'SET_DAILY_GOAL', goal }),

    updateProfile: (fields) => {
      const updated = updatePlayer(fields);
      if (updated) dispatch({ type: 'SET_AUTH_USER', user: updated });
    },

    setProducts: products => dispatch({ type: 'SET_PRODUCTS', products }),
  };

  // Back-compat shims for components that still read state.user / state.store
  const stateWithCompat = {
    ...state,
    user:  state.authUser?.displayName ?? null,
    store: state.authUser?.storeNumber ?? '',
    role:  state.authUser?.role        ?? '',
  };

  return (
    <AppContext.Provider value={{ state: stateWithCompat, dispatch, actions }}>
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

