import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useLanguage } from './LanguageContext';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:3000/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('userId', data.id);
        localStorage.setItem('username', data.username);
        localStorage.setItem('factionId', data.factionId ?? '');
        localStorage.setItem('factionName', data.factionName ?? '');
        localStorage.setItem('factionColor', data.factionColor ?? '');
        localStorage.setItem('factionIcon', data.factionIcon ?? '');
        window.dispatchEvent(new Event('auth-change'));
        setSuccess('Login successful! Redirecting');
        setTimeout(() => navigate('/'), 500);
        return;
      }

      const data = await res.json().catch(() => null);
      setError(
        data?.details
          ? `${data?.error || 'Login failed.'} ${data.details}`
          : data?.error || 'Login failed. Check your credentials.'
      );
    } catch (err) {
      setError('Unable to connect to the server. Please ensure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t.loginTitle}</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            className="form-field"
            type="email"
            placeholder={t.email}
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="form-field"
            type="password"
            placeholder={t.password}
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
          {success && <div className="status-text status-success">{success}</div>}
          {error && <div className="status-text status-error">{error}</div>}
          <button className="button-primary" disabled={isLoading}>
            {isLoading ? <span className="loader" style={{width: '18px', height: '18px', borderWidth: '2px'}}></span> : null}
            {isLoading ? t.signingIn : t.signIn}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-400">
          {t.noAccount} <Link to="/register" className="button-secondary">{t.register}</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
