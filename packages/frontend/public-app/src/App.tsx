import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { GexLogo } from './GexLogo';
import { setToken } from './api';
import { HomePage } from './pages/HomePage';
import { BrowsePage } from './pages/BrowsePage';
import { ExperienceDetailPage } from './pages/ExperienceDetailPage';
import { RedeemPage } from './pages/RedeemPage';
import { LoginPage } from './pages/LoginPage';
import { CommunityPage } from './pages/CommunityPage';
import { MissionPage } from './pages/MissionPage';
import { AccountPage } from './pages/AccountPage';

function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
    const observe = () => {
      document.querySelectorAll('.feature, .card, .review-card, .mission-value, .scroll-reveal').forEach(el => {
        observer.observe(el);
      });
    };
    observe();
    const interval = setInterval(observe, 500);
    return () => { observer.disconnect(); clearInterval(interval); };
  }, []);
}

export function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<{ email: string; name?: string } | null>(null);
  useScrollReveal();

  useEffect(() => {
    const stored = localStorage.getItem('gex_user');
    if (stored) {
      try { setUser(JSON.parse(stored)); } catch { /* ignore */ }
    }
    // Listen for storage changes (login/logout from LoginPage)
    const handler = () => {
      const s = localStorage.getItem('gex_user');
      setUser(s ? JSON.parse(s) : null);
    };
    window.addEventListener('storage', handler);
    // Also poll for same-tab changes
    const poll = setInterval(() => {
      const s = localStorage.getItem('gex_user');
      const current = s ? JSON.parse(s) : null;
      if (JSON.stringify(current) !== JSON.stringify(user)) setUser(current);
    }, 500);
    return () => { window.removeEventListener('storage', handler); clearInterval(poll); };
  }, []);

  const handleSignOut = () => {
    localStorage.removeItem('gex_user');
    setToken(null);
    setUser(null);
    setMenuOpen(false);
  };

  return (
    <div className="app">
      <nav className="navbar">
        <Link to="/" className="nav-brand" onClick={() => setMenuOpen(false)}>
          <GexLogo size={36} className="nav-logo-svg" />
          <div className="nav-brand-text">
            GEx
            <span className="logo-accent">Gift Experiences</span>
          </div>
        </Link>
        <button className="nav-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle navigation">
          <span></span><span></span><span></span>
        </button>
        <div className={`nav-links${menuOpen ? ' open' : ''}`}>
          <Link to="/experiences" onClick={() => setMenuOpen(false)}>Browse</Link>
          <Link to="/redeem" onClick={() => setMenuOpen(false)}>Redeem</Link>
          <Link to="/community" onClick={() => setMenuOpen(false)}>Community</Link>
          <Link to="/mission" onClick={() => setMenuOpen(false)}>Our Mission</Link>
          {user ? (
            <>
              <Link to="/account" className="nav-user" onClick={() => setMenuOpen(false)}>{user.name || user.email}</Link>
              <button className="nav-btn" onClick={handleSignOut}>Sign Out</button>
            </>
          ) : (
            <Link to="/login" className="nav-btn" onClick={() => setMenuOpen(false)}>Sign In</Link>
          )}
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/experiences" element={<BrowsePage />} />
          <Route path="/experiences/:id" element={<ExperienceDetailPage />} />
          <Route path="/redeem" element={<RedeemPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/mission" element={<MissionPage />} />
          <Route path="/account" element={<AccountPage />} />
        </Routes>
      </main>
      <footer className="footer">
        <GexLogo size={48} className="footer-logo-svg" />
        <div className="footer-logo">GEx</div>
        <p>Gift Experiences &mdash; Give moments, not things.</p>
      </footer>
    </div>
  );
}