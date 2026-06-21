import React, { useState, useEffect } from 'react';
import { useLanguage } from './LanguageContext';
import { API_BASE } from './config';

interface FactionOption {
  id: number;
  name: string;
  color: string;
  memberCount: number;
}

const Register = () => {
  const [form, setForm] = useState({ email: '', username: '', password: '', factionId: 0 });
  const [factions, setFactions] = useState<FactionOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    fetch(`${API_BASE}/factions`)
      .then(r => r.ok ? r.json() : [])
      .then(setFactions)
      .catch(() => {});
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const body: Record<string, unknown> = {
        email: form.email,
        username: form.username,
        password: form.password,
      };
      if (form.factionId > 0) body.factionId = form.factionId;

      const res = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
        setSuccess('Registration successful! Redirecting to login…');
        setTimeout(() => { window.location.href = '/login'; }, 1000);
        return;
      }

      const data = await res.json().catch(() => null);
      setError(
        data?.details
          ? `${data?.error || 'Registration failed.'} ${data.details}`
          : data?.error || 'Registration failed. Please try again.'
      );
    } catch {
      setError('Unable to connect to the server. Please make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">{t.joinVenueFinder}</h1>
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <input
            className="form-field"
            placeholder={t.email}
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="form-field"
            placeholder={t.username}
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="form-field"
            type="password"
            placeholder={t.password}
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />

          <div>
            <label className="text-sm text-slate-400" style={{ display: 'block', marginBottom: '0.4rem' }}>
              {t.factionOptional}
            </label>
            <select
              className="form-field"
              value={form.factionId}
              onChange={e => setForm({ ...form, factionId: Number(e.target.value) })}
            >
              <option value={0}>{t.noFaction}</option>
              {factions.map(f => (
                <option key={f.id} value={f.id}>
                  {f.name} ({f.memberCount} member{f.memberCount !== 1 ? 's' : ''})
                </option>
              ))}
            </select>
          </div>

          {success && <div className="status-text status-success">{success}</div>}
          {error && <div className="status-text status-error">{error}</div>}

          <button className="button-primary" disabled={isLoading}>
            {isLoading ? <span className="loader" style={{ width: '18px', height: '18px', borderWidth: '2px' }} /> : null}
            {isLoading ? t.registering : t.initializeAccount}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-400">
          {t.alreadyHaveAccount} <a href="/login" className="button-secondary">{t.signIn}</a>
        </div>
      </div>
    </div>
  );
};

export default Register;
