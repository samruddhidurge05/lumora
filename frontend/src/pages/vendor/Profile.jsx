import React, { useState, useEffect } from 'react';
import VendorLayout from './VendorLayout';
import useAuth from '../../hooks/useAuth';
import '../styles/vendor.css';
import { useVendorProfile } from '../../hooks/useVendorData';

function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < bp);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return m;
}

/* ── UPI validation ──────────────────────────────────────────────────────── */
// Known PSP handles approved by NPCI
const UPI_HANDLES = new Set([
  'ybl','ibl','oksbi','okhdfcbank','okaxis','okicici',
  'paytm','apl','axl','upi','ptyes','pthdfc','ptsbi',
  'icici','hdfcbank','sbi','axisbank','kotak','indus',
  'rbl','federal','bob','boi','pnb','citi','hsbc',
  'allahabad','canara','uco','vijaya','dena','syndicate',
  'obc','oriental','united','corporation','central','indian',
  'mahb','idbi','idfc','idfcbank','idfcfirst','equitas',
  'aubank','ujjivan','esaf','utib','jsb','scb','dlb',
  'naviaxis','fbl','timecosmos','kaypay','tapicici',
  'rajgovt','barodampay','abfspay','axisgo','sliceaxis',
  'jupiteraxis','niyoicici','fifederal','waaxis','goaxb',
  'juspay','tpaxis','amazonpay','qubemoney','mahagrambank',
]);

