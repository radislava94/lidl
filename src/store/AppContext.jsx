import { createContext, useContext, useReducer, useEffect, useRef } from 'react';
import { loadAllProducts, buildCategories }  from '../utils/dataLoader';
import { getLevelFromXP }                    from '../utils/scoring';
import { todayString, yesterdayString }      from '../utils/helpers';
import { onAuthStateChange, getUserProfile, getProgress, saveProgress, updateProfile as updateProfileFn, logoutUser } from '../utils/auth';
import { checkAchievements }                 from '../utils/achievements';
import { supabase }                          from '../utils/supabaseClient';

// ─── Blank per-user progress ──────────────────────────────────────────────────
const blankProgress = {
  xp: 0, level: 1, streak: 0, lastActiveDate: null,
  masteredPLUs: {}, favorites: {}, mistakes: {},
  totalCorrect: 0, totalAnswered: 0, quizzesPlayed: 0,
  studyMinutes: 0, learnedToday: 0, dailyGoal: 10,
  dailyChallengeDate: null, achievements: [], _perfectStreak: 0,
  isDarkMode: false, currentPage: 'dashboard',
};

// ─── Initial state ────────────────────────────────────────────────────────────
const initialState = {
  authUser:          null,
  isAuthLoading:     true,   // true while Supabase checks for a session
  ...blankProgress,
  products:          [],
  categories:        [],
  isLoadingProducts: true,
  xpPopup: { show: false, amount: 0, didLevelUp: false, achievementId: null },
};

// ─── Reducer ──────────────────────────────────────────────────────────────────
function reducer(state, action) {
  switch (action.type) {

    case 'LOGIN': {
      const progress = action.progress || {};
      const newState = {
        ...initialState,
        authUser:          action.user,
        isAuthLoading:     false,
        ...progress,
        products:          state.products,
        categories:        state.categories,
        isLoadingProducts: state.isLoadingProducts,
        xpPopup:           { show: false, amount: 0, didLevelUp: false, achievementId: null },
      };
      // Apply saved dark mode
      document.documentElement.setAttribute('data-theme', progress.isDarkMode ? 'dark' : 'light');
      return newState;
    }

    case 'AUTH_READY':
      return { ...state, isAuthLoading: false };

    case 'LOGOUT':
      return {
        ...initialState,
        isAuthLoading:     false,
        products:          state.products,
        categories:        state.categories,
        isLoadingProducts: false,
      };

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
      let streak = last === today ? state.streak : last === yesterday ? state.streak + 1 : 1;
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

    case 'INCREMENT_QUIZ':    return { ...state, quizzesPlayed: state.quizzesPlayed + 1 };
    case 'INCREMENT_STUDY_MINUTE': return { ...state, studyMinutes: state.studyMinutes + 1 };

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

// ─── Load user data from Supabase ─────────────────────────────────────────────
async function loadAndLoginUser(userId, dispatch) {
  try {
    const [user, progress] = await Promise.all([
      getUserProfile(userId),
      getProgress(userId),
    ]);
    if (user) {
      dispatch({ type: 'LOGIN', user, progress });
    } else {
      dispatch({ type: 'AUTH_READY' });
    }
  } catch {
    dispatch({ type: 'AUTH_READY' });
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────
const AppContext = createContext(null);

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  // ── Supabase auth listener (fires immediately with INITIAL_SESSION) ────────
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') {
        if (session?.user) {
          await loadAndLoginUser(session.user.id, dispatch);
        } else {
          dispatch({ type: 'AUTH_READY' });
        }
      } else if (event === 'SIGNED_OUT') {
        dispatch({ type: 'LOGOUT' });
      } else if (event === 'USER_UPDATED' && session?.user) {
        // Reload profile after password/email update
        const user = await getUserProfile(session.user.id);
        if (user) dispatch({ type: 'SET_AUTH_USER', user });
      }
    });
    return () => subscription.unsubscribe();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load products on mount ────────────────────────────────────────────────
  useEffect(() => {
    loadAllProducts().then(products => dispatch({ type: 'SET_PRODUCTS', products }));
  }, []);

  // ── Persist progress to Supabase whenever state changes ──────────────────
  useEffect(() => {
    if (!state.authUser) return;
    saveProgress(state.authUser.id, state);
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

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
    logout: async () => { await logoutUser(); /* onAuthStateChange fires LOGOUT */ },

    setPage:    page => dispatch({ type: 'SET_PAGE', page }),
    toggleDark: ()   => dispatch({ type: 'TOGGLE_DARK' }),

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

    updateProfile: async (fields) => {
      const user = stateRef.current.authUser;
      if (!user) return;
      const updated = await updateProfileFn(user.id, fields);
      if (updated) dispatch({ type: 'SET_AUTH_USER', user: updated });
    },

    setProducts: products => dispatch({ type: 'SET_PRODUCTS', products }),
  };

  // Back-compat: state.user / state.store / state.role still work
  const stateWithCompat = {
    ...state,
    user:  state.authUser ? state.authUser.displayName : null,
    store: state.authUser?.storeNumber || '',
    role:  state.authUser?.role        || '',
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

