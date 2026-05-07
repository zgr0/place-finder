import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const Login = () => {
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

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
        <h1 className="auth-title">LOGIN</h1>
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            className="form-field"
            type="email"
            placeholder="Email"
            value={form.email}
            onChange={e => setForm({ ...form, email: e.target.value })}
          />
          <input
            className="form-field"
            type="password"
            placeholder="Password"
            value={form.password}
            onChange={e => setForm({ ...form, password: e.target.value })}
          />
          {success && <div className="status-text status-success">{success}</div>}
          {error && <div className="status-text status-error">{error}</div>}
          <button className="button-primary" disabled={isLoading}>
            {isLoading ? <span className="loader" style={{width: '18px', height: '18px', borderWidth: '2px'}}></span> : null}
            {isLoading ? 'Signing in...' : 'SIGN IN'}
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-400">
          Don&apos;t have an account? <Link to="/register" className="button-secondary">Register</Link>
        </div>
      </div>
    </div>
  );
};

export default Login;
