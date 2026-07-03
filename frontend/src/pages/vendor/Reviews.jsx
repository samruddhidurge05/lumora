import React, { useState } from 'react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useReviews, useVendorProducts } from '../../hooks/useVendorData';
import { 
  Star, 
  MessageSquare, 
  ThumbsUp, 
  AlertCircle, 
  RefreshCw,
  Award,
  Sparkles
} from 'lucide-react';

function Stars({ rating, size = 14 }) {
  const roundedRating = Math.round(Number(rating) || 0);
  return (
    <span style={{ display: 'inline-flex', gap: 2 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <Star 
          key={i} 
          size={size} 
          fill={i <= roundedRating ? '#f59e0b' : 'none'} 
          color={i <= roundedRating ? '#f59e0b' : '#e5e7eb'} 
        />
      ))}
    </span>
  );
}

export default function Reviews() {
  const { 
    reviews: reviewsList, 
    loading: isLoading, 
    error: reviewsError, 
    reply: replyToReview, 
    refresh: refreshReviews 
  } = useReviews();

  const { 
    products: vendorProducts, 
    loading: productsLoading, 
    error: productsError,
    refresh: refreshProducts
  } = useVendorProducts({ limit: 1000 });

  const [tab, setTab] = useState('all');
  const [replyOpen, setReplyOpen] = useState({});
  const [replyText, setReplyText] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [replyError, setReplyError] = useState({});

  const loading = isLoading || productsLoading;
  const backendError = reviewsError || productsError;

  const refreshAll = () => {
    refreshReviews();
    refreshProducts();
  };

  const handleReplySubmit = async (reviewId) => {
    const text = replyText[reviewId]?.trim();
    if (!text) return;

    setSubmitting(prev => ({ ...prev, [reviewId]: true }));
    setReplyError(prev => ({ ...prev, [reviewId]: null }));

    try {
      await replyToReview(reviewId, text);
      setReplyOpen(prev => ({ ...prev, [reviewId]: false }));
      setReplyText(prev => ({ ...prev, [reviewId]: '' }));
    } catch (err) {
      setReplyError(prev => ({ ...prev, [reviewId]: err.message || 'Failed to submit reply' }));
    } finally {
      setSubmitting(prev => ({ ...prev, [reviewId]: false }));
    }
  };

  const filtered = reviewsList.filter(r => tab === 'all' || Math.round(Number(r.rating) || 0) === Number(tab));
  
  const avgRating = reviewsList.length > 0 
    ? (reviewsList.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviewsList.length).toFixed(1)
    : '0.0';

  const dist = [5, 4, 3, 2, 1].map(s => ({ 
    star: s, 
    count: reviewsList.filter(r => Math.round(Number(r.rating) || 0) === s).length 
  }));

  // Dynamic Top Rated Products from database
  const topProductsList = [...vendorProducts]
    .filter(p => p.rating > 0)
    .sort((a, b) => b.rating - a.rating || b.downloads - a.downloads)
    .slice(0, 3);

  const getRatingBadge = (ratingVal) => {
    const val = Number(ratingVal);
    if (val >= 4.5) return { label: 'Excellent', className: 'v-badge-green' };
    if (val >= 3.5) return { label: 'Good', className: 'v-badge-blue' };
    if (val >= 2.5) return { label: 'Average', className: 'v-badge-yellow' };
    return { label: 'Poor', className: 'v-badge-red' };
  };

  const badgeInfo = getRatingBadge(avgRating);

  return (
    <VendorLayout activePage="reviews" title="Reviews" subtitle="Customer feedback and satisfaction insights">
      
      {backendError && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#DC2626',
          fontSize: '13.5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{backendError}</span>
          </div>
          <button 
            className="v-btn v-btn-sm" 
            style={{ 
              background: 'rgba(239, 68, 68, 0.12)', 
              color: '#DC2626', 
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onClick={refreshAll}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {loading ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 24 }}>
            <div className="v-card" style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                animation: 'skeleton-shimmer 1.5s infinite'
              }} />
            </div>
            <div className="v-card" style={{ height: 160, position: 'relative', overflow: 'hidden' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
                animation: 'skeleton-shimmer 1.5s infinite'
              }} />
            </div>
          </div>
          <div className="v-card" style={{ height: 300, position: 'relative', overflow: 'hidden' }}>
            <div style={{
              position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)',
              animation: 'skeleton-shimmer 1.5s infinite'
            }} />
          </div>
        </>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: 20, marginBottom: 24 }}>
            <div className="v-card v-card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 8 }}>
              <div style={{ fontFamily: 'var(--v-serif)', fontSize: 56, color: 'var(--v-dark)', lineHeight: 1 }}>{avgRating}</div>
              <Stars rating={avgRating} size={20} />
              <div style={{ fontSize: 13, color: 'var(--v-text3)' }}>{reviewsList.length} total reviews</div>
              <div className={`v-badge ${badgeInfo.className}`} style={{ marginTop: 4 }}>{badgeInfo.label}</div>
            </div>

            <div className="v-card v-card-pad">
              <div className="v-section-title" style={{ marginBottom: 16 }}>Rating Distribution</div>
              {dist.map(d => (
                <div key={d.star} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 12, color: 'var(--v-text2)', width: 14, textAlign: 'right' }}>{d.star}</span>
                  <span style={{ color: '#f59e0b', fontSize: 13 }}>★</span>
                  <div className="v-progress-track" style={{ flex: 1 }}>
                    <div 
                      className="v-progress-fill" 
                      style={{ 
                        width: `${reviewsList.length > 0 ? (d.count / reviewsList.length) * 100 : 0}%`, 
                        background: d.star >= 4 
                          ? 'linear-gradient(90deg, #B886D0, #7B3FA0)' 
                          : d.star === 3 
                            ? 'linear-gradient(90deg, #fbbf24, #d97706)' 
                            : 'linear-gradient(90deg, #f87171, #dc2626)' 
                      }} 
                    />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--v-text3)', width: 20 }}>{d.count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="v-card v-card-pad" style={{ marginBottom: 24 }}>
            <div className="v-section-header">
              <div className="v-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Award size={16} />
                <span>Top Rated Products</span>
              </div>
            </div>
            {topProductsList.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {topProductsList.map(p => (
                  <div key={p.id} style={{ padding: '14px 16px', borderRadius: 12, background: 'rgba(216,191,227,0.12)', border: '1px solid rgba(184,134,208,0.18)' }}>
                    <div style={{ fontWeight: 500, color: 'var(--v-dark)', fontSize: 13.5, marginBottom: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.title}>{p.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      <Stars rating={p.rating} size={13} />
                      <span style={{ fontWeight: 600, color: 'var(--v-deep)', fontSize: 13 }}>{floatFormat(p.rating)}</span>
                      <span style={{ fontSize: 11, color: 'var(--v-text3)' }}>({p.reviews || 0} reviews)</span>
                    </div>
                    <div className="v-progress-track" style={{ height: 4 }}>
                      <div className="v-progress-fill" style={{ width: `${(p.rating / 5) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 80, color: 'var(--v-text3)' }}>
                <Sparkles size={24} style={{ opacity: 0.3, marginBottom: 6 }} />
                <span style={{ fontSize: 12.5 }}>No product ratings recorded yet</span>
              </div>
            )}
          </div>

          <div className="v-card">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--v-border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="v-section-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <MessageSquare size={16} />
                <span>All Reviews</span>
              </div>
              <div className="v-tabs" style={{ marginLeft: 'auto' }}>
                {['all', '5', '4', '3', '2', '1'].map(t => (
                  <button key={t} className={`v-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                    {t === 'all' ? 'All' : `${t}★`}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ padding: '8px 0' }}>
              {filtered.map(r => (
                <div key={r.id} style={{ padding: '20px 24px', borderBottom: '1px solid rgba(184,134,208,0.10)' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div className="v-avatar v-avatar-md">{(r.customer || 'Customer')[0]}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontWeight: 500, color: 'var(--v-dark)', fontSize: 13.5 }}>{r.customer || 'Customer'}</span>
                        <Stars rating={r.rating} size={13} />
                        <span style={{ fontSize: 11, color: 'var(--v-text3)', marginLeft: 'auto' }}>{r.date}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--v-text3)', marginBottom: 8 }}>on {r.product || 'Unknown Product'}</div>
                      <div style={{ fontSize: 13.5, color: 'var(--v-text)', lineHeight: 1.55 }}>{r.comment || 'No comment text provided.'}</div>
                      
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 10 }}>
                        <span style={{ fontSize: 11, color: 'var(--v-text3)', display: 'flex', alignItems: 'center', gap: 4 }}>
                          <ThumbsUp size={12} />
                          {r.helpful || 0} found helpful
                        </span>
                        <button className="v-btn v-btn-ghost v-btn-sm"
                          onClick={() => setReplyOpen(rv => ({ ...rv, [r.id]: !rv[r.id] }))}>
                          {replyOpen[r.id] ? 'Cancel' : 'Reply'}
                        </button>
                      </div>

                      {replyError[r.id] && (
                        <div style={{ marginTop: 8, color: '#DC2626', fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4 }}>
                          <AlertCircle size={12} />
                          <span>{replyError[r.id]}</span>
                        </div>
                      )}

                      {replyOpen[r.id] && (
                        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                          <textarea 
                            className="v-textarea" 
                            rows={2} 
                            style={{ flex: 1, minHeight: 60 }}
                            placeholder="Write a professional reply..."
                            value={replyText[r.id] || ''}
                            onChange={e => setReplyText(t => ({ ...t, [r.id]: e.target.value }))} 
                            disabled={submitting[r.id]}
                          />
                          <button 
                            className="v-btn v-btn-primary v-btn-sm" 
                            style={{ alignSelf: 'flex-end', display: 'flex', alignItems: 'center', gap: 4 }}
                            onClick={() => handleReplySubmit(r.id)}
                            disabled={submitting[r.id] || !replyText[r.id]?.trim()}
                          >
                            {submitting[r.id] && <RefreshCw size={12} className="v-spin" />}
                            Send
                          </button>
                        </div>
                      )}

                      {r.reply && (
                        <div style={{ 
                          marginTop: 12, 
                          padding: '12px 16px', 
                          borderRadius: '10px',
                          background: 'rgba(168, 85, 247, 0.04)', 
                          borderLeft: '3px solid var(--v-purple)', 
                          fontSize: '13px' 
                        }}>
                          <div style={{ fontWeight: 600, color: 'var(--v-dark)', marginBottom: 4 }}>💬 Your Reply</div>
                          <div style={{ color: 'var(--v-text2)', lineHeight: 1.4 }}>{r.reply}</div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {filtered.length === 0 && (
                <div className="v-empty">
                  <div className="v-empty-icon">💬</div>
                  <div className="v-empty-title">No reviews found</div>
                  <div className="v-empty-sub">There are no reviews matching the selected filter.</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </VendorLayout>
  );
}

function floatFormat(num) {
  return (Number(num) || 0).toFixed(1);
}
