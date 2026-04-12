import './App.css'
import { Link, Route, Routes } from 'react-router-dom'
import Map from './Map'
import MapGrid from './mapgrid'
import Login from './Login'
import Register from './Register'

function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">Place Finder</div>
          <nav className="app-nav">
            <Link to="/" className="app-nav-link">
              Venues Map
            </Link>
            <Link to="/hex" className="app-nav-link">
              Hex Grid
            </Link>
            <Link to="/login" className="app-nav-link">
              Login
            </Link>
            <Link to="/register" className="app-nav-link">
              Register
            </Link>
          </nav>
        </div>
      </header>
      <main className="app-main">
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
