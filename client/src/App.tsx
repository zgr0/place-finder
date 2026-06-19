import './App.css'
import { useState, useEffect } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import Map from './Map'
import MapGrid from './mapgrid'
import Login from './Login'
import Register from './Register'
import Profile from './Profile'
import Faction from './Faction'
import FactionList from './FactionList'
import CreateFaction from './CreateFaction'
import { useLanguage } from './LanguageContext'

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [user, setUser] = useState<{ id: string, username: string, factionId: number } | null>(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const { t, lang, setLang } = useLanguage();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const checkAuth = () => {
    const id = localStorage.getItem('userId');
    const username = localStorage.getItem('username');
    const factionId = parseInt(localStorage.getItem('factionId') || '0');
    if (id && username) {
      setUser({ id, username, factionId });
    } else {
      setUser(null);
    }
  };

  useEffect(() => {
    checkAuth();
    window.addEventListener('auth-change', checkAuth);
    return () => window.removeEventListener('auth-change', checkAuth);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('userId');
    localStorage.removeItem('username');
    localStorage.removeItem('factionId');
    window.dispatchEvent(new Event('auth-change'));
    setIsSidebarOpen(false);
    window.location.href = '/';
  };

  return (
    <div className="app-shell flex-layout">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
      
      <aside className={`app-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="app-brand">
          <span className="brand-icon">🗺️</span>
          {t.placeFinder}
          <button className="sidebar-close-btn" onClick={toggleSidebar}>×</button>
        </div>
        <nav className="app-nav sidebar-nav">
          <Link to="/" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
            <span className="nav-icon">📍</span> {t.venues}
          </Link>
          <Link to="/hex" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
            <span className="nav-icon">⬡</span> {t.hexGrid}
          </Link>
          <Link to="/factions" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
            <span className="nav-icon">🏰</span> {t.factions}
          </Link>
          {user && (
            <Link to="/profile" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
              <span className="nav-icon">👤</span> {t.profile}
            </Link>
          )}
          {user && user.factionId > 0 && (
            <Link to="/faction" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
              <span className="nav-icon">⚔️</span> {t.factionChat}
            </Link>
          )}
          <div className="nav-divider"></div>

          <button
            className="app-nav-link"
            onClick={toggleTheme}
            style={{ background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid transparent' }}
          >
            <span className="nav-icon">{theme === 'dark' ? '☀️' : '🌙'}</span>
            {theme === 'dark' ? t.lightMode : t.darkMode}
          </button>

          <button
            className="app-nav-link"
            onClick={() => setLang(lang === 'en' ? 'tr' : 'en')}
            style={{ background: 'transparent', width: '100%', textAlign: 'left', cursor: 'pointer', border: '1px solid transparent' }}
          >
            {t.language}
          </button>

          {user ? (
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '0.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem', borderRadius: '12px', background: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-light)' }}>
                <div style={{ width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'var(--secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>
                  {user.username.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '500' }}>{t.loggedInAs}</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' }}>{user.username}</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="app-nav-link"
                style={{ background: 'transparent', width: '100%', textAlign: 'left', color: '#f87171', border: '1px solid transparent', cursor: 'pointer' }}
              >
                <span className="nav-icon">🚪</span> {t.logout}
              </button>
            </div>
          ) : (
            <>
              <Link to="/login" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
                <span className="nav-icon">🔑</span> {t.login}
              </Link>
              <Link to="/register" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
                <span className="nav-icon">📝</span> {t.register}
              </Link>
            </>
          )}
        </nav>
      </aside>
      
      <main className="app-main flex-content">
        <button className="sidebar-toggle-btn" onClick={toggleSidebar}>
          ☰
        </button>
        <Routes>
          <Route path="/" element={<Map />} />
          <Route path="/hex" element={<MapGrid />} />
          <Route path="/map" element={<Map />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/faction" element={<Faction />} />
          <Route path="/factions" element={<FactionList />} />
          <Route path="/factions/create" element={<CreateFaction />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
