import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { GexLogo } from './GexLogo';
import { DashboardPage } from './pages/DashboardPage';
import { OrdersPage } from './pages/OrdersPage';
import { PartnersPage } from './pages/PartnersPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { LoginPage } from './pages/LoginPage';

export function App() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  if (isLogin) {
    return (
      <div className="login-wrapper">
        <div className="login-brand">
          <GexLogo size={64} />
          <h1>GEx <span>Admin</span></h1>
          <p>Platform administration and analytics</p>
        </div>
        <LoginPage />
      </div>
    );
  }

  const navItems = [
    { to: '/', label: 'Dashboard', icon: '' },
    { to: '/orders', label: 'Orders', icon: '' },
    { to: '/partners', label: 'Partners', icon: '' },
    { to: '/onboarding', label: 'Onboarding', icon: '' },
  ];

  return (
    <div className="app">
      <nav className="sidebar">
        <div className="sidebar-brand">
          <GexLogo size={32} />
          <div>
            <div className="brand-name">GEx</div>
            <div className="brand-sub">Admin Portal</div>
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
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/partners" element={<PartnersPage />} />
          <Route path="/onboarding" element={<OnboardingPage />} />
        </Routes>
      </main>
    </div>
  );
}