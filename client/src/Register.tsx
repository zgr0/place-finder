import React, { useState } from 'react';

const Register = () => {
  const [form, setForm] = useState({ email: '', username: '', password: '', factionId: 1 });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      const res = await fetch('http://localhost:3000/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        setSuccess('Registration successful! Redirecting to login');
        setTimeout(() => {
          window.location.href = '/login';
        }, 1000);
        return;
      }

      const data = await res.json().catch(() => null);
      setError(
        data?.details
          ? `${data?.error || 'Registration failed.'} ${data.details}`
          : data?.error || 'Registration failed. Please try again.'
      );
    } catch (err) {
      setError('Unable to connect to the server. Please make sure the backend is running.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1 className="auth-title">Join Venue Finder</h1>
        <form onSubmit={handleRegister} className="flex flex-col gap-4">
          <input
            className="form-field"
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="form-field"
            placeholder="Username"
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="form-field"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />

          <label className="text-sm text-slate-400">Select your faction</label>
          <select
            className="form-field"
            value={form.factionId}
            onChange={e => setForm({ ...form, factionId: Number(e.target.value) })}
          >
            <option value="1">Red Reapers (Attack)</option>
            <option value="2">Blue Sentinels (Defense)</option>
            <option value="3">Green Guardians (Exploration)</option>
          </select>

          {success && <div className="status-text status-success">{success}</div>}
          {error && <div className="status-text status-error">{error}</div>}

          <button className="button-primary" disabled={isLoading}>
            {isLoading ? <span className="loader" style={{width: '18px', height: '18px', borderWidth: '2px'}}></span> : null}
            {isLoading ? 'Registering...' : 'Initialize Account'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-400">
          Already have an account? <a href="/login" className="button-secondary">Sign In</a>
        </div>
      </div>
    </div>
  );
};

export default Register;