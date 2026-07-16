import React, { useState, useEffect } from 'react';
import {
  Copy, Check, Edit3, Save, User, CreditCard, Link2,
  Shield, AlertCircle, RefreshCw, Activity, TrendingUp,
  DollarSign, MousePointerClick, ShoppingBag, Calendar,
  X, Globe, Target, Users, Settings, MessageCircle, Monitor, Youtube, Instagram, Twitter, Linkedin, Github, Info
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';

const SITE_URL = import.meta.env.VITE_SITE_URL || window.location.origin;

const formatINR = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(v || 0);

const formatDate = (d) => {
  if (!d) return 'N/A';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

export default function AffiliateProfile({
  profile: parentProfile,
  stats,
  payouts,
  loading,
  error: parentError,
  refresh,
}) {
  const { user, updateProfile } = useAuth();

  /* ── Payment & New Profile draft state ───────────────────── */
  const [draft, setDraft]       = useState({ 
    upiId: '', bankName: '', accountNumber: '', ifscCode: '', fullName: '', phone: '',
    // Phase 1 New Fields
    displayName: '', shortBio: '', country: '',
    youtube: '', instagram: '', linkedin: '',
    preferredCategories: [], promotionMethods: [],
    primaryAudience: '', audienceSize: '', preferredLanguage: '',
    preferredCurrency: 'USD', timezone: 'UTC', emailNotifications: true
  });
  const [editing, setEditing]   = useState(false);
  const [saved, setSaved]       = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saving, setSaving]     = useState(false);

  /* ── Copy state ───────────────────────────────────────────────────── */
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  /* ── Derived values from live API props ───────────────────────────── */
  const REFERRAL_CODE = stats?.referral_code || parentProfile?.referral_code || '—';
  const REFERRAL_LINK = stats?.referral_link || (REFERRAL_CODE !== '—' ? `${SITE_URL}?ref=${REFERRAL_CODE}` : SITE_URL);

  const displayName   = user?.displayName || user?.email?.split('@')[0] || 'Lumora Affiliate';
  const displayEmail  = user?.email || '—';
  const displayPhone  = user?.phoneNumber || '—';

  const isActive        = parentProfile?.is_active ?? true;
  const commissionRate  = parentProfile?.commission_rate ?? stats?.conversion_rate ?? 20;
  const memberSince     = parentProfile?.created_at;
  const totalEarnings   = parentProfile?.total_earnings ?? stats?.total_earnings ?? 0;
  const totalClicks     = parentProfile?.total_clicks   ?? stats?.total_clicks   ?? 0;
  const totalSales      = parentProfile?.total_sales    ?? stats?.total_sales    ?? 0;

  /* ── Sync draft from API whenever profile loads/changes ───────────── */
  useEffect(() => {
    setDraft({
      upiId:         parentProfile?.upi_id         || '',
      bankName:      parentProfile?.bank_name       || '',
      accountNumber: parentProfile?.account_number  || '',
      ifscCode:      parentProfile?.ifsc_code       || '',
      fullName:      user?.displayName || user?.email?.split('@')[0] || '',
      phone:         user?.phoneNumber || '',
      // Phase 1 New Fields
      displayName: parentProfile?.display_name || '', 
      shortBio: parentProfile?.short_bio || '', 
      country: parentProfile?.country || '',
      youtube: parentProfile?.youtube || '', 
      instagram: parentProfile?.instagram || '', 
      linkedin: parentProfile?.linkedin || '',
      preferredCategories: parentProfile?.preferred_categories || [], 
      promotionMethods: parentProfile?.promotion_methods || [],
      primaryAudience: parentProfile?.primary_audience || '', 
      audienceSize: parentProfile?.audience_size || '', 
      preferredLanguage: parentProfile?.preferred_language || '',
      preferredCurrency: parentProfile?.preferred_currency || 'USD', 
      timezone: parentProfile?.timezone || 'UTC', 
      emailNotifications: parentProfile?.email_notifications ?? true
    });
  }, [parentProfile, user]);

  // Calculate Profile Completion
  const calculateCompletion = () => {
    const required = [
      'fullName', 'upiId', 'phone', 
      'shortBio', 'instagram', 'preferredCategories'
    ];
    let completed = 0;
    const missing = [];
    required.forEach(field => {
      if (field === 'preferredCategories') {
        if (draft[field] && draft[field].length > 0) completed++;
        else missing.push('Preferred Categories');
      } else {
        if (draft[field] && String(draft[field]).trim() !== '') completed++;
        else missing.push(field.charAt(0).toUpperCase() + field.slice(1).replace(/([A-Z])/g, ' $1').trim());
      }
    });
    return { percentage: Math.round((completed / required.length) * 100), missing };
  };
  const { percentage, missing } = calculateCompletion();

  /* ── Handlers ─────────────────────────────────────────────────────── */
  const handleSave = async () => {
    try {
      setSaving(true);
      setSaveError(null);
      await backendFetch('/affiliate/profile', {
        method: 'PUT',
        body: JSON.stringify({
          upi_id:         draft.upiId         || null,
          bank_name:      draft.bankName      || null,
          account_number: draft.accountNumber || null,
          ifsc_code:      draft.ifscCode      || null,
          display_name:   draft.displayName   || null,
          short_bio:      draft.shortBio      || null,
          country:        draft.country       || null,
          youtube:        draft.youtube       || null,
          instagram:      draft.instagram     || null,
          linkedin:       draft.linkedin      || null,
          preferred_categories: draft.preferredCategories || [],
          promotion_methods: draft.promotionMethods || [],
          primary_audience: draft.primaryAudience || null,
          audience_size:  draft.audienceSize  || null,
          preferred_language: draft.preferredLanguage || null,
          preferred_currency: draft.preferredCurrency || null,
          timezone:       draft.timezone      || null,
          email_notifications: draft.emailNotifications
        }),
      });
      
      // Update AuthContext / Firebase profile
      if (updateProfile) {
        await updateProfile({
          displayName: draft.fullName,
          phoneNumber: draft.phone
        });
      }

      setEditing(false);
      setSaved(true);
      if (refresh) refresh();
      setTimeout(() => setSaved(false), 2400);
    } catch (err) {
      console.error('Profile update error:', err);
      setSaveError(err.message || 'Failed to update payment profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setDraft({
      upiId:         parentProfile?.upi_id         || '',
      bankName:      parentProfile?.bank_name       || '',
      accountNumber: parentProfile?.account_number  || '',
      ifscCode:      parentProfile?.ifsc_code       || '',
      fullName:      user?.displayName || user?.email?.split('@')[0] || '',
      phone:         user?.phoneNumber || '',
      displayName: parentProfile?.display_name || '', 
      shortBio: parentProfile?.short_bio || '', 
      country: parentProfile?.country || '',
      youtube: parentProfile?.youtube || '', 
      instagram: parentProfile?.instagram || '', 
      linkedin: parentProfile?.linkedin || '',
      preferredCategories: parentProfile?.preferred_categories || [], 
      promotionMethods: parentProfile?.promotion_methods || [],
      primaryAudience: parentProfile?.primary_audience || '', 
      audienceSize: parentProfile?.audience_size || '', 
      preferredLanguage: parentProfile?.preferred_language || '',
      preferredCurrency: parentProfile?.preferred_currency || 'USD', 
      timezone: parentProfile?.timezone || 'UTC', 
      emailNotifications: parentProfile?.email_notifications ?? true
    });
    setEditing(false);
    setSaveError(null);
  };

  const copyCode = () => {
    if (REFERRAL_CODE === '—') return;
    navigator.clipboard.writeText(REFERRAL_CODE).catch(() => {});
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = () => {
    navigator.clipboard.writeText(REFERRAL_LINK).catch(() => {});
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  /* ── Reusable read-only display field ─────────────────────────────── */
  const readField = (label, value) => (
    <div>
      <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>{label}</label>
      <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', padding: '11px 16px', borderRadius: '12px', background: 'rgba(45,0,96,0.02)', border: '1px solid rgba(45,0,96,0.06)' }}>
        {value || <span style={{ color: 'var(--text-muted)' }}>—</span>}
      </div>
    </div>
  );
  
  /* ── Reusable editable personal field ──────────────────────────────── */
  const personalField = (label, key, placeholder = '') => (
    <div>
      <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>{label}</label>
      {editing ? (
        <div className="glass-input" style={{ padding: '11px 16px' }}>
          <input
            type="text"
            value={draft[key]}
            placeholder={placeholder}
            onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.88rem', color: 'var(--text-primary)', width: '100%', fontWeight: 500 }}
          />
        </div>
      ) : (
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', padding: '11px 16px', borderRadius: '12px', background: 'rgba(45,0,96,0.02)', border: '1px solid rgba(45,0,96,0.06)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {draft[key] || <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.82rem' }}>—</span>}
        </div>
      )}
    </div>
  );

  /* ── Phase 1 Extra Field Helpers ──────────────────────────────── */
  const textAreaField = (label, key, placeholder, maxChars) => (
    <div style={{ gridColumn: '1 / -1' }}>
      <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>{label}</label>
      {editing ? (
        <div className="glass-input" style={{ padding: '11px 16px' }}>
          <textarea
            value={draft[key]}
            placeholder={placeholder}
            maxLength={maxChars}
            onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.88rem', color: 'var(--text-primary)', width: '100%', fontWeight: 500, resize: 'vertical', minHeight: '60px' }}
          />
          <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '4px' }}>{draft[key]?.length || 0} / {maxChars}</div>
        </div>
      ) : (
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', padding: '11px 16px', borderRadius: '12px', background: 'rgba(45,0,96,0.02)', border: '1px solid rgba(45,0,96,0.06)' }}>
          {draft[key] || <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.82rem' }}>—</span>}
        </div>
      )}
    </div>
  );

  const selectField = (label, key, options) => (
    <div>
      <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>{label}</label>
      {editing ? (
        <div className="glass-input" style={{ padding: '0 16px' }}>
          <select
            value={draft[key]}
            onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.88rem', color: 'var(--text-primary)', width: '100%', fontWeight: 500, height: '42px' }}
          >
            <option value="" disabled>Select {label}</option>
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        </div>
      ) : (
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', padding: '11px 16px', borderRadius: '12px', background: 'rgba(45,0,96,0.02)', border: '1px solid rgba(45,0,96,0.06)' }}>
          {draft[key] || <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.82rem' }}>—</span>}
        </div>
      )}
    </div>
  );

  const multiSelectField = (label, key, options) => (
    <div style={{ gridColumn: '1 / -1' }}>
      <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>{label}</label>
      {editing ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {options.map(opt => {
            const isSelected = draft[key].includes(opt);
            return (
              <label key={opt} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: isSelected ? 'rgba(123,63,160,0.1)' : 'rgba(45,0,96,0.02)', border: isSelected ? '1px solid rgba(123,63,160,0.3)' : '1px solid rgba(45,0,96,0.08)', cursor: 'pointer', fontSize: '0.8rem', color: isSelected ? '#7B3FA0' : 'var(--text-secondary)', fontWeight: isSelected ? 600 : 500 }}>
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    const newArr = e.target.checked ? [...draft[key], opt] : draft[key].filter(x => x !== opt);
                    setDraft(prev => ({ ...prev, [key]: newArr }));
                  }}
                  style={{ display: 'none' }}
                />
                {isSelected && <Check size={12} />}
                {opt}
              </label>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          {draft[key].length > 0 ? draft[key].map(opt => (
            <span key={opt} style={{ padding: '6px 12px', borderRadius: '20px', background: 'rgba(45,0,96,0.03)', border: '1px solid rgba(45,0,96,0.08)', fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{opt}</span>
          )) : <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.82rem' }}>—</span>}
        </div>
      )}
    </div>
  );

  const toggleField = (label, key) => (
    <div>
      <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>{label}</label>
      {editing ? (
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', padding: '8px 0' }}>
          <input
            type="checkbox"
            checked={draft[key]}
            onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.checked }))}
            style={{ width: '16px', height: '16px', accentColor: '#7B3FA0' }}
          />
          <span style={{ fontSize: '0.88rem', fontWeight: 500, color: 'var(--text-primary)' }}>{draft[key] ? 'Enabled' : 'Disabled'}</span>
        </label>
      ) : (
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', padding: '11px 16px', borderRadius: '12px', background: 'rgba(45,0,96,0.02)', border: '1px solid rgba(45,0,96,0.06)' }}>
          {draft[key] ? 'Enabled' : 'Disabled'}
        </div>
      )}
    </div>
  );

  /* ── Reusable editable payment field ──────────────────────────────── */
  const payField = (label, key, placeholder = '') => (
    <div>
      <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>{label}</label>
      {editing ? (
        <div className="glass-input" style={{ padding: '11px 16px' }}>
          <input
            type="text"
            value={draft[key]}
            placeholder={placeholder}
            onChange={e => setDraft(prev => ({ ...prev, [key]: e.target.value }))}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.88rem', color: 'var(--text-primary)', width: '100%', fontWeight: 500 }}
          />
        </div>
      ) : (
        <div style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', padding: '11px 16px', borderRadius: '12px', background: 'rgba(45,0,96,0.02)', border: '1px solid rgba(45,0,96,0.06)' }}>
          {draft[key] || <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '0.82rem' }}>Not set — click Edit to add</span>}
        </div>
      )}
    </div>
  );

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     LOADING SKELETON
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
        <style>{`@keyframes skeletonPulse { 0%,100%{opacity:.6} 50%{opacity:1} }`}</style>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <div className="premium-flat-card" style={{ width: '80px', height: '11px', borderRadius: '5px', marginBottom: '8px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
            <div className="premium-flat-card" style={{ width: '220px', height: '26px', borderRadius: '7px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
          </div>
          <div className="premium-flat-card" style={{ width: '130px', height: '42px', borderRadius: '12px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        </div>
        <div className="premium-flat-card" style={{ height: '110px', borderRadius: '20px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        <div className="premium-flat-card" style={{ height: '180px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        <div className="premium-flat-card" style={{ height: '240px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
        <div className="premium-flat-card" style={{ height: '200px', borderRadius: '16px', animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     ERROR STATE
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  if (parentError) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        minHeight: '320px', gap: '16px', padding: '48px',
        background: 'rgba(255,255,255,0.70)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(239,68,68,0.18)', borderRadius: '20px', textAlign: 'center',
      }}>
        <div style={{ width: '48px', height: '48px', borderRadius: '14px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#DC2626' }}>
          <AlertCircle size={22} />
        </div>
        <div>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>Failed to load profile</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '6px', maxWidth: '340px' }}>{parentError}</div>
        </div>
        {refresh && (
          <button
            onClick={refresh}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', fontSize: '0.82rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)', color: '#fff', cursor: 'pointer', fontFamily: 'var(--font-sans)', boxShadow: '0 4px 14px rgba(123,63,160,0.35)' }}
          >
            <RefreshCw size={13} /> Try Again
          </button>
        )}
      </div>
    );
  }

  /* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
     MAIN RENDER
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

      {/* ── SUCCESS TOAST ────────────────────────────────────────────────── */}
      {saved && (
        <div style={{
          position: 'fixed', bottom: '28px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(34,197,94,0.90)', backdropFilter: 'blur(16px)',
          border: '1px solid rgba(34,197,94,0.40)', color: '#fff',
          fontFamily: 'var(--font-sans)', fontSize: '0.8rem', fontWeight: 600,
          padding: '12px 24px', borderRadius: '30px',
          boxShadow: '0 8px 32px rgba(34,197,94,0.25)',
          zIndex: 9999, display: 'flex', alignItems: 'center', gap: '8px',
          animation: 'toastIn 0.35s cubic-bezier(0.16,1,0.3,1)',
        }}>
          <Check size={14} /> Payment profile saved!
        </div>
      )}

      {/* ── HEADER ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span className="caption-premium" style={{ color: '#7B3FA0' }}>Account</span>
          <h2 className="text-editorial" style={{ fontSize: '2.2rem', fontWeight: 400, color: 'var(--text-primary)', marginTop: '4px' }}>Affiliate Profile</h2>
        </div>

        {!editing ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            {refresh && (
              <button
                onClick={refresh}
                title="Refresh"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '40px', height: '40px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.30)', background: 'rgba(255,255,255,0.70)', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.2s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(123,63,160,0.35)'; e.currentTarget.style.color = '#7B3FA0'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(196,181,253,0.30)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
              >
                <RefreshCw size={14} />
              </button>
            )}
            <button
              onClick={() => { setEditing(true); setSaveError(null); }}
              className="btn-premium"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', fontSize: '0.84rem', cursor: 'pointer' }}
            >
              <Edit3 size={14} /> Edit Profile
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, boxShadow: '0 4px 16px rgba(123,63,160,0.35)', fontFamily: 'var(--font-sans)' }}
            >
              <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
            </button>
            <button
              onClick={handleCancel}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '10px 22px', fontSize: '0.84rem', fontWeight: 700, borderRadius: '12px', border: '1.5px solid rgba(185,157,216,0.35)', background: 'rgba(255,255,255,0.80)', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'var(--font-sans)' }}
            >
              <X size={14} /> Cancel
            </button>
          </div>
        )}
      </div>

      {/* ── SAVE ERROR BANNER ────────────────────────────────────────────── */}
      {saveError && (
        <div style={{ padding: '12px 18px', borderRadius: '12px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.22)', color: '#DC2626', fontSize: '0.78rem', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={15} style={{ flexShrink: 0 }} />
          <span>{saveError}</span>
          <button onClick={() => setSaveError(null)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', padding: '2px', display: 'flex' }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── AVATAR + MEMBERSHIP HERO ─────────────────────────────────────── */}
      <div className="glass-card" style={{
        padding: '32px 36px',
        background: 'linear-gradient(135deg, rgba(246,244,255,0.92) 0%, rgba(237,233,254,0.55) 100%)',
        display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap',
      }}>
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 24px rgba(123,63,160,0.35)',
          fontSize: '1.6rem', color: '#fff', fontFamily: 'var(--font-editorial)',
          flexShrink: 0,
        }}>
          {displayName[0] ?? 'A'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1.1 }}>{displayName}</h3>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 500, marginTop: '4px' }}>{displayEmail}</p>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
            {/* Account status badge */}
            <span style={{
              fontSize: '0.65rem', padding: '4px 12px', borderRadius: '20px',
              background: isActive
                ? 'linear-gradient(135deg, rgba(34,197,94,0.10), rgba(22,163,74,0.06))'
                : 'rgba(239,68,68,0.08)',
              border: isActive ? '1px solid rgba(34,197,94,0.28)' : '1px solid rgba(239,68,68,0.25)',
              color: isActive ? '#15803D' : '#DC2626',
              fontWeight: 700,
            }}>
              {isActive ? '✦ Active Affiliate' : '✦ Inactive'}
            </span>
            <span style={{ fontSize: '0.65rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(45,0,96,0.03)', border: '1px solid rgba(45,0,96,0.08)', color: 'var(--text-secondary)', fontWeight: 600 }}>
              Code: {REFERRAL_CODE}
            </span>
            {memberSince && (
              <span style={{ fontSize: '0.65rem', padding: '4px 12px', borderRadius: '20px', background: 'rgba(45,0,96,0.03)', border: '1px solid rgba(45,0,96,0.08)', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Calendar size={9} /> Since {formatDate(memberSince)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── ACCOUNT STATUS STRIP ─────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '18px 24px', display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
        {[
          { label: 'Status',          value: isActive ? 'Active' : 'Inactive', color: isActive ? '#15803D' : '#DC2626', icon: <Activity size={14} /> },
          { label: 'Commission Rate', value: `${commissionRate}%`,             color: '#7B3FA0',                         icon: <TrendingUp size={14} /> },
          { label: 'Total Earnings',  value: formatINR(totalEarnings),         color: '#7B3FA0',                         icon: <DollarSign size={14} /> },
          { label: 'Total Clicks',    value: totalClicks.toLocaleString(),      color: 'var(--text-primary)',             icon: <MousePointerClick size={14} /> },
          { label: 'Total Sales',     value: totalSales.toLocaleString(),       color: 'var(--text-primary)',             icon: <ShoppingBag size={14} /> },
        ].map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(123,63,160,0.05)', border: '1px solid rgba(196,181,253,0.20)', color: item.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {item.icon}
            </div>
            <div>
              <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{item.label}</div>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, color: item.color, marginTop: '1px' }}>{item.value}</div>
            </div>
            {i < 4 && <div style={{ width: '1px', height: '32px', background: 'rgba(45,0,96,0.06)', marginLeft: '16px' }} />}
          </div>
        ))}
      </div>

      {/* ── PROFILE COMPLETION ─────────────────────────────────────────── */}
      {percentage === 100 ? (
        <div className="premium-flat-card" style={{ padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(21,128,61,0.04)', border: '1px solid rgba(21,128,61,0.1)' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#15803D', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Check size={16} strokeWidth={3} />
          </div>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600, color: '#15803D' }}>Profile 100% Complete</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>You're all set to maximize your earnings.</div>
          </div>
        </div>
      ) : (
        <div className="premium-flat-card" style={{ padding: '24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <span className="caption-premium" style={{ color: '#7B3FA0' }}>Onboarding</span>
              <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>Profile Completion</h3>
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#7B3FA0' }}>
              {percentage}%
            </div>
          </div>
          <div style={{ width: '100%', height: '8px', background: 'rgba(45,0,96,0.05)', borderRadius: '10px', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ height: '100%', width: `${percentage}%`, background: 'linear-gradient(90deg, #7B3FA0, #A855F7)', transition: 'width 0.4s ease' }} />
          </div>
          {missing.length > 0 && (
            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '8px' }}>MISSING:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {missing.map(m => (
                  <span key={m} style={{ fontSize: '0.72rem', padding: '4px 10px', borderRadius: '12px', background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.15)', color: '#DC2626', fontWeight: 600 }}>{m}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── PROMOTION PROFILE (New) ─────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,181,253,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Globe size={15} />
          </div>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Public Info</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>Promotion Profile</h3>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: '20px' }}>
          {personalField('Display Name', 'displayName', 'Public name')}
          {textAreaField('Short Bio', 'shortBio', 'I create UI/UX tutorials and review developer tools.', 300)}
          {selectField('Country', 'country', [
            'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan',
            'Bahamas', 'Bahrain', 'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi',
            'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czechia',
            'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France',
            'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
            'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania', 'Luxembourg',
            'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar',
            'Namibia', 'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
            'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent', 'Samoa', 'San Marino', 'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria',
            'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago', 'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
          ])}
          {personalField('YouTube', 'youtube', 'Channel URL')}
          {personalField('Instagram', 'instagram', '@username')}
          {personalField('LinkedIn', 'linkedin', 'Profile URL')}
        </div>
      </div>

      {/* ── PROMOTION DETAILS (New) ─────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,181,253,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Target size={15} />
          </div>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Strategy</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>Promotion Details</h3>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '20px' }}>
          {multiSelectField('Preferred Product Categories', 'preferredCategories', ['UI Kits', 'Templates', 'AI Tools', 'Courses', 'Plugins', 'Icons', 'Fonts', 'E-books', 'SaaS', 'Design Assets', 'Other'])}
          {multiSelectField('Promotion Methods', 'promotionMethods', ['YouTube Videos', 'Instagram Reels', 'Blog Articles', 'Email Marketing', 'Telegram Channel', 'Discord Community', 'SEO Website', 'Paid Ads', 'Other'])}
        </div>
      </div>

      {/* ── AUDIENCE INFORMATION (New) ─────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,181,253,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Users size={15} />
          </div>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Demographics</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>Audience Information</h3>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: '20px' }}>
          {selectField('Primary Audience', 'primaryAudience', ['Designers', 'Developers', 'Students', 'Businesses', 'Content Creators', 'Agencies', 'Entrepreneurs'])}
          {selectField('Audience Size', 'audienceSize', ['Under 1K', '1K – 10K', '10K – 50K', '50K – 100K', '100K+'])}
          {selectField('Preferred Language', 'preferredLanguage', ['English', 'Spanish', 'French', 'Hindi', 'German', 'Other'])}
        </div>
      </div>

      {/* ── PREFERENCES (New) ─────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,181,253,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Settings size={15} />
          </div>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Account Settings</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>Preferences</h3>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: '20px' }}>
          {selectField('Preferred Currency', 'preferredCurrency', ['USD', 'EUR', 'GBP', 'INR', 'AUD'])}
          {selectField('Timezone', 'timezone', ['UTC', 'America/New_York', 'Europe/London', 'Asia/Kolkata', 'Australia/Sydney'])}
          {toggleField('Email Notifications', 'emailNotifications')}
        </div>
      </div>

      {/* ── PERSONAL INFORMATION (editable) ─────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,181,253,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <User size={15} />
          </div>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Account Info</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>Personal Information</h3>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: '20px' }}>
          {personalField('Full Name', 'fullName', 'Your Full Name')}
          {readField('Email Address', displayEmail)}
          {personalField('Phone Number', 'phone', 'Your Phone Number')}
        </div>
      </div>

      {/* ── AFFILIATE INFORMATION ─────────────────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,181,253,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Link2 size={15} />
          </div>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Your Program</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>Affiliate Information</h3>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: '20px' }}>

          {/* Referral Code */}
          <div>
            <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>Referral Code</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ flex: 1, fontSize: '0.9rem', fontWeight: 700, color: '#7B3FA0', padding: '11px 16px', borderRadius: '12px', background: 'rgba(123,63,160,0.04)', border: '1px solid rgba(196,181,253,0.28)', letterSpacing: '0.08em' }}>
                {REFERRAL_CODE}
              </div>
              <button
                onClick={copyCode}
                disabled={REFERRAL_CODE === '—'}
                style={{ padding: '11px 14px', borderRadius: '12px', border: copiedCode ? '1.5px solid rgba(34,197,94,0.40)' : '1px solid rgba(45,0,96,0.10)', background: copiedCode ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.90)', color: copiedCode ? '#16a34a' : 'var(--text-secondary)', cursor: REFERRAL_CODE === '—' ? 'not-allowed' : 'pointer', outline: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' }}
              >
                {copiedCode ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Referral Link — full width */}
          <div style={{ gridColumn: 'span 2' }} className="aff-span-full">
            <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '7px' }}>Referral Link</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <div style={{ flex: 1, fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-secondary)', padding: '11px 16px', borderRadius: '12px', background: 'rgba(45,0,96,0.02)', border: '1px solid rgba(45,0,96,0.06)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {REFERRAL_LINK}
              </div>
              <button
                onClick={copyLink}
                style={{ padding: '11px 14px', borderRadius: '12px', border: copiedLink ? '1.5px solid rgba(34,197,94,0.40)' : '1px solid rgba(45,0,96,0.10)', background: copiedLink ? 'rgba(34,197,94,0.06)' : 'rgba(255,255,255,0.90)', color: copiedLink ? '#16a34a' : 'var(--text-secondary)', cursor: 'pointer', outline: 'none', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 600, fontFamily: 'var(--font-sans)', transition: 'all 0.2s', whiteSpace: 'nowrap' }}
              >
                {copiedLink ? <><Check size={13} /> Copied!</> : <><Copy size={13} /> Copy Link</>}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── PAYMENT INFORMATION (editable) ───────────────────────────────── */}
      <div className="premium-flat-card" style={{ padding: '28px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '24px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,181,253,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CreditCard size={15} />
          </div>
          <div>
            <span className="caption-premium" style={{ color: '#7B3FA0' }}>Withdrawal Setup</span>
            <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>Payment Information</h3>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px,1fr))', gap: '20px' }}>
          {payField('UPI ID',         'upiId',         'yourname@upi')}
          {payField('Bank Name',      'bankName',      'Enter bank name')}
          {payField('Account Number', 'accountNumber', 'XXXX XXXX XXXX')}
          {payField('IFSC Code',      'ifscCode',      'BANKXXXXXXX')}
        </div>

        {!editing && (
          <div style={{ marginTop: '20px', padding: '14px 18px', borderRadius: '12px', background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.18)', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <Shield size={14} style={{ color: '#B45309', marginTop: '2px', flexShrink: 0 }} />
            <p style={{ fontSize: '0.72rem', fontWeight: 500, color: '#92400E', lineHeight: 1.5, margin: 0 }}>
              Your payment details are encrypted and stored securely. Only you can view and update this information.
            </p>
          </div>
        )}
      </div>

      {/* ── RECENT PAYOUTS ────────────────────────────────────────────────── */}
      {payouts && payouts.length > 0 && (
        <div className="premium-flat-card" style={{ padding: '28px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(123,63,160,0.07)', border: '1px solid rgba(196,181,253,0.25)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <DollarSign size={15} />
            </div>
            <div>
              <span className="caption-premium" style={{ color: '#7B3FA0' }}>Payout History</span>
              <h3 className="text-editorial" style={{ fontSize: '1.4rem', fontWeight: 400, color: 'var(--text-primary)', lineHeight: 1 }}>Recent Payouts</h3>
            </div>
          </div>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', padding: '8px 16px', borderRadius: '8px', background: 'rgba(45,0,96,0.02)', marginBottom: '4px' }}>
            {['Date', 'Amount', 'Method', 'Status'].map(h => (
              <span key={h} style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</span>
            ))}
          </div>

          {payouts.slice(0, 5).map((p, idx) => {
            const STATUS = {
              pending:   { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.28)',  color: '#B45309', label: 'Pending'   },
              completed: { bg: 'rgba(34,197,94,0.08)',   border: 'rgba(34,197,94,0.28)',   color: '#15803D', label: 'Completed' },
              rejected:  { bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.28)',   color: '#DC2626', label: 'Rejected'  },
            };
            const st = STATUS[p.status] || STATUS.pending;
            return (
              <div
                key={p.id || idx}
                style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px', padding: '13px 16px', borderRadius: '10px', borderTop: idx > 0 ? '1px solid rgba(45,0,96,0.04)' : 'none', transition: 'background 0.2s', alignItems: 'center' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.02)'; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span style={{ fontSize: '0.78rem', fontWeight: 500, color: 'var(--text-light)' }}>{formatDate(p.created_at)}</span>
                <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatINR(p.amount)}</span>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{p.method || 'UPI'}</span>
                <div>
                  <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: '20px', fontSize: '0.65rem', fontWeight: 700, background: st.bg, border: `1px solid ${st.border}`, color: st.color }}>
                    {st.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @media (max-width: 640px) { .aff-span-full { grid-column: span 1 !important; } }
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(-50%) translateY(12px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes skeletonPulse { 0%,100%{opacity:.6} 50%{opacity:1} }
      `}</style>
    </div>
  );
}
