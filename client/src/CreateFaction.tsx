import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLanguage } from './LanguageContext';
import { API_BASE, authHeaders } from './config';

const PRESET_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

const EMOJI_OPTIONS = [
  '⚔️','🛡️','🏰','👑','🔥','⚡','🌊','🌪️',
  '🐉','🦁','🐺','🦅','🦊','🐻','🦈','🦂',
  '💀','🗡️','🪓','🏹','🔱','⚜️','🌟','💥',
  '🧊','🌑','☠️','🎯','🪬','🔮','🧿','🪄',
];

export default function CreateFaction() {
  const [form, setForm] = useState({ name: '', color: '#3b82f6', icon: '⚔️', description: '' });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { t } = useLanguage();

  const userId = parseInt(localStorage.getItem('userId') || '0');

  if (!userId) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏰</div>
          <h2 className="auth-title">{t.createFaction}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {t.mustBeLoggedIn}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/login" className="button-primary" style={{ textDecoration: 'none' }}>{t.login}</Link>
            <Link to="/factions" style={{ color: 'var(--text-muted)', fontSize: '0.875rem', alignSelf: 'center', textDecoration: 'none' }}>← Back</Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { setError(t.factionNameRequired); return; }
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/factions`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: form.name.trim(),
          color: form.color,
          icon: form.icon,
          description: form.description.trim() || null,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.token) localStorage.setItem('token', data.token);
        localStorage.setItem('factionId', String(data.id));
        localStorage.setItem('factionName', data.name);
        localStorage.setItem('factionColor', data.color);
        localStorage.setItem('factionIcon', data.icon);
        window.dispatchEvent(new Event('auth-change'));
        navigate('/faction');
        return;
      }
      const data = await res.json().catch(() => null);
      setError(data?.details || data?.error || 'Failed to create faction');
    } catch {
      setError('Unable to connect to server');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ maxWidth: '500px', width: '100%' }}>
        <div style={{ marginBottom: '0.75rem' }}>
          <Link to="/factions" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '0.85rem' }}>
            {t.backToFactions}
          </Link>
        </div>
        <h1 className="auth-title">{t.createFaction}</h1>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            className="form-field"
            placeholder={t.factionName}
            value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            maxLength={40}
          />

          {/* Icon picker */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              {t.factionIcon}
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 1fr)',
              gap: '0.3rem',
              background: 'var(--bg-dark)',
              border: '1px solid var(--border-light)',
              borderRadius: 10,
              padding: '0.6rem',
            }}>
              {EMOJI_OPTIONS.map(emoji => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setForm({ ...form, icon: emoji })}
                  style={{
                    fontSize: '1.35rem',
                    padding: '0.3rem',
                    borderRadius: 7,
                    border: '2px solid',
                    borderColor: form.icon === emoji ? form.color : 'transparent',
                    background: form.icon === emoji ? `${form.color}22` : 'transparent',
                    cursor: 'pointer',
                    lineHeight: 1,
                    transition: 'border-color 0.1s, background 0.1s',
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Color picker */}
          <div>
            <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.5rem' }}>
              {t.factionColor}
            </label>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
              <input
                type="color"
                value={form.color}
                onChange={e => setForm({ ...form, color: e.target.value })}
                style={{
                  width: 48, height: 40, borderRadius: 8,
                  border: '1px solid var(--border-light)',
                  background: 'none', cursor: 'pointer', padding: 2,
                }}
              />
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    style={{
                      width: 30, height: 30, borderRadius: 6,
                      background: c, padding: 0, cursor: 'pointer',
                      border: form.color === c ? '2.5px solid white' : '2.5px solid transparent',
                      outline: form.color === c ? `2px solid ${c}` : 'none',
                      transition: 'border 0.1s',
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          <textarea
            className="form-field"
            placeholder={t.factionDescription}
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            rows={3}
            maxLength={280}
            style={{ resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
          />

          {/* Live preview */}
          <div style={{
            background: 'var(--bg-dark)',
            border: '1px solid var(--border-light)',
            borderLeft: `4px solid ${form.color}`,
            borderRadius: 10,
            padding: '0.875rem 1rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
          }}>
            <div style={{
              width: 42, height: 42, borderRadius: 8,
              background: form.color, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.3rem',
            }}>
              {form.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.95rem' }}>
                {form.name || t.factionName}
              </div>
              {form.description && (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '0.15rem', lineHeight: 1.4 }}>
                  {form.description}
                </div>
              )}
            </div>
          </div>

          {error && <div className="status-text status-error">{error}</div>}

          <button className="button-primary" disabled={isLoading} style={{ marginTop: '0.25rem' }}>
            {isLoading
              ? <><span className="loader" style={{ width: 18, height: 18, borderWidth: 2, display: 'inline-block', marginRight: 6 }} />{t.creating}</>
              : t.createFaction}
          </button>
        </form>
      </div>
    </div>
  );
}
