import { lazy, Suspense } from 'react';
import { useApp } from './store/AppContext';
import Login            from './components/Login';
import Layout           from './components/Layout';
import Dashboard        from './components/Dashboard';
import Categories       from './components/Categories';
import Learn            from './components/Learn';
import Flashcards       from './components/Flashcards';
import Quiz             from './components/Quiz';
import MemoryGame       from './components/MemoryGame';
import Progress         from './components/Progress';
import Mistakes         from './components/Mistakes';
import Leaderboard      from './components/Leaderboard';
import CashierSimulator from './components/CashierSimulator';
import DailyChallenge   from './components/DailyChallenge';
import Settings         from './components/Settings';
import Profile          from './components/Profile';
import XPPopup          from './components/shared/XPPopup';

// Lazy-load the heavy ImportProducts page (pulls in xlsx / SheetJS)
const ImportProducts = lazy(() => import('./components/ImportProducts'));

const PAGES = {
  dashboard:   Dashboard,
  categories:  Categories,
  learn:       Learn,
  flashcards:  Flashcards,
  quiz:        Quiz,
  memory:      MemoryGame,
  progress:    Progress,
  mistakes:    Mistakes,
  leaderboard: Leaderboard,
  cashier:     CashierSimulator,
  daily:       DailyChallenge,
  settings:    Settings,
  import:      ImportProducts,
  profile:     Profile,
};

function PageLoader() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
      <i className="fa fa-spinner fa-spin" style={{ fontSize: 28 }} />
    </div>
  );
}

export default function App() {
  const { state } = useApp();

  if (!state.authUser) return <Login />;

  const PageComponent = PAGES[state.currentPage] ?? Dashboard;

  return (
    <>
      <Layout>
        <Suspense fallback={<PageLoader />}>
          <PageComponent />
        </Suspense>
      </Layout>
      <XPPopup />
    </>
  );
}
