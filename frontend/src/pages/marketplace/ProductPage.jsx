import React, { useState, useEffect } from 'react';
import { ArrowLeft, Star, ShoppingBag, Zap, Download, Shield, Heart, MessageSquare, Package, ChevronLeft, ChevronRight, Check, BadgeCheck, Flag } from 'lucide-react';
import ProductQrCode from '../../components/product/ProductQrCode';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { createConversation } from '../../services/messageService';
import { togglePriceAlertSubscription } from '../../services/priceAlertService';
import { trackProductViewing } from '../../services/historyService';
import { getReviewsApi, createReviewApi } from '../../api/reviewApi';
import { backendFetch } from '../../utils/api';

// Same gallery images as Products page
const CAT_GALLERY = {
  'UI Kits':              ['https://images.unsplash.com/photo-1561070791-2526d30994b5?w=800&q=85','https://images.unsplash.com/photo-1587440871875-191322ee64b0?w=800&q=85','https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=800&q=85','https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=85'],
  'Mobile App Designs':   ['https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&q=85','https://images.unsplash.com/photo-1622979135225-d2ba269cf1ac?w=800&q=85','https://images.unsplash.com/photo-1551650975-87deedd944c3?w=800&q=85','https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=85'],
  'React Templates':      ['https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&q=85','https://images.unsplash.com/photo-1593720213428-28a5b9e94613?w=800&q=85','https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800&q=85','https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800&q=85'],
  'Website Templates':    ['https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=800&q=85','https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&q=85','https://images.unsplash.com/photo-1533750349088-cd871a92f312?w=800&q=85','https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=85'],
  'Design Assets':        ['https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=85','https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?w=800&q=85','https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800&q=85','https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=800&q=85'],
  'E-books':              ['https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&q=85','https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&q=85','https://images.unsplash.com/photo-1432821596592-e2c18b78144f?w=800&q=85','https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=800&q=85'],
  'Notion Templates':     ['https://images.unsplash.com/photo-1517842645767-c639042777db?w=800&q=85','https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=800&q=85','https://images.unsplash.com/photo-1507925921958-8a62f3d1a50d?w=800&q=85','https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=85'],
  'Social Media Kits':    ['https://images.unsplash.com/photo-1611162617213-7d7a39e9b1d7?w=800&q=85','https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&q=85','https://images.unsplash.com/photo-1562577309-4932fdd64cd1?w=800&q=85','https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=800&q=85'],
  'AI Tools':             ['https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=85','https://images.unsplash.com/photo-1677442135703-1787eea5ce01?w=800&q=85','https://images.unsplash.com/photo-1676277791608-ac54525aa94d?w=800&q=85','https://images.unsplash.com/photo-1695654395926-68cefd20b6cc?w=800&q=85'],
};

function getGallery(product) {
  // Prefer explicitly stored pCloud/external image URLs (image_urls column)
  const pcloudImages = Array.isArray(product.image_urls || product.imageUrls)
    ? (product.image_urls || product.imageUrls).filter(Boolean)
    : [];

  const extraImages = Array.isArray(product.previewImages || product.preview_images)
    ? (product.previewImages || product.preview_images).filter(Boolean)
    : [];

  // Build the full gallery pool — pCloud images take priority over preview/thumbnail
  const allGallery = pcloudImages.length > 0 ? pcloudImages : extraImages;

  // Pick the best single primary: prefer non-Unsplash thumbnail/preview, else first gallery image
  const rawPrimary = product.preview || product.thumbnail || null;
  const isPlaceholder = !rawPrimary || rawPrimary.includes('unsplash.com');
  const primary = isPlaceholder
    ? (allGallery[0] || null)
    : rawPrimary;

  if (!primary) {
    // Absolute fallback only when there are truly no images at all
    const fallback = 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&q=85';
    const catImgs = CAT_GALLERY[product.category] || CAT_GALLERY['Design Assets'];
    return [fallback, ...catImgs.filter(img => img !== fallback)].slice(0, 5);
  }

  // De-duplicate: primary first, then the rest of the gallery
  const rest = allGallery.filter(img => img !== primary);
  if (rest.length > 0) {
    return [primary, ...rest];
  }

  // Only a single real image — also try vendor thumbnail if different
  if (!isPlaceholder && rawPrimary !== primary) {
    return [primary, rawPrimary];
  }

  return [primary];
}

