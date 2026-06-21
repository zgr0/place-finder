import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useLanguage } from './LanguageContext'
import { API_BASE, authHeaders } from './config';


interface RecentReview {
  id: number;
  venueName: string;
  rating: number;
  content: string | null;
  createdAt: string;
}

interface ProfileData {
  id: number;
  username: string;
  factionId: number;
  factionName: string;
  factionColor: string;
  totalPoints: number;
  level: number;
  profilePicture: string | null;
  streak: number;
  recentReviews: RecentReview[];
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <span className="review-stars">
      {'★'.repeat(rating)}{'☆'.repeat(5 - rating)}
    </span>
  );
}

export default function Profile() {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const userId = localStorage.getItem('userId');

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/users/${userId}/profile`);
      if (!res.ok) throw new Error('Failed to load profile');
      setProfile(await res.json());
    } catch {
      setError('Could not load profile. Make sure the server is running.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      setError('Image must be smaller than 4 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      setUploading(true);
      setError('');
      try {
        const res = await fetch(`${API_BASE}/users/${userId}/profile-picture`, {
          method: 'PUT',
          headers: authHeaders(),
          body: JSON.stringify({ profilePicture: base64 }),
        });
        if (!res.ok) throw new Error('Upload failed');
        await fetchProfile();
      } catch {
        setError('Failed to upload picture. Please try again.');
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (!userId) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>👤</div>
          <h2 className="auth-title">{t.signInToViewProfile}</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            {t.signInToSeeStats}
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/login" className="button-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem' }}>
              {t.login}
            </Link>
            <Link to="/register" className="button-primary" style={{ textDecoration: 'none', padding: '0.75rem 1.5rem', background: 'transparent', border: '1px solid var(--primary)', color: 'var(--primary)' }}>
              {t.register}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="auth-page">
        <div style={{ color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.85rem', letterSpacing: '0.06em' }}>
          {t.loadingProfile}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <p style={{ color: '#f87171' }}>{error || t.profileNotFound}</p>
          <button className="button-primary" onClick={fetchProfile} style={{ marginTop: '1rem' }}>{t.retry}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-card">
        {/* Avatar */}
        <div className="profile-avatar-wrap">
          <div className="profile-avatar" style={{ border: `3px solid ${profile.factionColor}` }}>
            {profile.profilePicture
              ? <img src={profile.profilePicture} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : <span style={{ fontSize: '2.2rem', fontWeight: 700, color: 'white' }}>{profile.username.charAt(0).toUpperCase()}</span>
            }
          </div>
          <button
            className="profile-avatar-edit"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            title="Change profile picture"
          >
            {uploading ? '...' : '✎'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>

        {/* Name & Faction */}
        <h1 className="profile-username">{profile.username}</h1>
        <span className="profile-faction-badge" style={{ background: profile.factionColor + '22', color: profile.factionColor, border: `1px solid ${profile.factionColor}55` }}>
          {profile.factionName}
        </span>

        {error && <p style={{ color: '#f87171', fontSize: '0.8rem', marginTop: '0.5rem' }}>{error}</p>}

        {/* Stats */}
        <div className="profile-stats">
          <div className="profile-stat">
            <span className="profile-stat-value">Lv.{profile.level}</span>
            <span className="profile-stat-label">{t.level}</span>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <span className="profile-stat-value">{profile.totalPoints}</span>
            <span className="profile-stat-label">{t.points}</span>
          </div>
          <div className="profile-stat-divider" />
          <div className="profile-stat">
            <span className="profile-stat-value" style={{ color: '#f97316' }}>
              🔥 {profile.streak}
            </span>
            <span className="profile-stat-label">{t.dayStreak}</span>
          </div>
        </div>

        {/* Streak detail */}
        <div className="profile-streak-banner">
          <span style={{ fontSize: '1.5rem' }}>🔥</span>
          <div>
            <div style={{ fontWeight: 700, color: '#f97316', fontSize: '1rem' }}>
              {profile.streak > 0
                ? t.discoveryStreak(profile.streak)
                : t.noActiveStreak}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.1rem' }}>
              {profile.streak > 0
                ? t.keepExploring
                : t.discoverToStart}
            </div>
          </div>
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="profile-section">
        <h2 className="profile-section-title">{t.recentReviews}</h2>
        {profile.recentReviews.length === 0 ? (
          <div className="profile-empty">
            <span style={{ fontSize: '2rem' }}>📝</span>
            <p>{t.noReviewsYet}</p>
          </div>
        ) : (
          <div className="profile-reviews-list">
            {profile.recentReviews.map(review => (
              <div key={review.id} className="review-item">
                <div className="review-item-header">
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '0.9rem', marginBottom: '0.2rem' }}>
                      {review.venueName}
                    </div>
                    <div className="review-date">
                      {new Date(review.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                  <StarDisplay rating={review.rating} />
                </div>
                {review.content && (
                  <p className="review-content">{review.content}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
