/**
 * useVendorData.js
 * ----------------
 * React hooks that connect every vendor dashboard page to the FastAPI backend.
 * Each hook follows the pattern:  fetch on mount → return { data, loading, error }.
 *
 * Backend base:  http://localhost:8000/api
 * Auth token:    localStorage.getItem('lumora_backend_token')
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { backendFetch } from '../utils/api';

// ── helper: get current vendor id from localStorage ────────────────────────
function getVendorId() {
  return localStorage.getItem('lumora_backend_uid') || null;
}

/**
 * useBackendReady
 * ---------------
 * Returns true once lumora_backend_token AND lumora_backend_uid are both
 * written to localStorage (set by authService.syncWithBackend).
 * Polls every 300 ms for up to 10 s so hooks that mount before firebase-sync
 * completes will still fire when the session becomes available.
 */
function useBackendReady() {
  const isReady = () =>
    !!localStorage.getItem('lumora_backend_token') &&
    !!localStorage.getItem('lumora_backend_uid');

  const [ready, setReady] = useState(isReady);
  const attemptsRef = useRef(0);
  const MAX_ATTEMPTS = 34; // 34 × 300 ms ≈ 10 s

  useEffect(() => {
    if (ready) return;

    const onReady = () => {
      if (isReady()) setReady(true);
    };

    window.addEventListener('lumora_backend_ready', onReady);
    window.addEventListener('storage', onReady);

    const tick = () => {
      attemptsRef.current += 1;
      if (isReady()) {
        setReady(true);
        return;
      }
      if (attemptsRef.current < MAX_ATTEMPTS) {
        setTimeout(tick, 300);
      } else {
        setReady(true); // give up — let hooks render their error state
      }
    };

    setTimeout(tick, 300);

    return () => {
      window.removeEventListener('lumora_backend_ready', onReady);
      window.removeEventListener('storage', onReady);
    };
  }, [ready]);

  return ready;
}

// ─────────────────────────────────────────────────────────────────────────────
// useDashboard  →  Dashboard.jsx
// ─────────────────────────────────────────────────────────────────────────────
export function useDashboard() {
  const backendReady = useBackendReady();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const vendorId = getVendorId();

  const refresh = useCallback(() => {
    const id = getVendorId();
    if (!id) {
      setError('Backend session not found. Please sign out and log in again as Vendor.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    backendFetch('/vendors/' + id + '/dashboard')
      .then(function(raw) {
        setData({
          stats: {
            totalRevenue: (raw.stats && raw.stats.total_revenue)   != null ? raw.stats.total_revenue   : 0,
            totalSales:   (raw.stats && raw.stats.total_orders)    != null ? raw.stats.total_orders    : 0,
            activeCount:  (raw.stats && raw.stats.active_products) != null ? raw.stats.active_products : 0,
            productCount: (raw.stats && raw.stats.product_count)   != null ? raw.stats.product_count   : 0,
            avgRating:    (raw.stats && raw.stats.avg_rating)      != null ? raw.stats.avg_rating      : 0,
          },
          recentOrders:   Array.isArray(raw.recent_orders)   ? raw.recent_orders   : [],
          recentProducts: Array.isArray(raw.recent_products) ? raw.recent_products : [],
          recentReviews:  Array.isArray(raw.recent_reviews)  ? raw.recent_reviews  : [],
          activity:       Array.isArray(raw.activity)        ? raw.activity        : [],
          monthlyChart:   Array.isArray(raw.monthly_chart)   ? raw.monthly_chart   : [],
        });
      })
      .catch(function(err) {
        backendFetch('/vendors/' + id + '/stats')
          .then(function(s) {
            setData({
              stats: {
                totalRevenue: s.total_revenue   != null ? s.total_revenue   : 0,
                totalSales:   s.total_orders    != null ? s.total_orders    : 0,
                activeCount:  s.active_products != null ? s.active_products : 0,
                productCount: s.product_count   != null ? s.product_count   : 0,
                avgRating:    s.avg_rating      != null ? s.avg_rating      : 0,
              },
              recentOrders: [], recentProducts: [], recentReviews: [],
              activity: [], monthlyChart: [],
            });
          })
          .catch(function() { setError(err.message); });
      })
      .finally(function() { setLoading(false); });
  }, []);

  useEffect(function() {
    if (!backendReady || !vendorId) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh, backendReady, vendorId]);

  var stats = data ? data.stats : null;
  return { data: data, stats: stats, loading: loading, error: error, refresh: refresh };
}

// ─────────────────────────────────────────────────────────────────────────────
// useOrders  →  Orders.jsx
// ─────────────────────────────────────────────────────────────────────────────
export function useOrders() {
  const backendReady = useBackendReady();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const vendorId = getVendorId();

  const refresh = useCallback(function() {
    const id = getVendorId();
    if (!id) { setLoading(false); return; }

    setLoading(true);
    backendFetch('/vendors/' + id + '/orders')
      .then(function(data) { setOrders(Array.isArray(data) ? data : []); })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setLoading(false); });
  }, []);

  useEffect(function() {
    if (!backendReady || !vendorId) {
      setOrders([]);
      setError(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh, backendReady, vendorId]);

  const fulfill = useCallback(function(orderId) {
    const id = getVendorId();
    if (!id) return Promise.resolve();
    return backendFetch('/vendors/' + id + '/orders/' + orderId + '/fulfill', { method: 'POST' })
      .then(function() { refresh(); });
  }, [refresh]);

  return { orders: orders, loading: loading, error: error, refresh: refresh, fulfill: fulfill };
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorProfile  →  Profile.jsx
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorProfile() {
  const backendReady = useBackendReady();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);
  const vendorId = getVendorId();

  useEffect(function() {
    if (!backendReady || !vendorId) {
      setProfile(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    backendFetch('/vendors/' + vendorId + '/profile')
      .then(function(data) { setProfile(data); })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setLoading(false); });
  }, [backendReady, vendorId]);

  const save = useCallback(function(formData) {
    const id = getVendorId();
    if (!id) return Promise.resolve();
    setSaving(true);
    setSaveOk(false);
    setError(null);
    return backendFetch('/vendors/' + id + '/profile', {
      method: 'PUT',
      body: JSON.stringify(formData),
    })
      .then(function(updated) {
        setProfile(updated);
        setSaveOk(true);
        setTimeout(function() { setSaveOk(false); }, 3000);
      })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setSaving(false); });
  }, []);

  return { profile: profile, loading: loading, saving: saving, error: error, saveOk: saveOk, save: save };
}