export default function ProductPage() {
  const { getActiveProduct, addToCart, buyNow, navigateTo, formatPrice, wishlist, toggleWishlist, ownedProducts, products, addReview } = useApp();
  const { user, userRole } = useAuth();
  const product = getActiveProduct();
  const [activeTab, setActiveTab] = useState('overview');
  const [activeImg, setActiveImg] = useState(0);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);
  // Backend-loaded reviews
  const [backendReviews, setBackendReviews] = useState(null); // null = not yet fetched

  // ── Report modal state (fully isolated from purchase/cart flow) ──────────
  const [reportModalOpen, setReportModalOpen]       = useState(false);
  const [reportCategory, setReportCategory]         = useState('');
  const [reportDescription, setReportDescription]   = useState('');
  const [reportSubmitting, setReportSubmitting]      = useState(false);
  const [reportSubmitted, setReportSubmitted]        = useState(false);
  const [reportError, setReportError]               = useState('');

  useEffect(() => {
    if (product) {
      if (product.seoTitle || product.seo_title) {
        document.title = `${product.seoTitle || product.seo_title} | Lumora`;
      } else {
        document.title = `${product.title} | Lumora`;
      }
      try {
        let metaDesc = document.querySelector('meta[name="description"]');
        if (!metaDesc) {
          metaDesc = document.createElement('meta');
          metaDesc.name = 'description';
          document.head.appendChild(metaDesc);
        }
        metaDesc.setAttribute('content', product.seoDescription || product.seo_description || product.description || '');
      } catch (_) {}
    }
    if (product && user) trackProductViewing(user.uid, product);
    else if (product) trackProductViewing(null, product);
    setActiveImg(0);
    setReviewSubmitted(false);
    setReviewComment('');
    setReviewRating(5);
    setBackendReviews(null); // reset so new product fetches reviews fresh

    // Capture affiliate referral code from URL (?ref=AFF001) and store for purchase attribution
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const hashParts = window.location.hash.split('?');
      const hashParams = hashParts.length > 1 ? new URLSearchParams(hashParts[1]) : null;
      const ref = urlParams.get('ref') || (hashParams && hashParams.get('ref')) || '';
      if (ref) {
        sessionStorage.setItem('lumora_aff_ref', ref);
      }
    } catch (_) {}
  }, [product?.id]);

  // Load reviews from backend whenever the product changes
  useEffect(() => {
    if (!product?.id) return;
    const numericId = parseInt(product.id, 10);
    if (isNaN(numericId)) return; // string-id local product — skip backend fetch
    setBackendReviews(null);
    getReviewsApi(numericId)
      .then(data => {
        if (Array.isArray(data)) setBackendReviews(data);
      })
      .catch(() => {
        // Backend offline — fall back to local product reviews silently
        setBackendReviews(null);
      });
  }, [product?.id]);


  if (!product) return null;

  const gallery = getGallery(product);
  const videoUrl = product.previewVideo || product.preview_video;
  const isWishlisted = wishlist.some(w => w.id === product.id);
  const isOwned = ownedProducts.some(id => String(id) === String(product.id));

  // Features list parsing:
  // For backend products (numeric IDs), never show hardcoded defaults.
  // Only show vendor-entered features or a genuine empty state message.
  const isBackendProduct = !isNaN(parseInt(product.id, 10));
  const featuresList = Array.isArray(product.features) && product.features.length > 0
    ? product.features
    : (typeof product.features === 'string' && product.features.trim() !== '')
      ? (product.features.startsWith('[') ? JSON.parse(product.features) : product.features.split(',').map(f => f.trim()).filter(Boolean))
      : isBackendProduct
        ? [] // Backend product with no features entered — show empty state
        : (product.highlights || ['Premium components included', 'Commercial license', 'Lifetime updates', 'Responsive design']);

  const whatYouGetList = Array.isArray(product.whatYouGet || product.what_you_get)
    ? (product.whatYouGet || product.what_you_get)
    : (typeof (product.whatYouGet || product.what_you_get) === 'string' && (product.whatYouGet || product.what_you_get).trim() !== '')
      ? ((product.whatYouGet || product.what_you_get).startsWith('[') ? JSON.parse(product.whatYouGet || product.what_you_get) : (product.whatYouGet || product.what_you_get).split(',').map(f => f.trim()))
      : [];

  const systemRequirementsList = Array.isArray(product.systemRequirements || product.system_requirements)
    ? (product.systemRequirements || product.system_requirements)
    : (typeof (product.systemRequirements || product.system_requirements) === 'string' && (product.systemRequirements || product.system_requirements).trim() !== '')
      ? ((product.systemRequirements || product.system_requirements).startsWith('[') ? JSON.parse(product.systemRequirements || product.system_requirements) : (product.systemRequirements || product.system_requirements).split(',').map(f => f.trim()))
      : [];

  // Related products: same category, excluding current, max 4
  const relatedProducts = (products || []).filter(
    p => p.id !== product.id && p.category === product.category
  ).slice(0, 4);

  const handleContactCreator = async () => {
    if (!user) { navigateTo('login-selection'); return; }
    try {
      // Resolve buyer_id (integer from backend UID)
      const buyerId = parseInt(localStorage.getItem('lumora_backend_uid'), 10) || 1;
      
      // Resolve seller_id (integer from product.vendor_id)
      let sellerId = parseInt(product.vendor_id, 10);
      if (isNaN(sellerId)) {
        // Fallback to vendor user 5 if product vendor is not a valid integer ID
        sellerId = 5; 
      }

      // Try creating conversation on backend first
      let backendConvId = null;
      try {
        const res = await backendFetch('/messages/conversations', {
          method: 'POST',
          body: JSON.stringify({
            buyer_id: buyerId,
            seller_id: sellerId
          })
        });
        if (res && res.id) {
          backendConvId = res.id;
          sessionStorage.setItem('lumora_active_conversation_id', String(backendConvId));
        }
      } catch (err) {
        console.warn('Failed to create backend conversation:', err);
      }

      // Also sync / fallback to Firestore
      await createConversation(
        user.uid,
        user.displayName || user.email,
        product.creator?.id || 'creator',
        product.creator?.name || 'Creator'
      ).catch(() => null);

      navigateTo('dashboard', 'Messages Center');
    } catch (err) {
      console.error(err);
    }
  };

  // ── Report handlers (isolated — no interaction with cart/purchase) ────────
  const handleOpenReportModal = () => {
    if (!user) { navigateTo('login-selection'); return; }
    setReportCategory('');
    setReportDescription('');
    setReportError('');
    setReportSubmitted(false);
    setReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    setReportModalOpen(false);
    setReportCategory('');
    setReportDescription('');
    setReportError('');
    setReportSubmitted(false);
  };

  const handleSubmitReport = async (e) => {
    e.preventDefault();
    if (!reportCategory) { setReportError('Please select a category.'); return; }
    if (!reportDescription.trim() || reportDescription.trim().length < 10) {
      setReportError('Description must be at least 10 characters.'); return;
    }
    setReportError('');
    setReportSubmitting(true);
    try {
      const token =
        (typeof window !== 'undefined' &&
          (localStorage.getItem('lumora_backend_token') || sessionStorage.getItem('lumora_backend_token'))) || '';
      const BASE =
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL)
          ? import.meta.env.VITE_API_URL
          : 'http://localhost:8000';
      const res = await fetch(`${BASE}/api/reports/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          product_id: String(product.id),
          category: reportCategory,
          description: reportDescription.trim(),
        }),
      });
      if (res.status === 429) {
        setReportError('You have already submitted 3 reports for this product in the last 24 hours.');
        return;
      }
      if (res.status === 503) {
        setReportError('Report service is temporarily unavailable. Please try again later.');
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setReportError(data?.detail || data?.error?.message || 'Failed to submit report. Please try again.');
        return;
      }
      setReportSubmitted(true);
    } catch (err) {
      setReportError('Network error. Please check your connection and try again.');
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!user) { navigateTo('login-selection'); return; }
    if (!reviewComment.trim()) return;
    setReviewSubmitting(true);

    const numericId = parseInt(product.id, 10);
    // If this is a backend product (numeric ID), post to backend
    if (!isNaN(numericId)) {
      try {
        const saved = await createReviewApi({
          product_id: numericId,
          rating: reviewRating,
          comment: reviewComment.trim(),
        });
        // Refresh backend reviews
        const updated = await getReviewsApi(numericId);
        if (Array.isArray(updated)) setBackendReviews(updated);
        // Also update local product state rating so card updates without full reload
        addReview(product.id, {
          user: user.displayName || user.email?.split('@')[0] || 'Anonymous',
          rating: reviewRating,
          date: 'Just now',
          comment: reviewComment.trim(),
        });
      } catch (err) {
        alert(err.message || 'Failed to post review. You may need to purchase this product first.');
      } finally {
        setReviewSubmitting(false);
      }
    } else {
      // Local (string-id) product — use local addReview as before
      const newReview = {
        user: user.displayName || user.email?.split('@')[0] || 'Anonymous',
        rating: reviewRating,
        date: 'Just now',
        comment: reviewComment.trim(),
      };
      setTimeout(() => {
        addReview(product.id, newReview);
        setReviewSubmitting(false);
      }, 600);
    }

    setReviewComment('');
    setReviewRating(5);
    setReviewSubmitted(true);
  };

  return (
    <div style={{ minHeight: '100vh', background: 'transparent' }}>
      <Navbar />
      <div className="lumora-product-detail-container" style={{ paddingTop: '90px', padding: '90px clamp(1.5rem,5vw,5rem) 80px', maxWidth: '1280px', margin: '0 auto' }}>

        {/* Back */}
        <button onClick={() => navigateTo('marketplace')} className="btn-premium"
          style={{ marginBottom: '28px', fontSize: '0.78rem', borderRadius: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 18px' }}>
          <ArrowLeft size={14} /> Back to Marketplace
        </button>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: '48px', alignItems: 'start' }} className="product-layout">

          {/* ── LEFT: Gallery + Details ── */}
          <div>
            {/* Main Image */}
            <div style={{ borderRadius: '24px', overflow: 'hidden', marginBottom: '12px', position: 'relative', background: 'rgba(255, 255, 255, 0.48)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid rgba(255, 255, 255, 0.45)', boxShadow: '0 8px 40px rgba(123, 63, 160, 0.08)' }}>
              <AnimatePresence mode="wait">
                {videoUrl && activeImg === gallery.length ? (
                  <video
                    key="video"
                    src={videoUrl}
                    controls
                    style={{ width: '100%', height: '420px', objectFit: 'cover', display: 'block' }}
                    className="lumora-product-gallery-img"
                  />
                ) : (
                  <motion.img
                    key={activeImg}
                    src={gallery[activeImg]}
                    alt={`${product.title} preview ${activeImg + 1}`}
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    style={{ width: '100%', height: '420px', objectFit: 'cover', display: 'block' }}
                    className="lumora-product-gallery-img"
                  />
                )}
              </AnimatePresence>
              {/* Arrows */}
              {(() => {
                const totalSlides = videoUrl ? gallery.length + 1 : gallery.length;
                if (totalSlides <= 1) return null;
                return (
                  <>
                    <button onClick={() => setActiveImg(i => (i - 1 + totalSlides) % totalSlides)}
                      style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(10px)', border: '1px solid rgba(220,198,255,0.40)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A1E7E', boxShadow: '0 2px 12px rgba(45,0,96,0.12)' }}>
                      <ChevronLeft size={16} />
                    </button>
                    <button onClick={() => setActiveImg(i => (i + 1) % totalSlides)}
                      style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.90)', backdropFilter: 'blur(10px)', border: '1px solid rgba(220,198,255,0.40)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5A1E7E', boxShadow: '0 2px 12px rgba(45,0,96,0.12)' }}>
                      <ChevronRight size={16} />
                    </button>
                    {/* Dot indicators */}
                    <div style={{ position: 'absolute', bottom: '12px', left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: '6px' }}>
                      {[...Array(totalSlides)].map((_, i) => (
                        <button key={i} onClick={() => setActiveImg(i)}
                          style={{ width: i === activeImg ? '20px' : '7px', height: '7px', borderRadius: '4px', border: 'none', background: i === activeImg ? '#7B3FA0' : 'rgba(255,255,255,0.70)', cursor: 'pointer', padding: 0, transition: 'all 0.25s', boxShadow: '0 1px 4px rgba(45,0,96,0.20)' }} />
                      ))}
                    </div>
                  </>
                );
              })()}
              {/* Image counter */}
              <div style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '0.65rem', fontWeight: 700, color: '#fff', background: 'rgba(45,0,77,0.55)', backdropFilter: 'blur(8px)', padding: '3px 9px', borderRadius: '12px' }}>
                {activeImg + 1} / {videoUrl ? gallery.length + 1 : gallery.length}
              </div>
            </div>

            {/* Thumbnail strip */}
            <div className="lumora-product-thumbnails" style={{ display: 'flex', gap: '8px', marginBottom: '32px' }}>
              {gallery.map((img, i) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  style={{ flex: 1, height: '68px', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${i === activeImg ? '#7B3FA0' : 'rgba(220,198,255,0.30)'}`, cursor: 'pointer', padding: 0, transition: 'border-color 0.2s', boxShadow: i === activeImg ? '0 4px 16px rgba(123,63,160,0.18)' : 'none' }}>
                  <img src={img} alt={`thumb ${i+1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: i === activeImg ? 'none' : 'brightness(0.85)', transition: 'filter 0.2s' }} />
                </button>
              ))}
              {videoUrl && (
                <button onClick={() => setActiveImg(gallery.length)}
                  style={{ flex: 1, height: '68px', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${activeImg === gallery.length ? '#7B3FA0' : 'rgba(220,198,255,0.30)'}`, cursor: 'pointer', padding: 0, transition: 'border-color 0.2s', position: 'relative', boxShadow: activeImg === gallery.length ? '0 4px 16px rgba(123,63,160,0.18)' : 'none' }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', color: '#fff', fontSize: '0.62rem', fontWeight: 'bold' }}>▶ VIDEO</div>
                  <img src={gallery[0]} alt="video thumbnail" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.6)' }} />
                </button>
              )}
            </div>

            {/* Tabs */}
            <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.45)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)', borderRadius: '16px', padding: '4px', marginBottom: '24px', gap: '4px', border: '1px solid rgba(255, 255, 255, 0.35)' }}>
              {['overview', 'features', 'reviews'].map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ flex: 1, padding: '10px', borderRadius: '12px', border: 'none', background: activeTab === tab ? 'linear-gradient(135deg,#7B3FA0,#5A1E7E)' : 'transparent', color: activeTab === tab ? '#fff' : '#8B6B5B', fontSize: '0.80rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.22s', textTransform: 'capitalize', boxShadow: activeTab === tab ? '0 4px 14px rgba(90,30,126,0.28)' : 'none' }}>
                  {tab}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div style={{ background: 'rgba(255, 255, 255, 0.48)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid rgba(255, 255, 255, 0.45)', borderRadius: '20px', padding: '28px', boxShadow: '0 4px 24px rgba(123, 63, 160, 0.05)' }}>
              {activeTab === 'overview' && (
                <div>
                  <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.5rem', fontWeight: 400, color: '#2D004D', marginBottom: '14px' }}>About this product</h2>
                  <p style={{ fontSize: '0.88rem', lineHeight: 1.7, color: '#6B4F7A', fontWeight: 400, marginBottom: '24px' }}>{product.description}</p>
                  
                  {/* Installation Guide */}
                  {(product.installationGuide || product.installation_guide) && (
                    <div style={{ marginBottom: '24px', padding: '18px', borderRadius: '16px', background: 'rgba(123, 63, 160, 0.04)', border: '1px solid rgba(220,198,255,0.22)' }}>
                      <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: '0.90rem', fontWeight: 700, color: '#2D004D', marginBottom: '8px' }}>🛠️ Installation Guide</h3>
                      <p style={{ fontSize: '0.84rem', lineHeight: 1.6, color: '#6B4F7A', whiteSpace: 'pre-wrap', margin: 0 }}>
                        {product.installationGuide || product.installation_guide}
                      </p>
                    </div>
                  )}

                  {/* Tags */}
                  {product.compatibility?.length > 0 && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
                      {product.compatibility.map(c => (
                        <span key={c} style={{ fontSize: '0.72rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(220,198,255,0.25)', border: '1px solid rgba(220,198,255,0.40)', color: '#5A1E7E', fontWeight: 700 }}>{c}</span>
                      ))}
                    </div>
                  )}
                  {/* Meta grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '10px' }}>
                    {[
                      ['Version', product.version || 'v1.0.0'],
                      ['File Size', product.file_size || product.fileSize || 'N/A'],
                      ['License', product.license || 'Personal Use'],
                      ['Downloads', (product.downloads || 0).toLocaleString()]
                    ].map(([k, v]) => (
                      <div key={k} style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(220,198,255,0.12)', border: '1px solid rgba(220,198,255,0.22)' }}>
                        <div style={{ fontSize: '0.58rem', fontWeight: 700, color: '#8B6B5B', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{k}</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#2D004D' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {activeTab === 'features' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                  {/* Features */}
                  <div>
                    <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.5rem', fontWeight: 400, color: '#2D004D', marginBottom: '16px' }}>Key Features</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {featuresList.length > 0 ? featuresList.map((f, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>
                            <Check size={11} color="#fff" />
                          </div>
                          <p style={{ fontSize: '0.87rem', color: '#4E3B31', fontWeight: 500, lineHeight: 1.5 }}>{f}</p>
                        </div>
                      )) : (
                        <div style={{ padding: '18px', borderRadius: '14px', background: 'rgba(220,198,255,0.08)', border: '1px solid rgba(220,198,255,0.15)', color: '#8B6B5B', fontSize: '0.84rem', fontWeight: 500 }}>
                          No features listed for this product.
                        </div>
                      )}
                    </div>
                  </div>

                  {/* What You'll Get */}
                  {whatYouGetList.length > 0 && (
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.5rem', fontWeight: 400, color: '#2D004D', marginBottom: '16px' }}>What You'll Get</h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        {whatYouGetList.map((item, i) => (
                          <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <span style={{ color: '#7B3FA0', fontSize: '14px' }}>✦</span>
                            <p style={{ fontSize: '0.87rem', color: '#4E3B31', fontWeight: 500 }}>{item}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* System Requirements */}
                  {systemRequirementsList.length > 0 && (
                    <div>
                      <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.5rem', fontWeight: 400, color: '#2D004D', marginBottom: '16px' }}>System Requirements</h2>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {systemRequirementsList.map((req, i) => (
                          <div key={i} style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(220,198,255,0.08)', border: '1px solid rgba(220,198,255,0.15)', fontSize: '0.83rem', color: '#6B4F7A' }}>
                            {req}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {activeTab === 'reviews' && (
                <div>
                  {/* Rating Summary + Distribution */}
                  {(() => {
                    const displayReviews = isBackendProduct
                      ? (backendReviews !== null ? backendReviews : [])
                      : (backendReviews !== null ? backendReviews : (product.reviewsList || []));
                    const count = displayReviews.length;
                    const avg = count > 0
                      ? (displayReviews.reduce((s, r) => s + (r.rating || 0), 0) / count).toFixed(1)
                      : (product.rating || 0).toFixed(1);
                    const dist = [5, 4, 3, 2, 1].map(star => ({
                      star,
                      n: displayReviews.filter(r => Math.round(r.rating) === star).length,
                    }));
                    return (
                      <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start', marginBottom: '24px', padding: '20px', borderRadius: '18px', background: 'rgba(220,198,255,0.08)', border: '1px solid rgba(220,198,255,0.22)', flexWrap: 'wrap' }}>
                        {/* Left: big number */}
                        <div style={{ textAlign: 'center', minWidth: '90px' }}>
                          <div style={{ fontFamily: 'var(--font-editorial)', fontSize: '3.5rem', fontWeight: 400, color: '#2D004D', lineHeight: 1 }}>{avg}</div>
                          <div style={{ display: 'flex', justifyContent: 'center', gap: '2px', margin: '6px 0 4px' }}>
                            {[...Array(5)].map((_, i) => <Star key={i} size={13} fill={i < Math.round(Number(avg)) ? '#C7A55A' : 'none'} stroke="#C7A55A" />)}
                          </div>
                          <div style={{ fontSize: '0.68rem', color: '#8B6B5B', fontWeight: 600 }}>{count} review{count !== 1 ? 's' : ''}</div>
                        </div>
                        {/* Right: distribution bars */}
                        <div style={{ flex: 1, minWidth: '160px', display: 'flex', flexDirection: 'column', gap: '6px', justifyContent: 'center' }}>
                          {dist.map(({ star, n }) => {
                            const pct = count > 0 ? Math.round((n / count) * 100) : 0;
                            return (
                              <div key={star} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6B4F7A', width: '14px', textAlign: 'right', flexShrink: 0 }}>{star}</span>
                                <Star size={9} fill="#C7A55A" stroke="#C7A55A" style={{ flexShrink: 0 }} />
                                <div style={{ flex: 1, height: '7px', borderRadius: '4px', background: 'rgba(220,198,255,0.30)', overflow: 'hidden' }}>
                                  <div style={{ width: `${pct}%`, height: '100%', borderRadius: '4px', background: pct >= 60 ? '#C7A55A' : pct >= 30 ? '#D4A57A' : 'rgba(196,165,90,0.45)', transition: 'width 0.6s ease' }} />
                                </div>
                                <span style={{ fontSize: '0.62rem', color: '#8B6B5B', fontWeight: 600, width: '24px', flexShrink: 0 }}>{n > 0 ? n : ''}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })()}

                  {/* ── Write a Review Form ── */}
                  <div style={{ marginBottom: '28px', padding: '22px', borderRadius: '18px', background: 'rgba(123,63,160,0.04)', border: '1px solid rgba(196,181,253,0.28)' }}>
                    <h3 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2D004D', marginBottom: '14px' }}>
                      {reviewSubmitted ? '✓ Thank you for your review!' : 'Write a Review'}
                    </h3>

                    {reviewSubmitted ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <p style={{ fontSize: '0.84rem', color: '#5A1E7E', fontWeight: 500 }}>Your review has been posted successfully.</p>
                        <button
                          onClick={() => setReviewSubmitted(false)}
                          style={{ fontSize: '0.74rem', fontWeight: 700, color: '#7B3FA0', background: 'none', border: '1px solid rgba(123,63,160,0.25)', borderRadius: '14px', padding: '5px 14px', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
                        >
                          Write another
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitReview}>
                        {/* Star rating picker */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 600, color: '#8B6B5B', marginRight: '4px' }}>Your rating:</span>
                          {[1,2,3,4,5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setReviewRating(star)}
                              onMouseEnter={() => setReviewHoverRating(star)}
                              onMouseLeave={() => setReviewHoverRating(0)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', lineHeight: 1 }}
                            >
                              <Star
                                size={22}
                                fill={(reviewHoverRating || reviewRating) >= star ? '#C7A55A' : 'none'}
                                stroke="#C7A55A"
                                style={{ transition: 'transform 0.15s', transform: (reviewHoverRating || reviewRating) >= star ? 'scale(1.15)' : 'scale(1)' }}
                              />
                            </button>
                          ))}
                          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#7B3FA0', marginLeft: '4px' }}>
                            {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][reviewHoverRating || reviewRating]}
                          </span>
                        </div>

                        {/* Comment textarea */}
                        <textarea
                          value={reviewComment}
                          onChange={e => setReviewComment(e.target.value)}
                          placeholder={
                            !user ? 'Please sign in to leave a review'
                            : 'Share your experience with this product...'
                          }
                          disabled={!user}
                          maxLength={600}
                          rows={3}
                          style={{
                            width: '100%', boxSizing: 'border-box',
                            padding: '12px 16px',
                            borderRadius: '14px',
                            border: '1.5px solid rgba(196,181,253,0.35)',
                            background: 'rgba(255,255,255,0.55)',
                            backdropFilter: 'blur(10px)',
                            outline: 'none',
                            resize: 'vertical',
                            fontSize: '0.86rem',
                            color: '#2D004D',
                            fontFamily: 'var(--font-sans)',
                            marginBottom: '12px',
                            lineHeight: 1.55,
                            transition: 'border-color 0.2s',
                          }}
                          onFocus={e => e.target.style.borderColor = 'rgba(123,63,160,0.55)'}
                          onBlur={e => e.target.style.borderColor = 'rgba(196,181,253,0.35)'}
                        />

                        {/* Char count + submit */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '0.68rem', color: '#8B6B5B' }}>{reviewComment.length}/600</span>
                          {user ? (
                            <button
                              type="submit"
                              disabled={reviewSubmitting || !reviewComment.trim()}
                              style={{
                                padding: '9px 22px',
                                fontSize: '0.80rem', fontWeight: 700,
                                borderRadius: '12px', border: 'none',
                                background: reviewSubmitting || !reviewComment.trim()
                                  ? 'rgba(123,63,160,0.30)'
                                  : 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
                                color: '#fff',
                                cursor: reviewSubmitting || !reviewComment.trim() ? 'not-allowed' : 'pointer',
                                fontFamily: 'var(--font-sans)',
                                boxShadow: reviewComment.trim() ? '0 4px 14px rgba(90,30,126,0.28)' : 'none',
                                transition: 'all 0.2s',
                                display: 'flex', alignItems: 'center', gap: '6px',
                              }}
                            >
                              {reviewSubmitting ? 'Posting...' : 'Post Review'}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => navigateTo('login-selection')}
                              style={{ padding: '9px 22px', fontSize: '0.80rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 4px 14px rgba(90,30,126,0.28)' }}
                            >
                              Sign in to Review
                            </button>
                          )}
                        </div>
                      </form>
                    )}
                  </div>

                  {/* ── Existing Reviews ── */}
                  {(() => {
                    // For backend products (numeric IDs): ONLY use backendReviews (null = loading, [] = no reviews).
                    // Never fall back to product.reviewsList for backend products — those are stale mock data.
                    // For local mock products (string IDs): use product.reviewsList as before.
                    const displayReviews = isBackendProduct
                      ? (backendReviews !== null ? backendReviews : []) // null = still loading, show empty
                      : (backendReviews !== null ? backendReviews : (product.reviewsList || []));
                    if (displayReviews.length === 0) return (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: '#8B6B5B', fontSize: '0.84rem', fontWeight: 500 }}>
                        No reviews yet — be the first to share your thoughts!
                      </div>
                    );
                    return (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {displayReviews.map((r, i) => {
                          const reviewerName = r.user || r.reviewer_name || r.username || 'Customer';
                          const reviewDate = r.date || (r.created_at ? new Date(r.created_at).toLocaleDateString() : 'Recently');
                          return (
                            <div key={r.id || i} style={{ padding: '18px', borderRadius: '14px', background: 'rgba(220,198,255,0.10)', border: '1px solid rgba(220,198,255,0.22)', transition: 'box-shadow 0.2s' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                  {/* Avatar circle */}
                                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: `hsl(${(reviewerName?.charCodeAt(0) || 65) * 5},60%,70%)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                                    {(reviewerName || 'U')[0].toUpperCase()}
                                  </div>
                                  <div>
                                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2D004D' }}>{reviewerName}</span>
                                    {r.verified && (
                                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', marginLeft: '8px', fontSize: '0.65rem', fontWeight: 700, color: '#16a34a', background: 'rgba(34,197,94,0.10)', padding: '2px 7px', borderRadius: '10px', border: '1px solid rgba(34,197,94,0.25)' }}>
                                        <BadgeCheck size={10} /> Verified Purchase
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '3px' }}>
                                  <div style={{ display: 'flex', gap: '2px' }}>
                                    {[...Array(5)].map((_, s) => <Star key={s} size={11} fill={s < Math.round(r.rating) ? '#C7A55A' : 'none'} stroke="#C7A55A" />)}
                                  </div>
                                  <span style={{ fontSize: '0.65rem', color: '#8B6B5B' }}>{reviewDate}</span>
                                </div>
                              </div>
                              <p style={{ fontSize: '0.83rem', color: '#6B4F7A', fontWeight: 400, lineHeight: 1.6, marginLeft: '42px' }}>"{r.comment}"</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* ── RIGHT: Purchase panel ── */}

          <div style={{ position: 'sticky', top: '100px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Main card */}
            <div style={{ background: 'rgba(255, 255, 255, 0.48)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)', border: '1px solid rgba(255, 255, 255, 0.45)', borderRadius: '24px', padding: '28px', boxShadow: '0 8px 40px rgba(123, 63, 160, 0.08)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '0.60rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.08em', background: 'rgba(123,63,160,0.08)', padding: '2px 8px', borderRadius: '6px' }}>
                  {product.category}{product.subcategory ? ` · ${product.subcategory}` : ''}
                </span>
                {product.discount ? (
                  <span style={{ fontSize: '0.60rem', fontWeight: 700, color: '#16a34a', background: 'rgba(34,197,94,0.10)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(34,197,94,0.20)' }}>
                    {product.discount}% OFF
                  </span>
                ) : null}
              </div>
              <h1 style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.85rem', fontWeight: 400, color: '#2D004D', lineHeight: 1.2, marginBottom: '10px' }}>{product.title}</h1>
              {(product.shortDesc || product.short_desc) && (
                <p style={{ fontSize: '0.82rem', color: '#8B6B5B', fontWeight: 500, marginBottom: '14px', lineHeight: 1.4 }}>
                  {product.shortDesc || product.short_desc}
                </p>
              )}

              {/* Creator */}
              <button onClick={() => navigateTo('creator-profile', product.creator?.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginBottom: '18px', textAlign: 'left' }}>
                <img src={product.creator?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=80&q=80'} alt=""
                  style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(220,198,255,0.40)' }} />
                <div>
                  <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#2D004D' }}>{product.creator?.name || product.seller?.name}</div>
                  <div style={{ fontSize: '0.65rem', color: '#7B3FA0', fontWeight: 600 }}>{product.creator?.sales || '1K+'} sales · {product.creator?.rating || '4.8 ★'}</div>
                </div>
              </button>

              {/* Rating */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '22px' }}>
                <div style={{ display: 'flex', gap: '2px' }}>
                  {[...Array(5)].map((_, i) => <Star key={i} size={14} fill={i < Math.round(product.rating || 4.8) ? '#C7A55A' : 'none'} stroke="#C7A55A" />)}
                </div>
                <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#2D004D' }}>{product.rating || 4.8}</span>
                <span style={{ fontSize: '0.72rem', color: '#8B6B5B' }}>({product.reviews || 0} reviews)</span>
              </div>

              {/* Price */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '24px' }}>
                <span style={{ fontFamily: 'var(--font-editorial)', fontSize: '2.8rem', fontWeight: 400, color: '#2D004D', lineHeight: 1 }}>
                  {formatPrice(product.price)}
                </span>
                {product.discount ? (
                  <span style={{ fontSize: '1.1rem', color: '#8B6B5B', textDecoration: 'line-through', fontWeight: 500 }}>
                    {formatPrice(Math.round(product.price / (1 - product.discount / 100)))}
                  </span>
                ) : null}
              </div>

              {/* CTAs */}
              {isOwned ? (
                <div style={{ padding: '14px 18px', borderRadius: '14px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <Check size={16} style={{ color: '#16a34a' }} />
                    <span style={{ fontSize: '0.88rem', fontWeight: 700, color: '#15803d' }}>You own this product</span>
                  </div>
                  <button 
                    onClick={async () => {
                      const numericId = parseInt(product.id, 10);
                      if (isNaN(numericId)) return;
                      
                      try {
                        const res = await backendFetch(`/products/${numericId}/download`);
                        if (res?.download_available === false) {
                          alert("The creator has not yet uploaded the downloadable asset.");
                          return;
                        }
                        
                        let activeUrl = res?.download_url || `/downloads/product-${product.id}.zip`;
                        if (res?.type === 'external' && res?.redirect_url) {
                          window.open(res.redirect_url, '_blank');
                          return;
                        }
                        
                        const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
                        const fileCheckUrl = activeUrl.startsWith('/api') ? activeUrl.replace('/api', '') : activeUrl;
                        const token = localStorage.getItem('lumora_backend_token');
                        
                        const fileResp = await fetch(`${BACKEND_URL}${fileCheckUrl.startsWith('/') ? fileCheckUrl : '/' + fileCheckUrl}`, {
                          headers: token ? { 'Authorization': `Bearer ${token}` } : {}
                        });

                        if (fileResp.ok) {
                          const contentType = fileResp.headers.get('content-type');
                          if (contentType && contentType.includes('application/json')) {
                            const fileRespJson = await fileResp.json();
                            if (fileRespJson?.type === 'external' && fileRespJson?.redirect_url) {
                              window.open(fileRespJson.redirect_url, '_blank');
                              return;
                            }
                          }
                        }
                        
                        window.open(`${BACKEND_URL}${fileCheckUrl.startsWith('/') ? fileCheckUrl : '/' + fileCheckUrl}`, '_blank');
                      } catch (err) {
                        console.warn('[ProductPage] Failed to resolve download:', err);
                        window.open(`/downloads/product-${product.id}.zip`, '_blank');
                      }
                    }}
                    className="btn-premium btn-premium-solid"
                    style={{ 
                      width: '100%', 
                      justifyContent: 'center', 
                      padding: '12px', 
                      fontSize: '0.88rem', 
                      borderRadius: '12px', 
                      cursor: 'pointer', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      background: 'linear-gradient(135deg,#16a34a,#15803d)',
                      boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
                      border: 'none',
                      color: '#fff',
                      fontWeight: 700,
                      fontFamily: 'var(--font-sans)',
                    }}
                  >
                    <Download size={15} /> Download Product
                  </button>
                </div>
              ) : user ? (
                <>
                  <button onClick={() => buyNow(product)} className="btn-premium btn-premium-solid buy-now-glow"
                    style={{ width: '100%', justifyContent: 'center', padding: '15px', fontSize: '0.92rem', borderRadius: '14px', marginBottom: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={16} /> Buy Now · {formatPrice(product.price)}
                  </button>
                  <button onClick={() => addToCart(product)} className="btn-premium"
                    style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: '0.88rem', borderRadius: '14px', marginBottom: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingBag size={15} /> Add to Cart
                  </button>
                </>
              ) : (
                /* Not logged in — show sign-in prompt instead of purchase buttons */
                <div style={{ marginBottom: '12px' }}>
                  <button onClick={() => navigateTo('login-selection')} className="btn-premium btn-premium-solid buy-now-glow"
                    style={{ width: '100%', justifyContent: 'center', padding: '15px', fontSize: '0.92rem', borderRadius: '14px', marginBottom: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Zap size={16} /> Sign In to Purchase
                  </button>
                  <div style={{ padding: '12px 16px', borderRadius: '12px', background: 'rgba(123,63,160,0.05)', border: '1px solid rgba(196,181,253,0.28)', textAlign: 'center' }}>
                    <p style={{ fontSize: '0.78rem', color: '#7B3FA0', fontWeight: 500, lineHeight: 1.5 }}>
                      Create a free account or sign in to purchase and access this product instantly.
                    </p>
                    <button onClick={() => navigateTo('register-selection')}
                      style={{ marginTop: '10px', fontSize: '0.76rem', fontWeight: 700, color: '#5A1E7E', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', fontFamily: 'var(--font-sans)' }}>
                      New here? Create account →
                    </button>
                  </div>
                </div>
              )}

              {/* Secondary actions */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <button onClick={() => toggleWishlist(product)} className="btn-premium"
                  style={{ justifyContent: 'center', padding: '10px', fontSize: '0.75rem', borderRadius: '12px', cursor: 'pointer', color: isWishlisted ? '#E11D48' : undefined, borderColor: isWishlisted ? 'rgba(225,29,72,0.30)' : undefined, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <Heart size={13} fill={isWishlisted ? '#E11D48' : 'none'} /> {isWishlisted ? 'Saved' : 'Wishlist'}
                </button>
                <button onClick={handleContactCreator} className="btn-premium"
                  style={{ justifyContent: 'center', padding: '10px', fontSize: '0.75rem', borderRadius: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <MessageSquare size={13} /> Message
                </button>
              </div>
            </div>

            {/* Trust badges */}
            <div style={{ background: 'rgba(255, 255, 255, 0.48)', backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)', border: '1px solid rgba(255, 255, 255, 0.45)', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 20px rgba(123, 63, 160, 0.05)' }}>
              {[
                [<Shield size={14} />, 'Secure Payment', '256-bit SSL encrypted'],
                [<Download size={14} />, 'Instant Download', 'Access immediately after purchase'],
                [<Package size={14} />, 'Lifetime Access', 'Free updates forever'],
              ].map(([icon, title, sub], i) => (
                <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', paddingBottom: i < 2 ? '14px' : 0, marginBottom: i < 2 ? '14px' : 0, borderBottom: i < 2 ? '1px solid rgba(220,198,255,0.18)' : 'none' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'rgba(220,198,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0', flexShrink: 0 }}>{icon}</div>
                  <div>
                    <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#2D004D' }}>{title}</div>
                    <div style={{ fontSize: '0.68rem', color: '#8B6B5B', fontWeight: 500 }}>{sub}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Product QR Code — share & scan to purchase */}
            <div style={{ marginBottom: '16px' }}>
              <ProductQrCode product={product} size={160} showDownload showShare />
            </div>

            {/* ── Report this product (isolated — outside purchase/cart flow) ── */}
            <button
              onClick={handleOpenReportModal}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                width: '100%', padding: '9px 14px',
                fontSize: '0.72rem', fontWeight: 600,
                color: '#8B6B5B',
                background: 'rgba(255,255,255,0.40)',
                backdropFilter: 'blur(10px)',
                border: '1px solid rgba(220,198,255,0.28)',
                borderRadius: '12px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.color = '#E11D48';
                e.currentTarget.style.borderColor = 'rgba(225,29,72,0.30)';
                e.currentTarget.style.background = 'rgba(225,29,72,0.05)';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.color = '#8B6B5B';
                e.currentTarget.style.borderColor = 'rgba(220,198,255,0.28)';
                e.currentTarget.style.background = 'rgba(255,255,255,0.40)';
              }}
            >
              <Flag size={12} /> Report this product
            </button>
          </div>
        </div>
      </div>

      {/* ── REPORT MODAL (fully isolated — state does not affect purchase/cart) ── */}
      {reportModalOpen && (
        <ReportModal
          product={product}
          user={user}
          userRole={userRole}
          reportCategory={reportCategory}
          setReportCategory={setReportCategory}
          reportDescription={reportDescription}
          setReportDescription={setReportDescription}
          reportSubmitting={reportSubmitting}
          reportSubmitted={reportSubmitted}
          reportError={reportError}
          onSubmit={handleSubmitReport}
          onClose={handleCloseReportModal}
        />
      )}

      {/* ── RELATED PRODUCTS ─────────────────────────────────────────────── */}
      {relatedProducts.length > 0 && (
        <div style={{ padding: '0 clamp(1.5rem,5vw,5rem) 80px', maxWidth: '1280px', margin: '0 auto' }}>
          {/* Section header */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '32px' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: '#7B3FA0', marginBottom: '6px' }}>You May Also Like</div>
              <h2 style={{ fontFamily: 'var(--font-editorial)', fontSize: '2rem', fontWeight: 400, color: '#2D004D', lineHeight: 1.1 }}>Related Products</h2>
            </div>
            <button
              onClick={() => { navigateTo('marketplace'); }}
              style={{ fontSize: '0.78rem', fontWeight: 700, color: '#7B3FA0', background: 'rgba(123,63,160,0.06)', border: '1px solid rgba(123,63,160,0.15)', borderRadius: '20px', padding: '8px 18px', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.06)'; }}
            >
              View All →
            </button>
          </div>

          {/* Cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '24px' }}>
            {relatedProducts.map(rel => {
              const relGallery = getGallery(rel);
              const relWished = wishlist.some(w => w.id === rel.id);
              return (
                <RelatedCard
                  key={rel.id}
                  product={rel}
                  thumb={relGallery[0]}
                  isWished={relWished}
                  formatPrice={formatPrice}
                  onView={() => navigateTo('product-detail', rel.id)}
                  onCart={() => addToCart(rel)}
                  onWishlist={() => toggleWishlist(rel)}
                />
              );
            })}
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

// ── Related Product Card ──────────────────────────────────────────────────────
function RelatedCard({ product, thumb, isWished, formatPrice, onView, onCart, onWishlist }) {
  const [hov, setHov] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.45)',
        backdropFilter: 'blur(28px) saturate(190%)',
        WebkitBackdropFilter: 'blur(28px) saturate(190%)',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.60)' : 'rgba(255,255,255,0.38)'}`,
        borderRadius: '22px',
        overflow: 'hidden',
        transform: hov ? 'translateY(-6px) scale(1.012)' : 'translateY(0) scale(1)',
        transition: 'all 0.32s cubic-bezier(0.16,1,0.3,1)',
        boxShadow: hov
          ? '0 24px 56px rgba(123,63,160,0.14), inset 0 1px 0 rgba(255,255,255,0.75)'
          : '0 4px 24px rgba(123,63,160,0.06), inset 0 1px 0 rgba(255,255,255,0.60)',
        display: 'flex',
        flexDirection: 'column',
        cursor: 'pointer',
        position: 'relative',
      }}
    >
      {/* Image */}
      <div style={{ height: '180px', overflow: 'hidden', position: 'relative' }}>
        <img
          src={thumb}
          alt={product.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.45s ease', transform: hov ? 'scale(1.06)' : 'scale(1)' }}
        />
        {/* Wishlist btn */}
        <button
          onClick={e => { e.stopPropagation(); onWishlist(); }}
          style={{
            position: 'absolute', top: '10px', right: '10px',
            width: '32px', height: '32px', borderRadius: '50%',
            background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(220,198,255,0.35)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: isWished ? '#E11D48' : '#8B6B5B',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isWished ? '#E11D48' : 'none'} stroke="currentColor" strokeWidth="2.2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>
        {/* Category badge */}
        <div style={{ position: 'absolute', top: '10px', left: '10px', fontSize: '0.60rem', fontWeight: 700, color: '#7B3FA0', background: 'rgba(255,255,255,0.80)', backdropFilter: 'blur(8px)', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(220,198,255,0.30)' }}>
          {product.category}
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', flex: 1 }}>
        {/* Title */}
        <h3
          style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.05rem', fontWeight: 500, color: '#2D004D', lineHeight: 1.3, marginBottom: '8px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
        >
          {product.title}
        </h3>

        {/* Rating */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', gap: '1px' }}>
            {[...Array(5)].map((_, i) => (
              <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i < Math.round(product.rating || 4.5) ? '#C7A55A' : 'none'} stroke="#C7A55A" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            ))}
          </div>
          <span style={{ fontSize: '0.70rem', fontWeight: 700, color: '#4E3B31' }}>{product.rating || 4.5}</span>
          <span style={{ fontSize: '0.65rem', color: '#8B6B5B' }}>({product.reviews || 0})</span>
        </div>

        {/* Price + actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 'auto', gap: '8px' }}>
          <span style={{ fontFamily: 'var(--font-editorial)', fontSize: '1.3rem', fontWeight: 500, color: '#2D004D' }}>
            {formatPrice(product.price)}
          </span>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              onClick={e => { e.stopPropagation(); onCart(); }}
              style={{ padding: '7px 12px', fontSize: '0.72rem', fontWeight: 700, borderRadius: '10px', border: '1.5px solid rgba(123,63,160,0.22)', background: 'rgba(123,63,160,0.06)', color: '#5A1E7E', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.06)'; }}
            >
              + Cart
            </button>
            <button
              onClick={e => { e.stopPropagation(); onView(); }}
              style={{ padding: '7px 14px', fontSize: '0.72rem', fontWeight: 700, borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 3px 10px rgba(90,30,126,0.25)', transition: 'all 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
            >
              View
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── ReportModal ───────────────────────────────────────────────────────────────
// Fully isolated component — its open/close state is managed in ProductPage
// and has no connection to the purchase, cart, or checkout flows.
const REPORT_CATEGORIES = [
  { value: 'spam',         label: 'Spam' },
  { value: 'inappropriate',label: 'Inappropriate Content' },
  { value: 'counterfeit',  label: 'Counterfeit / IP Violation' },
  { value: 'misleading',   label: 'Misleading Description' },
  { value: 'other',        label: 'Other' },
];

function ReportModal({
  product,
  user,
  userRole,
  reportCategory,
  setReportCategory,
  reportDescription,
  setReportDescription,
  reportSubmitting,
  reportSubmitted,
  reportError,
  onSubmit,
  onClose,
}) {
  // Close on backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(45,0,77,0.45)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <div
        style={{
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(40px)',
          borderRadius: '24px',
          padding: '32px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 24px 80px rgba(45,0,77,0.22)',
          border: '1px solid rgba(220,198,255,0.45)',
          position: 'relative',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(225,29,72,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E11D48', flexShrink: 0 }}>
              <Flag size={16} />
            </div>
            <div>
              <h2 style={{ fontFamily: 'var(--font-sans)', fontSize: '1rem', fontWeight: 700, color: '#2D004D', margin: 0 }}>
                Report this product
              </h2>
              <p style={{ fontSize: '0.70rem', color: '#8B6B5B', fontWeight: 500, margin: '2px 0 0' }}>
                {product?.title ? `"${product.title}"` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close report modal"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B6B5B', padding: '4px', lineHeight: 1, fontSize: '1.2rem', fontWeight: 700 }}
          >
            ×
          </button>
        </div>

        {reportSubmitted ? (
          /* ── Success state ── */
          <div style={{ textAlign: 'center', padding: '16px 0 8px' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(34,197,94,0.10)', border: '2px solid rgba(34,197,94,0.30)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Check size={22} color="#16a34a" />
            </div>
            <h3 style={{ fontSize: '0.96rem', fontWeight: 700, color: '#15803d', marginBottom: '8px' }}>
              Report submitted
            </h3>
            <p style={{ fontSize: '0.82rem', color: '#6B4F7A', lineHeight: 1.6, marginBottom: '20px' }}>
              Thank you for helping keep Lumora safe. Our moderation team will review your report.
            </p>
            <button
              onClick={onClose}
              style={{ padding: '10px 28px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              Close
            </button>
          </div>
        ) : (
          /* ── Form ── */
          <form onSubmit={onSubmit}>
            {userRole === 'admin' && (
              <div style={{ marginBottom: '16px', padding: '12px 14px', borderRadius: '12px', background: 'rgba(123,63,160,0.08)', border: '1.5px solid rgba(123,63,160,0.18)', fontSize: '0.8rem', color: '#7B3FA0', fontWeight: 600 }}>
                You are logged in as an Admin. To view submitted reports, visit the{' '}
                <Link to="/admin/reports" style={{ color: '#5A1E7E', textDecoration: 'underline', fontWeight: 700 }}>
                  Admin Reports Section
                </Link>.
              </div>
            )}
            {/* Category selector */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#4E3B31', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Category <span style={{ color: '#E11D48' }}>*</span>
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {REPORT_CATEGORIES.map(cat => (
                  <button
                    key={cat.value}
                    type="button"
                    onClick={() => setReportCategory(cat.value)}
                    style={{
                      padding: '9px 12px',
                      borderRadius: '10px',
                      border: `1.5px solid ${reportCategory === cat.value ? 'rgba(225,29,72,0.55)' : 'rgba(220,198,255,0.38)'}`,
                      background: reportCategory === cat.value ? 'rgba(225,29,72,0.08)' : 'rgba(255,255,255,0.55)',
                      color: reportCategory === cat.value ? '#C01340' : '#6B4F7A',
                      fontSize: '0.74rem',
                      fontWeight: reportCategory === cat.value ? 700 : 500,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      textAlign: 'left',
                      transition: 'all 0.18s',
                    }}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Description */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, color: '#4E3B31', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Description <span style={{ color: '#E11D48' }}>*</span>
              </label>
              <textarea
                value={reportDescription}
                onChange={e => setReportDescription(e.target.value)}
                placeholder="Please describe the issue in detail (minimum 10 characters)…"
                maxLength={2000}
                rows={4}
                required
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '12px 14px',
                  borderRadius: '12px',
                  border: '1.5px solid rgba(196,181,253,0.35)',
                  background: 'rgba(255,255,255,0.65)',
                  outline: 'none',
                  resize: 'vertical',
                  fontSize: '0.84rem',
                  color: '#2D004D',
                  fontFamily: 'var(--font-sans)',
                  lineHeight: 1.55,
                }}
                onFocus={e => { e.target.style.borderColor = 'rgba(225,29,72,0.45)'; }}
                onBlur={e => { e.target.style.borderColor = 'rgba(196,181,253,0.35)'; }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                <span style={{ fontSize: '0.66rem', color: '#8B6B5B' }}>{reportDescription.length}/2000</span>
              </div>
            </div>

            {/* Error message */}
            {reportError && (
              <div style={{ marginBottom: '14px', padding: '10px 14px', borderRadius: '10px', background: 'rgba(225,29,72,0.07)', border: '1px solid rgba(225,29,72,0.25)', fontSize: '0.78rem', color: '#C01340', fontWeight: 500 }}>
                {reportError}
              </div>
            )}

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={onClose}
                style={{ padding: '10px 20px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '12px', border: '1.5px solid rgba(220,198,255,0.38)', background: 'transparent', color: '#6B4F7A', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.18s' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={reportSubmitting || !reportCategory || reportDescription.trim().length < 10}
                style={{
                  padding: '10px 24px',
                  fontSize: '0.82rem', fontWeight: 700,
                  borderRadius: '12px', border: 'none',
                  background: (reportSubmitting || !reportCategory || reportDescription.trim().length < 10)
                    ? 'rgba(225,29,72,0.35)'
                    : 'linear-gradient(135deg,#E11D48,#C01340)',
                  color: '#fff',
                  cursor: (reportSubmitting || !reportCategory || reportDescription.trim().length < 10) ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  boxShadow: 'none',
                  transition: 'all 0.18s',
                  display: 'flex', alignItems: 'center', gap: '6px',
                }}
              >
                <Flag size={12} />
                {reportSubmitting ? 'Submitting…' : 'Submit Report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