function isValidUpi(v) {
  if (!v || !v.trim()) return true; // optional field
  const s = v.trim();
  // No spaces
  if (/\s/.test(s)) return false;
  // Exactly one @
  const parts = s.split('@');
  if (parts.length !== 2) return false;
  const [local, handle] = parts;
  // Local part: 2-50 chars, alphanumeric . _ -
  if (!local || !/^[\w.\-]{2,50}$/.test(local)) return false;
  // Handle: 2-20 lowercase letters/digits
  if (!handle || !/^[a-z][a-z0-9]{1,19}$/.test(handle)) return false;
  // Handle must be a known PSP
  if (!UPI_HANDLES.has(handle.toLowerCase())) return false;
  return true;
}
const RULES = {
  displayName: (v) => {
    if (!v || !v.trim()) return 'Display name is required.';
    if (v.trim().length < 3) return 'Minimum 3 characters.';
    if (v.trim().length > 50) return 'Maximum 50 characters.';
    if (!/^[\w\s.\-']+$/i.test(v.trim())) return 'Letters, numbers, spaces, hyphens and apostrophes only.';
    return '';
  },
  email: (v) => {
    if (!v || !v.trim()) return 'Email is required.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Enter a valid email address.';
    return '';
  },
  phone: (v) => {
    if (!v || !v.trim()) return 'Phone number is required.';
    if (!/^\d{10}$/.test(v.trim())) return 'Enter a valid 10-digit phone number.';
    return '';
  },
  country: (v) => {
    if (!v || !v.trim()) return 'Please select a country.';
    return '';
  },
  storeName: (v) => {
    if (!v || !v.trim()) return 'Store name is required.';
    if (v.trim().length < 3) return 'Minimum 3 characters.';
    if (v.trim().length > 50) return 'Maximum 50 characters.';
    if (!/^[\w\s\-_]+$/.test(v.trim())) return 'Letters, numbers, spaces, hyphens and underscores only.';
    return '';
  },
  storeUrl: (v) => {
    if (!v || !v.trim()) return ''; // optional
    try { new URL(v.trim()); return ''; } catch { return 'Enter a valid URL (e.g. https://mystore.com).'; }
  },
  storeBio: (v) => {
    if (v && v.trim().length > 500) return 'Maximum 500 characters.';
    if (v && v.trim() === '' && v.length > 0) return 'Bio cannot be only whitespace.';
    return '';
  },
  upiId: (v) => {
    if (!v || !v.trim()) return ''; // optional
    if (!isValidUpi(v)) return 'Enter a valid UPI ID (e.g. rahul@ybl, john.doe@okaxis).';
    return '';
  },
  accountHolderName: (v, data) => {
    if (!isPartialBank(data)) return '';
    if (!v || !v.trim()) return 'Account holder name is required.';
    if (!/^[a-zA-Z\s]+$/.test(v.trim())) return 'Letters and spaces only.';
    return '';
  },
  bankName: (v, data) => {
    if (!isPartialBank(data)) return '';
    if (!v || !v.trim()) return 'Bank name is required.';
    if (/^\d+$/.test(v.trim())) return 'Bank name cannot be numbers only.';
    if (!/^[a-zA-Z\s&().,\-]+$/.test(v.trim())) return 'Only letters, spaces and common punctuation.';
    return '';
  },
  accountNumber: (v, data) => {
    if (!isPartialBank(data)) return '';
    if (!v || !v.trim()) return 'Account number is required.';
    if (!/^\d{9,18}$/.test(v.trim())) return 'Enter 9–18 digit account number.';
    return '';
  },
  ifscCode: (v, data) => {
    if (!isPartialBank(data)) return '';
    if (!v || !v.trim()) return 'IFSC code is required.';
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(v.trim().toUpperCase())) return 'Enter valid IFSC (e.g. SBIN0001234).';
    return '';
  },
};

/* returns true if the user has started filling bank fields */
function isPartialBank(data) {
  return !!(
    (data.accountHolderName && data.accountHolderName.trim()) ||
    (data.bankName && data.bankName.trim()) ||
    (data.accountNumber && data.accountNumber.trim()) ||
    (data.ifscCode && data.ifscCode.trim())
  );
}

function validate(data) {
  const errs = {};
  for (const [field, rule] of Object.entries(RULES)) {
    const msg = rule(data[field], data);
    if (msg) errs[field] = msg;
  }
  return errs;
}

/* ── Country list ────────────────────────────────────────────────────────── */
const COUNTRIES = [
  'Afghanistan','Albania','Algeria','Argentina','Armenia','Australia','Austria',
  'Azerbaijan','Bahrain','Bangladesh','Belgium','Bolivia','Brazil','Bulgaria',
  'Cambodia','Canada','Chile','China','Colombia','Croatia','Czech Republic',
  'Denmark','Egypt','Ethiopia','Finland','France','Georgia','Germany','Ghana',
  'Greece','Guatemala','Hungary','India','Indonesia','Iran','Iraq','Ireland',
  'Israel','Italy','Japan','Jordan','Kazakhstan','Kenya','Kuwait','Lebanon',
  'Malaysia','Mexico','Morocco','Myanmar','Nepal','Netherlands','New Zealand',
  'Nigeria','Norway','Oman','Pakistan','Peru','Philippines','Poland','Portugal',
  'Qatar','Romania','Russia','Saudi Arabia','Senegal','Serbia','Singapore',
  'South Africa','South Korea','Spain','Sri Lanka','Sweden','Switzerland',
  'Taiwan','Tanzania','Thailand','Turkey','UAE','Uganda','Ukraine',
  'United Kingdom','United States','Uzbekistan','Vietnam','Zimbabwe',
];

/* ── Inline error component ─────────────────────────────────────────────── */
function FieldError({ msg }) {
  if (!msg) return null;
  return (
    <div style={{ fontSize: 11.5, color: '#dc2626', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
      <span>⚠</span> {msg}
    </div>
  );
}

/* ── Input with error highlight ─────────────────────────────────────────── */
function VInput({ name, value, onChange, errors, touched, ...rest }) {
  const hasErr = !!(touched[name] && errors[name]);
  return (
    <>
      <input
        name={name}
        value={value}
        onChange={onChange}
        className="v-input"
        style={hasErr ? { borderColor: '#dc2626', background: 'rgba(239,68,68,0.04)' } : {}}
        {...rest}
      />
      {hasErr && <FieldError msg={errors[name]} />}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { profile: backendProfile, loading: profileLoading, save: saveToBackend, saving } = useVendorProfile();
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState('');
  const isMobile = useIsMobile();

  const EMPTY = {
    displayName: '', email: '', phone: '', storeName: '',
    storeBio: '', storeUrl: '', country: '', role: 'vendor',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    upiId: '', accountHolderName: '', bankName: '', accountNumber: '', ifscCode: '',
  };

  const [formData, setFormData] = useState(EMPTY);
  const [errors,  setErrors]  = useState({});
  const [touched, setTouched] = useState({});

  /* populate from backend */
  useEffect(() => {
    if (backendProfile) {
      setFormData(prev => ({
        ...prev,
        displayName: user?.displayName || user?.email?.split('@')[0] || '',
        email:       user?.email || '',
        phone:       backendProfile.phone   || '',
        storeName:   backendProfile.name    || '',
        storeBio:    backendProfile.bio     || backendProfile.storeBio || '',
        storeUrl:    backendProfile.storeUrl || '',
        country:     backendProfile.country || '',
        role:        user?.role || 'vendor',
        avatar:      backendProfile.avatar  || user?.avatar || prev.avatar,
        upiId:             backendProfile.upiId             || '',
        accountHolderName: backendProfile.accountHolderName || '',
        bankName:          backendProfile.bankName          || '',
        accountNumber:     backendProfile.accountNumber     || '',
        ifscCode:          backendProfile.ifscCode          || '',
      }));
    } else if (!profileLoading && user) {
      setFormData(prev => ({
        ...prev,
        displayName: user.displayName || '',
        email:       user.email       || '',
        phone:       user.phone       || '',
        country:     user.country     || '',
        role:        user.role        || 'vendor',
        avatar:      user.avatar      || prev.avatar,
      }));
    }
  }, [backendProfile, profileLoading, user?.uid]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    const next = { ...formData, [name]: value };
    setFormData(next);
    setTouched(t => ({ ...t, [name]: true }));
    // live-validate touched fields
    const rule = RULES[name];
    if (rule) setErrors(errs => ({ ...errs, [name]: rule(value, next) }));
  };

  const touchAll = () => {
    const allTouched = Object.keys(RULES).reduce((acc, k) => ({ ...acc, [k]: true }), {});
    setTouched(allTouched);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaveError('');
    touchAll();
    const errs = validate(formData);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    // trim all string fields before saving
    const trimmed = Object.fromEntries(
      Object.entries(formData).map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
    );

    try {
      if (trimmed.displayName && trimmed.displayName !== user?.displayName) {
        updateProfile({ displayName: trimmed.displayName, avatar: trimmed.avatar });
      }
      await saveToBackend({
        displayName:       trimmed.displayName,
        email:             trimmed.email,
        phone:             trimmed.phone,
        storeName:         trimmed.storeName,
        storeBio:          trimmed.storeBio,
        storeUrl:          trimmed.storeUrl,
        country:           trimmed.country,
        avatar:            trimmed.avatar,
        upiId:             trimmed.upiId             || null,
        accountHolderName: trimmed.accountHolderName || null,
        bankName:          trimmed.bankName          || null,
        accountNumber:     trimmed.accountNumber     || null,
        ifscCode:          trimmed.ifscCode ? trimmed.ifscCode.toUpperCase() : null,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err.message || 'Failed to save profile.');
    }
  };

  const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
  ];

  const hasUpi  = isValidUpi(formData.upiId);
  const hasBank = !!(
    formData.accountHolderName?.trim() &&
    formData.bankName?.trim() &&
    formData.accountNumber?.trim() &&
    formData.ifscCode?.trim()
  );
  const paymentComplete = hasUpi || hasBank;
  const hasErrors = Object.keys(errors).some(k => !!errors[k]);

  return (
    <VendorLayout activePage="profile" title="My Profile" subtitle="Manage your personal vendor details and contact information">

      {saved && (
        <div style={{ padding:'12px 16px', borderRadius:12, marginBottom:20,
          background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.22)',
          color:'#16a34a', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
          ✓ Profile settings saved successfully
        </div>
      )}
      {saveError && (
        <div style={{ padding:'12px 16px', borderRadius:12, marginBottom:20,
          background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.22)',
          color:'#dc2626', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
          ⚠ {saveError}
        </div>
      )}

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap:24 }}>

        {/* ── Left sidebar ── */}
        <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
          <div className="v-card v-card-pad" style={{ display:'flex', flexDirection:'column', alignItems:'center', textAlign:'center' }}>
            <div style={{ position:'relative', width:90, height:90, borderRadius:'50%', overflow:'hidden', border:'3px solid rgba(168,85,247,0.2)', marginBottom:12 }}>
              <img src={formData.avatar} alt="Profile Avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            </div>
            <div style={{ fontWeight:600, fontSize:16, color:'var(--v-dark)' }}>{formData.displayName || 'Vendor Name'}</div>
            <div style={{ fontSize:12, color:'var(--v-text3)', marginTop:2 }}>{formData.email || 'vendor@email.com'}</div>
            <div className="v-badge v-badge-purple" style={{ marginTop:12 }}>🏅 {user?.level || 'Creator'}</div>
            <div className="v-divider" style={{ width:'100%', margin:'16px 0' }} />
            <div style={{ textAlign:'left', width:'100%' }}>
              <div style={{ fontSize:11, fontWeight:600, color:'var(--v-text3)', textTransform:'uppercase', marginBottom:8 }}>Preset Avatars</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {PRESET_AVATARS.map((url, i) => (
                  <button key={i} onClick={() => setFormData(p => ({ ...p, avatar: url }))}
                    style={{ width:32, height:32, borderRadius:'50%', overflow:'hidden',
                      border: formData.avatar === url ? '2px solid var(--v-purple)' : '1px solid rgba(0,0,0,0.1)',
                      cursor:'pointer', padding:0, opacity: formData.avatar === url ? 1 : 0.75 }}>
                    <img src={url} alt="Preset Avatar" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="v-card v-card-pad" style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div className="v-section-title" style={{ marginBottom:4 }}>Console Status</div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--v-text3)' }}>Role:</span>
              <span style={{ fontWeight:500, color:'var(--v-purple)' }}>{formData.role}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--v-text3)' }}>Joined:</span>
              <span style={{ color:'var(--v-dark)' }}>{user?.joined || 'June 2026'}</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--v-text3)' }}>Status:</span>
              <span className="v-badge v-badge-green" style={{ padding:'1px 6px', fontSize:10 }}>Active</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:13 }}>
              <span style={{ color:'var(--v-text3)' }}>Payment:</span>
              <span className={`v-badge ${paymentComplete ? 'v-badge-green' : 'v-badge-amber'}`} style={{ padding:'1px 6px', fontSize:10 }}>
                {paymentComplete ? 'Set ✓' : 'Required'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Main form ── */}
        <div className="v-card v-card-pad">
          <form onSubmit={handleSave} noValidate>

            {/* ── Personal Information ── */}
            <div className="v-section-title" style={{ marginBottom:20 }}>Personal & Profile Information</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }} className="v-form-row">
              <div className="v-field">
                <label className="v-label">Display Name *</label>
                <VInput name="displayName" value={formData.displayName} onChange={handleChange}
                  errors={errors} touched={touched} placeholder="e.g. John Doe" maxLength={50} />
              </div>
              <div className="v-field">
                <label className="v-label">Email Address *</label>
                <input type="email" name="email" className="v-input" value={formData.email}
                  readOnly style={{ background:'rgba(245,245,245,0.8)', cursor:'not-allowed', opacity:0.7 }}
                  title="Email is managed by your authentication provider." />
                <div style={{ fontSize:11, color:'var(--v-text3)', marginTop:3 }}>Managed by your login provider</div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }} className="v-form-row">
              <div className="v-field">
                <label className="v-label">Phone Number *</label>
                <VInput name="phone" value={formData.phone} onChange={handleChange}
                  errors={errors} touched={touched} placeholder="10-digit number" maxLength={10}
                  inputMode="numeric" pattern="\d*" />
              </div>
              <div className="v-field">
                <label className="v-label">Country / Region *</label>
                <select name="country" value={formData.country} onChange={handleChange}
                  className="v-select"
                  style={touched.country && errors.country ? { borderColor:'#dc2626', background:'rgba(239,68,68,0.04)' } : {}}>
                  <option value="">Select country…</option>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {touched.country && errors.country && <FieldError msg={errors.country} />}
              </div>
            </div>

            <div className="v-divider" />

            {/* ── Store Information ── */}
            <div className="v-section-title" style={{ marginBottom:20 }}>Store Profile Information</div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }} className="v-form-row">
              <div className="v-field">
                <label className="v-label">Store / Handle Name *</label>
                <VInput name="storeName" value={formData.storeName} onChange={handleChange}
                  errors={errors} touched={touched} placeholder="e.g. my-awesome-store" maxLength={50} />
              </div>
              <div className="v-field">
                <label className="v-label">Store Domain / URL</label>
                <VInput name="storeUrl" value={formData.storeUrl} onChange={handleChange}
                  errors={errors} touched={touched} placeholder="https://mystore.com" />
              </div>
            </div>

            <div className="v-field">
              <label className="v-label">Store Bio / Description</label>
              <textarea name="storeBio" className="v-textarea" rows={3}
                value={formData.storeBio} onChange={handleChange} maxLength={520}
                style={touched.storeBio && errors.storeBio ? { borderColor:'#dc2626', background:'rgba(239,68,68,0.04)' } : {}} />
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:3 }}>
                {touched.storeBio && errors.storeBio
                  ? <FieldError msg={errors.storeBio} />
                  : <span />}
                <span style={{ fontSize:10.5, color: formData.storeBio.length > 480 ? '#d97706' : 'var(--v-text3)' }}>
                  {formData.storeBio.length}/500
                </span>
              </div>
            </div>

            <div className="v-divider" />

            {/* ── Payment Information ── */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
              <div className="v-section-title" style={{ marginBottom:0 }}>Payment Information</div>
              {paymentComplete
                ? <span className="v-badge v-badge-green" style={{ fontSize:10 }}>✓ Complete</span>
                : <span className="v-badge v-badge-amber" style={{ fontSize:10 }}>Required for product creation</span>}
            </div>
            <div style={{ fontSize:12.5, color:'var(--v-text3)', marginBottom:20 }}>
              Provide either a UPI ID or complete bank details. One is sufficient.
            </div>

            {/* UPI */}
            <div style={{ padding:'16px 18px', borderRadius:14, marginBottom:14,
              background: hasUpi ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.60)',
              border:`1px solid ${hasUpi ? 'rgba(34,197,94,0.22)' : 'rgba(196,148,230,0.22)'}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--v-text3)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:10 }}>
                Option 1 — UPI
              </div>
              <div className="v-field" style={{ marginBottom:0 }}>
                <label className="v-label">UPI ID</label>
                <VInput name="upiId" value={formData.upiId} onChange={handleChange}
                  errors={errors} touched={touched} placeholder="yourname@bank" />
              </div>
            </div>

            {/* OR divider */}
            <div style={{ display:'flex', alignItems:'center', gap:10, margin:'4px 0 14px' }}>
              <div style={{ flex:1, height:1, background:'rgba(196,148,230,0.18)' }} />
              <span style={{ fontSize:11, fontWeight:700, color:'var(--v-text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>or</span>
              <div style={{ flex:1, height:1, background:'rgba(196,148,230,0.18)' }} />
            </div>

            {/* Bank */}
            <div style={{ padding:'16px 18px', borderRadius:14, marginBottom:20,
              background: hasBank ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.60)',
              border:`1px solid ${hasBank ? 'rgba(34,197,94,0.22)' : 'rgba(196,148,230,0.22)'}` }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--v-text3)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:10 }}>
                Option 2 — Bank Account
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }} className="v-form-row">
                <div className="v-field">
                  <label className="v-label">Account Holder Name</label>
                  <VInput name="accountHolderName" value={formData.accountHolderName} onChange={handleChange}
                    errors={errors} touched={touched} placeholder="Full name on account" />
                </div>
                <div className="v-field">
                  <label className="v-label">Bank Name</label>
                  <VInput name="bankName" value={formData.bankName} onChange={handleChange}
                    errors={errors} touched={touched} placeholder="e.g. State Bank of India" />
                </div>
                <div className="v-field">
                  <label className="v-label">Account Number</label>
                  <VInput name="accountNumber" value={formData.accountNumber} onChange={handleChange}
                    errors={errors} touched={touched} placeholder="9–18 digit number"
                    inputMode="numeric" pattern="\d*" maxLength={18} />
                </div>
                <div className="v-field">
                  <label className="v-label">IFSC Code</label>
                  <VInput name="ifscCode" value={formData.ifscCode} onChange={handleChange}
                    errors={errors} touched={touched} placeholder="e.g. SBIN0001234"
                    style={{ textTransform:'uppercase' }} maxLength={11} />
                </div>
              </div>
            </div>

            {hasErrors && Object.values(touched).some(Boolean) && (
              <div style={{ padding:'10px 14px', borderRadius:10, marginBottom:16,
                background:'rgba(239,68,68,0.07)', border:'1px solid rgba(239,68,68,0.20)',
                color:'#dc2626', fontSize:12.5, display:'flex', alignItems:'center', gap:6 }}>
                ⚠ Please fix the errors above before saving.
              </div>
            )}

            <button type="submit" className="v-btn v-btn-primary" style={{ marginTop:8, width: isMobile ? '100%' : 'auto' }}
              disabled={saving || (hasErrors && Object.values(touched).some(Boolean))}>
              {saving ? 'Saving…' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      </div>
    </VendorLayout>
  );
}