// ─────────────────────────────────────────────────────────────────────────────
// useStoreSettings  →  StoreSettings.jsx
// ─────────────────────────────────────────────────────────────────────────────
export function useStoreSettings() {
  const backendReady = useBackendReady();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveOk, setSaveOk] = useState(false);
  const vendorId = getVendorId();

  useEffect(function() {
    if (!backendReady || !vendorId) {
      setSettings(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    backendFetch('/vendors/' + vendorId + '/profile')
      .then(function(data) { setSettings(data); })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setLoading(false); });
  }, [backendReady, vendorId]);

  const save = useCallback(function(formData) {
    const id = getVendorId();
    if (!id) return Promise.resolve();
    setSaving(true);
    setSaveOk(false);
    setError(null);
    return backendFetch('/vendors/' + id + '/store-settings', {
      method: 'PUT',
      body: JSON.stringify(formData),
    })
      .then(function() {
        setSettings(function(prev) { return Object.assign({}, prev, formData); });
        setSaveOk(true);
        setTimeout(function() { setSaveOk(false); }, 3000);
      })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setSaving(false); });
  }, []);

  return { settings: settings, loading: loading, saving: saving, error: error, saveOk: saveOk, save: save };
}

// ─────────────────────────────────────────────────────────────────────────────
// useWithdrawals  →  Withdrawals.jsx
// ─────────────────────────────────────────────────────────────────────────────
export function useWithdrawals() {
  const backendReady = useBackendReady();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmit] = useState(false);
  const [error, setError] = useState(null);
  const vendorId = getVendorId();

  const refresh = useCallback(function() {
    const id = getVendorId();
    if (!id) { setLoading(false); return; }

    setLoading(true);
    backendFetch('/vendors/' + id + '/withdrawals')
      .then(function(data) { setHistory(Array.isArray(data) ? data : []); })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setLoading(false); });
  }, []);

  useEffect(function() {
    if (!backendReady || !vendorId) {
      setHistory([]);
      setError(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh, backendReady, vendorId]);

  const submit = useCallback(function(opts) {
    const id = getVendorId();
    if (!id) return Promise.reject(new Error('Not authenticated'));
    setSubmit(true);
    setError(null);
    return backendFetch('/vendors/' + id + '/withdrawals', {
      method: 'POST',
      body: JSON.stringify({
        amount: Number(opts.amount),
        method: opts.method,
        upiId: opts.upiId,
        bankAccount: opts.bankAccount,
      }),
    })
      .then(function(entry) {
        setHistory(function(prev) { return [entry].concat(prev); });
        return entry;
      })
      .catch(function(err) {
        setError(err.message);
        throw err;
      })
      .finally(function() { setSubmit(false); });
  }, []);

  return { history: history, loading: loading, submitting: submitting, error: error, submit: submit };
}

// ─────────────────────────────────────────────────────────────────────────────
// useReviews  →  Reviews.jsx
// ─────────────────────────────────────────────────────────────────────────────
export function useReviews() {
  const backendReady = useBackendReady();
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const vendorId = getVendorId();

  const refresh = useCallback(function() {
    const id = getVendorId();
    if (!id) { setLoading(false); return; }

    setLoading(true);
    setError(null);
    backendFetch('/vendors/' + id + '/reviews')
      .then(function(data) { setReviews(Array.isArray(data) ? data : []); })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setLoading(false); });
  }, []);

  useEffect(function() {
    if (!backendReady || !vendorId) {
      setReviews([]);
      setError(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh, backendReady, vendorId]);

  const reply = useCallback(function(reviewId, text) {
    const id = getVendorId();
    if (!id) return Promise.resolve();
    return backendFetch('/vendors/' + id + '/reviews/' + reviewId + '/reply', {
      method: 'POST',
      body: JSON.stringify({ reply: text }),
    })
      .then(function() {
        setReviews(function(prev) {
          return prev.map(function(r) {
            return String(r.id) === String(reviewId) ? Object.assign({}, r, { reply: text }) : r;
          });
        });
      })
      .catch(function(err) {
        setError(err.message);
        throw err;
      });
  }, []);

  return { reviews: reviews, loading: loading, error: error, reply: reply, refresh: refresh };
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorProducts  →  ManageProducts.jsx / AddProduct.jsx / EditProduct.jsx
// ─────────────────────────────────────────────────────────────────────────────
export function useVendorProducts(opts) {
  var _opts = opts || {};
  var search   = _opts.search   || '';
  var category = _opts.category || '';
  var status   = _opts.status   || '';
  var sort     = _opts.sort     || 'newest';
  var page     = _opts.page     || 1;
  var limit    = _opts.limit    || 20;

  const backendReady = useBackendReady();
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const vendorId = getVendorId();

  const refresh = useCallback(function() {
    const id = getVendorId();
    if (!id) { setLoading(false); return; }

    setLoading(true);
    setError(null);
    var params = new URLSearchParams({
      search: search, category: category, status: status,
      sort: sort, page: page, limit: limit,
    });
    backendFetch('/vendors/' + id + '/products?' + params.toString())
      .then(function(res) {
        if (Array.isArray(res)) {
          setData({ items: res, total: res.length, page: 1, pages: 1 });
        } else {
          setData({
            items: Array.isArray(res.items) ? res.items : [],
            total: res.total  != null ? res.total  : 0,
            page:  res.page   != null ? res.page   : 1,
            pages: res.pages  != null ? res.pages  : 1,
          });
        }
      })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setLoading(false); });
  }, [search, category, status, sort, page, limit]);

  useEffect(function() {
    if (!backendReady || !vendorId) {
      setData({ items: [], total: 0, page: 1, pages: 1 });
      setError(null);
      setLoading(false);
      return;
    }
    refresh();
  }, [refresh, backendReady, vendorId]);

  const createProduct = useCallback(function(formData) {
    var tags = Array.isArray(formData.tags)
      ? formData.tags
      : (formData.tags || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
    var payload = {
      title:       formData.title,
      description: formData.description || '',
      category:    formData.category    || '',
      price:       Number(formData.price) || 0,
      preview:     formData.preview     || null,
      thumbnail:   formData.preview     || null,
      file_url:    formData.file_url    || formData.file || null,
      license:     formData.license     || null,
      version:     formData.version     || 'v1.0.0',
      file_size:   formData.file_size   || null,
      status:      formData.status      || 'published',
      tags:        tags,
      featured:    !!formData.featured,
      trending:    !!formData.trending,
      new_arrival: formData.new_arrival !== undefined ? !!formData.new_arrival : true,
      badge:       formData.badge       || 'New',
      affiliate_enabled: !!formData.affiliate_enabled,
      commission_type:   formData.commission_type  || 'percentage',
      commission_value:  Number(formData.commission_value) || 0,
      // Extended fields
      short_desc:          formData.short_desc          || null,
      features:            formData.features            || [],
      system_requirements: formData.system_requirements || [],
      what_you_get:        formData.what_you_get        || [],
      installation_guide:  formData.installation_guide  || null,
      subcategory:         formData.subcategory         || null,
      discount:            Number(formData.discount)    || 0,
      preview_images:      formData.preview_images      || [],
      preview_video:       formData.preview_video       || null,
      seo_title:           formData.seo_title           || null,
      seo_description:     formData.seo_description     || null,
      visibility:          formData.visibility          || 'public'
    };
    return backendFetch('/products/', {
      method: 'POST',
      body:   JSON.stringify(payload),
    }).then(function(result) { refresh(); return result; });
  }, [refresh]);

  const updateProduct = useCallback(function(productId, formData) {
    var payload = {};
    if (formData.title       !== undefined) payload.title       = formData.title;
    if (formData.description !== undefined) payload.description = formData.description;
    if (formData.category    !== undefined) payload.category    = formData.category;
    if (formData.price       !== undefined) payload.price       = Number(formData.price);
    if (formData.preview     !== undefined) { payload.preview   = formData.preview; payload.thumbnail = formData.preview; }
    if (formData.file_url    !== undefined) payload.file_url    = formData.file_url;
    if (formData.file_size   !== undefined) payload.file_size   = formData.file_size;
    if (formData.license     !== undefined) payload.license     = formData.license;
    if (formData.version     !== undefined) payload.version     = formData.version;
    if (formData.status      !== undefined) payload.status      = formData.status;
    if (formData.featured    !== undefined) payload.featured    = formData.featured;
    if (formData.trending    !== undefined) payload.trending    = formData.trending;
    if (formData.affiliate_enabled !== undefined) payload.affiliate_enabled = formData.affiliate_enabled;
    if (formData.commission_type   !== undefined) payload.commission_type   = formData.commission_type;
    if (formData.commission_value  !== undefined) payload.commission_value  = Number(formData.commission_value) || 0;
    if (formData.tags !== undefined) {
      payload.tags = Array.isArray(formData.tags)
        ? formData.tags
        : (formData.tags || '').split(',').map(function(t) { return t.trim(); }).filter(Boolean);
    }
    // Extended fields
    if (formData.short_desc !== undefined)          payload.short_desc          = formData.short_desc;
    if (formData.features !== undefined)            payload.features            = formData.features;
    if (formData.system_requirements !== undefined) payload.system_requirements = formData.system_requirements;
    if (formData.what_you_get !== undefined)        payload.what_you_get        = formData.what_you_get;
    if (formData.installation_guide !== undefined)  payload.installation_guide  = formData.installation_guide;
    if (formData.subcategory !== undefined)         payload.subcategory         = formData.subcategory;
    if (formData.discount !== undefined)            payload.discount            = Number(formData.discount);
    if (formData.preview_images !== undefined)      payload.preview_images      = formData.preview_images;
    if (formData.preview_video !== undefined)       payload.preview_video       = formData.preview_video;
    if (formData.seo_title !== undefined)           payload.seo_title           = formData.seo_title;
    if (formData.seo_description !== undefined)     payload.seo_description     = formData.seo_description;
    if (formData.visibility !== undefined)          payload.visibility          = formData.visibility;

    return backendFetch('/products/' + productId, {
      method: 'PUT',
      body:   JSON.stringify(payload),
    }).then(function(result) {
      setData(function(prev) {
        return Object.assign({}, prev, {
          items: prev.items.map(function(p) {
            return String(p.id) === String(productId) ? Object.assign({}, p, payload) : p;
          }),
        });
      });
      return result;
    });
  }, []);

  const deleteProduct = useCallback(function(productId) {
    return backendFetch('/products/' + productId, { method: 'DELETE' })
      .then(function() {
        setData(function(prev) {
          return Object.assign({}, prev, {
            items: prev.items.filter(function(p) { return String(p.id) !== String(productId); }),
            total: Math.max(0, prev.total - 1),
          });
        });
      });
  }, []);

  return {
    products:    data.items,
    total:       data.total,
    pages:       data.pages,
    currentPage: data.page,
    loading:     loading,
    error:       error,
    refresh:     refresh,
    createProduct: createProduct,
    updateProduct: updateProduct,
    deleteProduct: deleteProduct,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// useEarnings  →  Earnings.jsx
// ─────────────────────────────────────────────────────────────────────────────
export function useEarnings() {
  const backendReady = useBackendReady();
  const [earnings, setEarnings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const vendorId = getVendorId();

  useEffect(function() {
    if (!backendReady || !vendorId) {
      setEarnings(null);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    backendFetch('/vendors/' + vendorId + '/stats')
      .then(function(data) {
        setEarnings({
          gross:     data.total_revenue != null ? data.total_revenue : 0,
          net:       (data.total_revenue != null ? data.total_revenue : 0) * 0.85,
          withdrawn: data.withdrawn     != null ? data.withdrawn     : 0,
          available: ((data.total_revenue != null ? data.total_revenue : 0) * 0.85) - (data.withdrawn != null ? data.withdrawn : 0),
        });
      })
      .catch(function(err) { setError(err.message); })
      .finally(function() { setLoading(false); });
  }, [backendReady, vendorId]);

  return { earnings: earnings, loading: loading, error: error };
}

// ─────────────────────────────────────────────────────────────────────────────
// useVendorProfileComplete
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Single source of truth for the vendor onboarding gate.
 *
 * Fetches the vendor profile from the backend so the check survives
 * refresh, logout/login, and backend restarts.
 *
 * A profile is considered complete when ALL three conditions pass:
 *   1. Store Name    — profile.storeName (mapped from vendor.name) is non-empty
 *   2. Store Desc    — profile.storeBio  (mapped from vendor.bio)  is non-empty
 *   3. Payment Info  — profile.upiId OR
 *                      all four bank fields (accountHolderName, bankName,
 *                      accountNumber, ifscCode) are non-empty
 *
 * Store Logo and Government ID are intentionally excluded until their
 * upload infrastructure is production-ready.
 *
 * Returns:
 *   isProfileComplete {boolean}   — true when all checks pass
 *   profileChecks     {Array}     — [{ key, label, done }] for rendering the checklist
 *   loading           {boolean}   — true while the backend fetch is in-flight
 */
export function useVendorProfileComplete() {
  const backendReady = useBackendReady();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const vendorId = getVendorId();

  useEffect(function () {
    if (!backendReady || !vendorId) {
      setProfile(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    backendFetch('/vendors/' + vendorId + '/profile')
      .then(function (data) { setProfile(data); })
      .catch(function () { setProfile(null); })
      .finally(function () { setLoading(false); });
  }, [backendReady, vendorId]);

  // ── Derive individual checks from backend profile ─────────────────────────
  const storeName = (profile?.name || profile?.storeName || '').trim();
  const storeBio  = (profile?.bio  || profile?.storeBio  || '').trim();

  const hasStoreName = !!storeName;
  const hasStoreDesc = !!storeBio;

  // UPI: single field sufficient
  const hasUpi  = !!(profile?.upiId?.trim());
  // Bank: all four fields required together
  const hasBank = !!(
    profile?.accountHolderName?.trim() &&
    profile?.bankName?.trim() &&
    profile?.accountNumber?.trim() &&
    profile?.ifscCode?.trim()
  );
  const hasPayment = hasUpi || hasBank;

  const profileChecks = [
    { key: 'storeName', label: 'Store Name',                 done: hasStoreName },
    { key: 'storeDesc', label: 'Store Description',          done: hasStoreDesc },
    { key: 'payment',   label: 'Payment Info (UPI or Bank)', done: hasPayment   },
  ];

  return {
    isProfileComplete: !loading && profileChecks.every(function (c) { return c.done; }),
    profileChecks,
    loading,
  };
}
