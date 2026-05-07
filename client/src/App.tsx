import './App.css'
import { useState } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import Map from './Map'
import MapGrid from './mapgrid'
import Login from './Login'
import Register from './Register'

function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  return (
    <div className="app-shell flex-layout">
      {isSidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}
      
      <aside className={`app-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="app-brand">
          <span className="brand-icon">🗺️</span>
          Place Finder
          <button className="sidebar-close-btn" onClick={toggleSidebar}>×</button>
        </div>
        <nav className="app-nav sidebar-nav">
          <Link to="/" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
            <span className="nav-icon">📍</span> Venues
          </Link>
          <Link to="/hex" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
            <span className="nav-icon">⬡</span> Hex Grid
          </Link>
          <div className="nav-divider"></div>
          <Link to="/login" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
            <span className="nav-icon">🔑</span> Login
          </Link>
          <Link to="/register" className="app-nav-link" onClick={() => setIsSidebarOpen(false)}>
            <span className="nav-icon">📝</span> Register
          </Link>
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
        </Routes>
      </main>
    </div>
  )
}

export default App
