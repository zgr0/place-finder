import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from './LanguageContext';
import { API_BASE, authHeaders } from './config';

interface ReviewModalProps {
  venueName: string;
  onClose: () => void;
}

const StarRating = ({ rating, setRating }: { rating: number, setRating: (r: number) => void }) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="star-container">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          type="button"
          key={star}
          className={`star-btn ${star <= (hover || rating) ? 'active' : 'inactive'}`}
          onClick={() => setRating(star)}
          onMouseEnter={() => setHover(star)}
          onMouseLeave={() => setHover(0)}
        >
          ★
        </button>
      ))}
    </div>
  );
};

const ReviewModal: React.FC<ReviewModalProps> = ({ venueName, onClose }) => {
  const navigate = useNavigate();
  const [rating, setRating] = useState<number>(5);
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    if (!venueName) return;
    const fetchReviews = async () => {
      setLoadingReviews(true);
      try {
        const res = await fetch(`${API_BASE}/reviews/${encodeURIComponent(venueName)}`);
        if (res.ok) {
          const data = await res.json();
          setReviews(data);
        }
      } catch (err) {
        console.error('Error fetching reviews:', err);
      } finally {
        setLoadingReviews(false);
      }
    };
    fetchReviews();
  }, [venueName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    const userIdStr = localStorage.getItem('userId');
    if (!userIdStr) {
      setError('You must be logged in to write a review. Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ venueName, rating, content }),
      });

      if (res.ok) {
        setSuccess('Review submitted successfully!');
        setRating(5);
        setContent('');
        // Refresh reviews
        const fetchRes = await fetch(`${API_BASE}/reviews/${encodeURIComponent(venueName)}`);
        if (fetchRes.ok) {
          const data = await fetchRes.json();
          setReviews(data);
        }
        return;
      }

      const data = await res.json().catch(() => null);
      setError(data?.error || 'Failed to submit review.');
    } catch (err) {
      setError('Unable to connect to the server.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="review-modal-overlay">
      <div className="review-modal-content">
        
        <div className="review-modal-header">
          <div>
            <h1 className="review-modal-title">{t.reviewVenue}</h1>
            <p className="review-modal-subtitle">{venueName}</p>
          </div>
          <button onClick={onClose} className="review-modal-close">
            ✕
          </button>
        </div>

        <div className="review-modal-body">
          <section>
            <form onSubmit={handleSubmit} className="flex-col gap-4">
              <StarRating rating={rating} setRating={setRating} />
              
              <div className="flex-col mt-4">
                <textarea
                  className="review-textarea"
                  placeholder={t.shareExperience}
                  value={content}
                  onChange={e => setContent(e.target.value)}
                />
              </div>
              
              {success && <div className="status-text status-success mt-4">{success}</div>}
              {error && <div className="status-text status-error mt-4">{error}</div>}
              
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
                <button 
                  type="submit" 
                  className="button-primary" 
                  style={{ width: 'auto', padding: '0 2rem', minHeight: '2.5rem' }}
                  disabled={isLoading}
                >
                  {isLoading ? <span className="loader" style={{width: '18px', height: '18px', borderWidth: '2px'}}></span> : null}
                  {isLoading ? t.posting : t.postReview}
                </button>
              </div>
            </form>
          </section>

          <hr style={{ borderColor: 'var(--border-light)', margin: '0' }} />

          <section>
            <h2 style={{ color: 'var(--text-main)', marginTop: '0', marginBottom: '1rem' }}>{t.pastReviews}</h2>
            {loadingReviews ? (
              <div className="text-center text-slate-400">{t.loadingReviews}</div>
            ) : reviews.length > 0 ? (
              <div className="flex-col">
                {reviews.map((r, i) => (
                  <div key={i} className="review-item">
                    <div className="review-item-header">
                      <div className="review-user-info">
                        <div className="review-avatar">
                          {r.user.username.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="review-username">{r.user.username}</div>
                          <div className="review-date">
                            {new Date(r.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      </div>
                      <div className="review-stars">
                        {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                      </div>
                    </div>
                    <p className="review-content">{r.content || t.noTextProvided}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-slate-400" style={{ padding: '2rem', background: 'rgba(0,0,0,0.2)', borderRadius: '12px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📝</div>
                <div style={{ fontWeight: '500' }}>{t.noReviews}</div>
                <div style={{ fontSize: '0.85rem' }}>{t.beFirst}</div>
              </div>
            )}
          </section>

        </div>
      </div>
    </div>
  );
};

export default ReviewModal;
