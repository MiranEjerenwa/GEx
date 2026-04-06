import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { GexLogo } from './GexLogo';
import { DashboardPage } from './pages/DashboardPage';
import { ExperiencesPage } from './pages/ExperiencesPage';
import { BookingsPage } from './pages/BookingsPage';
import { LoginPage } from './pages/LoginPage';

export function App() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  if (isLogin) {
    return (
      <div className="login-wrapper">
        <div className="login-brand">
          <GexLogo size={64} />
          <h1>GEx <span>Partner</span></h1>
          <p>Manage your experiences and bookings</p>
        </div>
        <LoginPage />
      </div>
    );
  }

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '' },
    { to: '/experiences', label: 'Experiences', icon: '' },
    { to: '/bookings', label: 'Bookings', icon: '' },
  ];

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <GexLogo size={32} />
          <div>
            <div className="brand-name">GEx</div>
            <div className="brand-sub">Partner Portal</div>
          </div>
        </div>
        <div className="sidebar-links">
          {navItems.map(item => (
            <Link key={item.to} to={item.to} className={location.pathname === item.to ? 'active' : ''}>
              <span className="nav-icon">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </div>
        <div className="sidebar-footer">
          <Link to="/login">Sign Out</Link>
        </div>
      </nav>
      <main className="main-content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/experiences" element={<ExperiencesPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
        </Routes>
      </main>
    </div>
  );
}