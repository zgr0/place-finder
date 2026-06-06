import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const API_BASE = 'http://localhost:3000';

interface FactionInfo {
  id: number;
  name: string;
  color: string;
  icon: string;
  description: string | null;
  memberCount: number;
  totalPoints: number;
  createdAt: string;
  creatorName: string | null;
}

export default function FactionList() {
  const [factions, setFactions] = useState<FactionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [joiningId, setJoiningId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const userId = parseInt(localStorage.getItem('userId') || '0');
  const currentFactionId = parseInt(localStorage.getItem('factionId') || '0');

  useEffect(() => {
    fetch(`${API_BASE}/factions`)
      .then(r => r.json())
      .then(setFactions)
      .catch(() => setError('Failed to load factions'))
      .finally(() => setLoading(false));
  }, []);

  const handleJoin = async (factionId: number) => {
    if (!userId) { navigate('/login'); return; }
    setJoiningId(factionId);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/factions/${factionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('factionId', String(data.factionId));
        localStorage.setItem('factionName', data.factionName);
        localStorage.setItem('factionColor', data.factionColor);
        localStorage.setItem('factionIcon', data.factionIcon ?? '⚔️');
        window.dispatchEvent(new Event('auth-change'));
        navigate('/faction');
      } else {
        const data = await res.json().catch(() => null);
        setError(data?.error || 'Failed to join faction');
      }
    } catch {
      setError('Unable to connect to server');
    } finally {
      setJoiningId(null);
    }
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '860px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ color: 'var(--text-main)', fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Factions</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: '0.3rem 0 0' }}>
            Join a faction to compete for territory
          </p>
        </div>
        <Link
          to="/factions/create"
          className="button-primary"
          style={{ textDecoration: 'none', padding: '0.6rem 1.2rem', fontSize: '0.875rem' }}
        >
          + Create Faction
        </Link>
      </div>

      {error && <div className="status-text status-error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {loading && (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '4rem' }}>
          <span className="loader" style={{ display: 'inline-block', width: 28, height: 28 }} />
        </div>
      )}

      {!loading && factions.length === 0 && (
        <div style={{
          textAlign: 'center', color: 'var(--text-muted)', padding: '3rem',
          border: '1px dashed var(--border-light)', borderRadius: '12px',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>⚔️</div>
          <p style={{ margin: '0 0 1.25rem' }}>No factions yet. Be the first to create one!</p>
          <Link to="/factions/create" className="button-primary" style={{ textDecoration: 'none' }}>
            Create Faction
          </Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
        {factions.map(faction => {
          const isMine = faction.id === currentFactionId;
          return (
            <div
              key={faction.id}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-light)',
                borderLeft: `4px solid ${faction.color}`,
                borderRadius: '12px',
                padding: '1.1rem 1.4rem',
                display: 'flex',
                alignItems: 'center',
                gap: '1.1rem',
              }}
            >
              <div style={{
                width: 44, height: 44, borderRadius: 8,
                background: faction.color, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '1.2rem',
              }}>
                {faction.icon}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 700, fontSize: '0.975rem' }}>
                    {faction.name}
                  </span>
                  {isMine && (
                    <span style={{
                      background: faction.color, color: '#000',
                      fontSize: '0.62rem', fontWeight: 700,
                      padding: '0.12rem 0.45rem', borderRadius: 4,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                    }}>
                      Your Faction
                    </span>
                  )}
                </div>
                {faction.description && (
                  <p style={{
                    color: 'var(--text-muted)', fontSize: '0.83rem',
                    margin: '0.2rem 0 0', lineHeight: 1.45,
                    overflow: 'hidden', textOverflow: 'ellipsis',
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {faction.description}
                  </p>
                )}
                <div style={{
                  display: 'flex', gap: '1rem', marginTop: '0.4rem',
                  fontSize: '0.73rem', color: 'var(--text-muted)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  <span>{faction.memberCount} member{faction.memberCount !== 1 ? 's' : ''}</span>
                  <span>{faction.totalPoints.toLocaleString()} pts</span>
                  {faction.creatorName && <span>by {faction.creatorName}</span>}
                </div>
              </div>

              <div style={{ flexShrink: 0 }}>
                {isMine ? (
                  <button
                    className="button-primary"
                    style={{ opacity: 0.55, cursor: 'default', fontSize: '0.8rem', padding: '0.45rem 1rem' }}
                    disabled
                  >
                    Joined
                  </button>
                ) : (
                  <button
                    className="button-primary"
                    style={{ fontSize: '0.8rem', padding: '0.45rem 1rem' }}
                    onClick={() => handleJoin(faction.id)}
                    disabled={joiningId === faction.id}
                  >
                    {joiningId === faction.id
                      ? '…'
                      : userId
                        ? 'Join'
                        : 'Login to Join'}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
