import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from './LanguageContext'
import { API_BASE, authHeaders } from './config';


interface ChatMessage {
  id: number;
  userId: number;
  content: string;
  type: string;
  createdAt: string;
  user: { username: string; profilePicture: string | null };
}

interface Member {
  id: number;
  username: string;
  profilePicture: string | null;
  level: number;
  totalPoints: number;
}

function Avatar({ username, picture, size = 32 }: { username: string; picture: string | null; size?: number }) {
  return picture ? (
    <img src={picture} alt={username} style={{ width: size, height: size, borderRadius: 4, objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: 4, background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0C0B10', fontWeight: 700, fontSize: size * 0.4, flexShrink: 0 }}>
      {username.charAt(0).toUpperCase()}
    </div>
  );
}

function VenueCard({ venueName, sharedPlaceLabel }: { venueName: string; sharedPlaceLabel: string }) {
  return (
    <div className="faction-venue-card">
      <span style={{ fontSize: '1rem' }}>📍</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{sharedPlaceLabel}</div>
        <div style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '0.9rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{venueName}</div>
      </div>
    </div>
  );
}

export default function Faction() {
  const [messages, setMessages]           = useState<ChatMessage[]>([]);
  const [members, setMembers]             = useState<Member[]>([]);
  const [text, setText]                   = useState('');
  const [sending, setSending]             = useState(false);
  const [showVenuePicker, setShowVenuePicker] = useState(false);
  const [showRanking, setShowRanking] = useState(false);
  const [allVenues, setAllVenues]         = useState<string[]>([]);
  const [venueSearch, setVenueSearch]     = useState('');
  const [showMembers, setShowMembers]     = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLTextAreaElement>(null);
  const { t } = useLanguage();

  const userId      = parseInt(localStorage.getItem('userId') || '0');
  const factionId   = parseInt(localStorage.getItem('factionId') || '0');
  const factionName  = localStorage.getItem('factionName') || 'Your Faction';
  const factionColor = localStorage.getItem('factionColor') || 'var(--primary)';
  const factionIcon  = localStorage.getItem('factionIcon') || '⚔️';

  // initial load
  useEffect(() => {
    if (!factionId) return;
    fetchMessages();
    fetchMembers();
    fetchVenues();
  }, [factionId]);

  // poll every 3 s
  useEffect(() => {
    if (!factionId) return;
    const id = setInterval(fetchMessages, 3000);
    return () => clearInterval(id);
  }, [factionId]);

  // scroll to bottom when messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`${API_BASE}/factions/${factionId}/messages`);
      if (res.ok) setMessages(await res.json());
    } catch { /* silent */ }
  };

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${API_BASE}/factions/${factionId}/members`);
      if (res.ok) setMembers(await res.json());
    } catch { /* silent */ }
  };

  const fetchVenues = async () => {
    try {
      const res = await fetch(`${API_BASE}/venues`);
      if (!res.ok) return;
      const data = await res.json();
      const names: string[] = (data.features || [])
        .map((f: any) => f.properties?.name)
        .filter(Boolean);
      setAllVenues([...new Set(names)] as string[]);
    } catch { /* silent */ }
  };

  const sendMessage = async (content: string, type = 'text') => {
    if (!content.trim() || sending) return;
    setSending(true);
    try {
      await fetch(`${API_BASE}/factions/${factionId}/messages`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ content: content.trim(), type }),
      });
      await fetchMessages();
    } finally {
      setSending(false);
    }
  };

  const handleSend = async () => {
    await sendMessage(text);
    setText('');
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleVenueShare = async (venueName: string) => {
    setShowVenuePicker(false);
    setVenueSearch('');
    await sendMessage(venueName, 'venue');
  };

  const filteredVenues = allVenues.filter(v =>
    v.toLowerCase().includes(venueSearch.toLowerCase())
  );

  if (!userId) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⚔️</div>
          <h2 className="auth-title">{t.factionChatTitle}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {t.loginToChat}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/login" className="button-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem' }}>{t.login}</Link>
            <Link to="/register" className="button-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}>{t.register}</Link>
          </div>
        </div>
      </div>
    );
  }

  if (!factionId) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>🏰</div>
          <h2 className="auth-title">{t.noFactionYet}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {t.joinFactionToChat}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/factions" className="button-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem' }}>{t.browseFactions}</Link>
            <Link to="/factions/create" className="button-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}>{t.createFaction}</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="faction-page">

      {/* Header */}
      <div className="faction-header" style={{ borderTopColor: factionColor }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: factionColor, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem' }}>{factionIcon}</div>
          <span className="faction-header-name">{factionName}</span>
          <span className="faction-header-badge">{members.length} {t.members.toLowerCase()}</span>
        </div>
        <div style={{ display: 'flex', gap: '0.4rem' }}>
          <button className="faction-members-toggle" onClick={() => { setShowRanking(false); setShowMembers(v => !v); }}>
            {showMembers ? t.hide : t.members}
          </button>
          <button className="faction-members-toggle" onClick={() => { setShowMembers(false); setShowRanking(v => !v); }}>
            {showRanking ? t.hide : '🏆'}
          </button>
        </div>
      </div>

      {/* Members panel */}
      {showMembers && (
        <div className="faction-members-panel">
          {members.map(m => (
            <div key={m.id} className="faction-member-chip">
              <Avatar username={m.username} picture={m.profilePicture} size={28} />
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-main)' }}>{m.username}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Lv.{m.level}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Rankings panel */}
      {showRanking && (
        <div className="faction-members-panel" style={{ flexDirection: 'column', gap: '0.35rem' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.15rem' }}>
            {t.memberRankings}
          </div>
          {[...members].sort((a, b) => b.totalPoints - a.totalPoints).map((m, i) => (
            <div key={m.id} className="faction-ranking-row">
              <span className="faction-ranking-pos">#{i + 1}</span>
              <Avatar username={m.username} picture={m.profilePicture} size={24} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-main)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username}</div>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>Lv.{m.level}</div>
              </div>
              <span className="faction-ranking-pts">{m.totalPoints.toLocaleString()} pts</span>
            </div>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="faction-messages">
        {messages.length === 0 && (
          <div className="faction-empty">
            <span style={{ fontSize: '2rem' }}>⚔️</span>
            <p>{t.noMessages}</p>
          </div>
        )}
        {messages.map(msg => {
          const isOwn = msg.userId === userId;
          return (
            <div key={msg.id} className={`faction-msg ${isOwn ? 'faction-msg-own' : ''}`}>
              <Avatar username={msg.user.username} picture={msg.user.profilePicture} size={30} />
              <div className="faction-msg-body">
                <div className="faction-msg-meta">
                  <span className="faction-msg-author" style={isOwn ? { color: factionColor } : {}}>{msg.user.username}</span>
                  <span className="faction-msg-time">
                    {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                {msg.type === 'venue'
                  ? <VenueCard venueName={msg.content} sharedPlaceLabel={t.sharedPlace} />
                  : <p className="faction-msg-text">{msg.content}</p>
                }
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="faction-input-bar">
        <button
          className="faction-share-btn"
          onClick={() => setShowVenuePicker(v => !v)}
          title="Share a place"
        >
          📍
        </button>
        <textarea
          ref={inputRef}
          className="faction-input"
          rows={1}
          placeholder={t.messageFaction}
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <button
          className="faction-send-btn"
          onClick={handleSend}
          disabled={!text.trim() || sending}
          style={{ borderColor: factionColor, color: factionColor }}
        >
          {sending ? '…' : '▶'}
        </button>
      </div>

      {/* Venue picker */}
      {showVenuePicker && (
        <div className="faction-venue-picker">
          <div className="faction-venue-picker-header">
            <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.85rem' }}>{t.sharePlace}</span>
            <button onClick={() => { setShowVenuePicker(false); setVenueSearch(''); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.1rem' }}>×</button>
          </div>
          <input
            className="form-field"
            placeholder={t.searchVenues}
            value={venueSearch}
            onChange={e => setVenueSearch(e.target.value)}
            autoFocus
            style={{ margin: '0.5rem 0', fontSize: '0.875rem' }}
          />
          <div className="faction-venue-list">
            {filteredVenues.length === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '0.75rem', textAlign: 'center' }}>{t.noVenuesFound}</div>
            )}
            {filteredVenues.slice(0, 30).map(v => (
              <button key={v} className="faction-venue-item" onClick={() => handleVenueShare(v)}>
                <span>📍</span> {v}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
