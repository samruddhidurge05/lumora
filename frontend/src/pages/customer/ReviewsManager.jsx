import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Plus, Trash2, ShieldAlert, Clock, Loader, Edit2, X, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getMyReviewsApi, createReviewApi, updateReviewApi, deleteReviewApi } from '../../api/reviewApi';

export default function ReviewsManager() {
  const { user } = useAuth();
  const { ownedProducts, products } = useApp();

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal states for Create / Edit
  const [showModal, setShowModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null); // null for create, review obj for edit
  const [formData, setFormData] = useState({ productId: '', rating: 5, comment: '' });
  const [submitting, setSubmitting] = useState(false);

  const ownedItems = products.filter(p => ownedProducts.includes(p.id));

  const resolveTitle = (productId, fallback) =>
    (products.find(p => String(p.id) === String(productId))?.title) || fallback || `Product #${productId}`;

  // 1. Fetch customer reviews
  const fetchMyReviews = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMyReviewsApi();
      if (Array.isArray(data)) {
        setReviews(data.map(r => ({
          id: String(r.id),
          productId: String(r.product_id),
          productTitle: resolveTitle(r.product_id, 'Digital Product'),
          rating: r.rating || 5,
          date: r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recent',
          comment: r.comment || ''
        })));
      }
    } catch (err) {
      console.warn('[ReviewsManager] Error fetching backend reviews:', err);
      setError('Could not fetch verified reviews from server.');
      // Fallback local mock if backend unreachable
      setReviews([
        { id: 'rev-1', productId: '1', productTitle: 'Premium Digital Asset', rating: 5, date: '2 weeks ago', comment: 'The physics transitions feel incredibly premium. Raises the bar for templates.' },
        { id: 'rev-2', productId: '2', productTitle: 'Premium Digital Asset', rating: 4, date: '1 month ago', comment: 'Beautifully organized layer structure. Fits perfectly into our client\'s design stack.' }
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMyReviews();
  }, [user]);

  const openCreateModal = () => {
    setEditingReview(null);
    setFormData({ productId: ownedItems.length > 0 ? String(ownedItems[0].id) : '', rating: 5, comment: '' });
    setShowModal(true);
  };

  const openEditModal = (review) => {
    setEditingReview(review);
    setFormData({ productId: review.productId, rating: review.rating, comment: review.comment });
    setShowModal(true);
  };

  const [formError, setFormError] = useState(null);

  // 2 & 3. Create & Edit review handlers
  const handleSubmitForm = async (e) => {
    e.preventDefault();
    if (!formData.productId) return;
    setSubmitting(true);
    setFormError(null);
    try {
      if (editingReview) {
        // Edit review
        await updateReviewApi(editingReview.id, {
          rating: Number(formData.rating),
          comment: formData.comment
        });
      } else {
        // Create review
        await createReviewApi({
          product_id: Number(formData.productId),
          rating: Number(formData.rating),
          comment: formData.comment
        });
      }
      setShowModal(false);
      setFormError(null);
      fetchMyReviews();
    } catch (err) {
      console.error('[ReviewsManager] Save failed:', err);
      setFormError(err.message || 'Failed to save review. Ensure you have purchased this product.');
    } finally {
      setSubmitting(false);
    }
  };

  // 4. Delete own review
  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this review?")) {
      try {
        await deleteReviewApi(id);
      } catch (err) {
        console.warn('[ReviewsManager] Delete failed on backend:', err);
      }
      setReviews(prev => prev.filter(r => r.id !== id));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', animation: 'fade-in 0.8s ease' }}>
      
      {/* Header with Write Review action */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em' }}>FEEDBACK REGISTRY</span>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>My Reviews & Artifact Ratings</h2>
        </div>
        <button onClick={openCreateModal} className="btn-premium btn-premium-solid" style={{ padding: '10px 18px', fontSize: '0.78rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Plus size={14} /> Write New Review
        </button>
      </div>

      {error && !loading && (
        <div style={{ padding: '12px 20px', borderRadius: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#DC2626', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={fetchMyReviews} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.12)', border: 'none', padding: '6px 12px', borderRadius: '8px', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-mocha)', fontSize: '0.8rem' }}>
          <Clock size={14} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
          <span>Loading your verified reviews...</span>
        </div>
      ) : (
        /* Reviews list */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px' }}>
          {reviews.length > 0 ? (
            reviews.map((r) => (
              <div key={r.id} className="glass-card" style={{ padding: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', border: '1px solid rgba(123, 63, 160, 0.2)', borderRadius: '18px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{resolveTitle(r.productId, r.productTitle)}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-mocha)' }}>• {r.date}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', marginTop: '6px', color: '#EAB308' }}>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={12} fill={i < r.rating ? 'currentColor' : 'none'} stroke="currentColor" />
                    ))}
                  </div>

                  <p style={{ fontSize: '0.82rem', color: 'var(--color-mocha)', marginTop: '12px', lineHeight: '1.5', fontWeight: 500 }}>
                    "{r.comment}"
                  </p>
                </div>

                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <button
                    onClick={() => openEditModal(r)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#7B3FA0', padding: '6px' }}
                    className="clickable"
                    title="Edit review"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={() => handleDelete(r.id)}
                    style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'rgba(220, 38, 38, 0.7)', padding: '6px' }}
                    className="clickable"
                    title="Delete review"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="glass-card" style={{ padding: '50px', textAlign: 'center', color: 'var(--color-mocha)', borderRadius: '20px' }}>
              <MessageSquare size={24} style={{ color: '#7B3FA0', marginBottom: '8px', opacity: 0.7 }} />
              <h4 style={{ fontWeight: 700, color: 'var(--color-espresso)', fontSize: '0.95rem' }}>No published reviews yet</h4>
              <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Share your experience with digital assets you own to help creator communities.</p>
              <button onClick={openCreateModal} className="btn-premium btn-premium-solid" style={{ marginTop: '14px', padding: '8px 18px', fontSize: '0.78rem' }}>Write First Review</button>
            </div>
          )}
        </div>
      )}

      {/* Write review guides */}
      <div className="glass-card" style={{ padding: '28px', background: 'rgba(123, 63, 160, 0.02)', border: '1px solid rgba(123, 63, 160, 0.15)', borderRadius: '18px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <ShieldAlert size={18} style={{ color: '#7B3FA0', marginTop: '2px' }} />
          <div>
            <div style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--color-espresso)' }}>HOW TO REVIEW OWNED ASSETS</div>
            <p style={{ fontSize: '0.78rem', color: 'var(--color-mocha)', marginTop: '4px', lineHeight: '1.4', fontWeight: 500 }}>
              You can post or update reviews for any product in your library. Click <span style={{ fontWeight: 700 }}>Write New Review</span> above or navigate to the Marketplace product details page.
            </p>
          </div>
        </div>
      </div>

      {/* Create / Edit Review Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '500px', background: '#fff', borderRadius: '24px', padding: '28px', boxShadow: '0 20px 60px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '18px', position: 'relative' }}>
            <button onClick={() => setShowModal(false)} style={{ position: 'absolute', top: '20px', right: '20px', background: 'rgba(0,0,0,0.05)', border: 'none', borderRadius: '50%', width: '30px', height: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <X size={15} />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(123,63,160,0.10)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Star size={20} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>{editingReview ? 'Edit Product Review' : 'Write Product Review'}</h3>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Share verified feedback for your digital purchase</span>
              </div>
            </div>

            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {!editingReview && (
                <div>
                  <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Select Owned Product:</label>
                  <select 
                    value={formData.productId} 
                    onChange={e => setFormData(prev => ({ ...prev, productId: e.target.value }))} 
                    required
                    style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '0.82rem', outline: 'none', background: '#FAF8FC' }}
                  >
                    <option value="">Choose product...</option>
                    {ownedItems.map(p => (
                      <option key={p.id} value={p.id}>{p.title}</option>
                    ))}
                    {ownedItems.length === 0 && <option value="1">Digital Product Template</option>}
                  </select>
                </div>
              )}

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Rating (1 to 5 Stars):</label>
                <div style={{ display: 'flex', gap: '8px', color: '#EAB308' }}>
                  {[1, 2, 3, 4, 5].map(starVal => (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, rating: starVal }))}
                      style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }}
                    >
                      <Star size={24} fill={starVal <= formData.rating ? 'currentColor' : 'none'} stroke="currentColor" />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-primary)', display: 'block', marginBottom: '6px' }}>Review Comment:</label>
                <textarea 
                  rows={4}
                  placeholder="Describe what you liked or how this asset helped your project..."
                  value={formData.comment}
                  onChange={e => setFormData(prev => ({ ...prev, comment: e.target.value }))}
                  required
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '0.82rem', outline: 'none', background: '#FAF8FC', fontFamily: 'inherit' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px', flexDirection: 'column' }}>
                {formError && (
                  <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.22)', color: '#DC2626', fontSize: '0.78rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span>⚠</span> {formError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button type="button" onClick={() => { setShowModal(false); setFormError(null); }} style={{ flex: 1, padding: '10px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.15)', background: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>Cancel</button>
                  <button type="submit" disabled={submitting} style={{ flex: 2, padding: '10px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', textAlign: 'center' }}>
                    {submitting ? 'Saving...' : editingReview ? 'Update Review' : 'Publish Review'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
