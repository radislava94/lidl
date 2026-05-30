import { useState } from 'react';
import { useApp }   from '../store/AppContext';

const NAV = [
  { page: 'dashboard',  icon: 'fa-home',            label: 'Dashboard'        },
  { page: 'categories', icon: 'fa-th-large',         label: 'Categories'       },
  { page: 'learn',      icon: 'fa-book-open',        label: 'Learn'            },
  { page: 'flashcards', icon: 'fa-layer-group',      label: 'Flashcards'       },
  { page: 'quiz',       icon: 'fa-bolt',             label: 'Quiz'             },
  { page: 'memory',     icon: 'fa-brain',            label: 'Memory Game'      },
  { page: 'cashier',    icon: 'fa-cash-register',    label: 'Cashier Sim'      },
  { page: 'daily',      icon: 'fa-calendar-check',   label: 'Daily Challenge'  },
  { page: 'progress',   icon: 'fa-chart-bar',        label: 'Progress'         },
  { page: 'mistakes',   icon: 'fa-exclamation-circle', label: 'Mistakes'       },
  { page: 'leaderboard',icon: 'fa-trophy',           label: 'Leaderboard'      },
  { page: 'import',     icon: 'fa-file-import',      label: 'Import Products'  },
  { page: 'settings',   icon: 'fa-cog',              label: 'Settings'         },
];

export default function Layout({ children }) {
  const { state, actions } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const initial = (state.user || '?').charAt(0).toUpperCase();

  return (
    <div id="screen-app" className="screen active" style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* TOP BAR */}
      <header className="topbar">
        <button type="button" className="hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Toggle navigation menu">
          <i className="fa fa-bars" />
        </button>
        <div className="topbar-logo">
          <span className="logo-lidl-sm">lidl</span> PLU Trainer
        </div>
        <div className="topbar-right">
          <span className="xp-pill">
            <i className="fa fa-star" /> {state.xp} XP
          </span>
          <button type="button" className="icon-btn dark-toggle-btn" onClick={actions.toggleDark} title="Toggle dark mode" aria-label="Toggle dark mode">
            <i className={`fa ${state.isDarkMode ? 'fa-sun' : 'fa-moon'}`} />
          </button>
          <button type="button" className="avatar-btn" onClick={() => actions.setPage('progress')} title="My Progress" aria-label="Open progress page">
            {initial}
          </button>
        </div>
      </header>

      <div className="app-layout">
        {/* SIDEBAR */}
        <nav id="sidebar" className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
          <div className="sidebar-brand">
            <div className="logo-badge sm"><span className="logo-lidl">lidl</span></div>
            <span>PLU Trainer</span>
          </div>

          <div className="sidebar-user">
            <div className="sidebar-avatar">{initial}</div>
            <div>
              <div className="sidebar-name">{state.user}</div>
              <div className="sidebar-level">Level {state.level} · {state.xp} XP</div>
            </div>
          </div>

          <ul className="nav-list">
            {NAV.map(({ page, icon, label }) => (
              <li key={page}>
                <button
                  type="button"
                  className={`nav-link${state.currentPage === page ? ' active' : ''}`}
                  onClick={() => { actions.setPage(page); setSidebarOpen(false); }}
                >
                  <i className={`fa ${icon}`} />
                  <span>{label}</span>
                </button>
              </li>
            ))}
          </ul>

          <div className="sidebar-bottom">
            <div className="streak-widget">
              <i className="fa fa-fire streak-icon" />
              <div>
                <div className="streak-count">{state.streak} day streak</div>
                <div className="streak-sub">Keep it up!</div>
              </div>
            </div>
            <button type="button" className="btn-outline btn-sm logout-btn" onClick={actions.logout}>
              <i className="fa fa-sign-out-alt" /> Logout
            </button>
          </div>
        </nav>

        {/* OVERLAY */}
        {sidebarOpen && (
          <div
            className="sidebar-overlay open"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* MAIN */}
        <main className="main-content">
          <div className="app-page-shell">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
