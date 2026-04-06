import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setToken } from '../api';

export function LoginPage() {
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isRegister) {
        const fullName = `${firstName} ${lastName}`.trim();
        const tokens = await api.register({ email, password, name: fullName });
        setToken(tokens.accessToken);
        localStorage.setItem('gex_user', JSON.stringify({ email, name: fullName }));
      } else {
        const tokens = await api.login({ email, password });
        setToken(tokens.accessToken);
        localStorage.setItem('gex_user', JSON.stringify({ email }));
      }
      navigate('/');
    } catch (err: any) {
      setError(err.message ?? 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="form-card">
      <h2>{isRegister ? 'Create Account' : 'Sign In'}</h2>
      <form onSubmit={handleSubmit}>
        {isRegister && (
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="firstName">First Name</label>
              <input id="firstName" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" required />
            </div>
            <div className="form-group">
              <label htmlFor="lastName">Last Name</label>
              <input id="lastName" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" required />
            </div>
          </div>
        )}
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" required />
        </div>
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
          {loading ? 'Please wait...' : isRegister ? 'Create Account' : 'Sign In'}
        </button>
      </form>
      {error && <p style={{ color: '#d63031', marginTop: '1rem', textAlign: 'center' }}>{error}</p>}
      <p style={{ textAlign: 'center', marginTop: '1.5rem' }}>
        {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
        <button onClick={() => { setIsRegister(!isRegister); setError(''); }}
          style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontWeight: 600 }}>
          {isRegister ? 'Sign In' : 'Register'}
        </button>
      </p>
    </div>
  );
}