import React, { useState, useEffect } from 'react';
import VendorLayout from './VendorLayout';
import useAuth from '../../hooks/useAuth';
import '../styles/vendor.css';
import { useVendorProfile } from '../../hooks/useVendorData';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { profile: backendProfile, loading: profileLoading, save: saveToBackend, saving } = useVendorProfile();
  const [saved, setSaved] = useState(false);

  const [formData, setFormData] = useState({
    displayName: '',
    email:       '',
    phone:       '',
    storeName:   '',
    storeBio:    '',
    storeUrl:    '',
    website:     '',
    country:     '',
    github:      '',
    twitter:     '',
    role:        'vendor',
    avatar:      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    // Payment information
    upiId:             '',
    accountHolderName: '',
    bankName:          '',
    accountNumber:     '',
    ifscCode:          '',
  });

  // Populate form: prefer backend profile (persistent), fall back to user context
  useEffect(() => {
    if (backendProfile) {
      setFormData(prev => ({
        ...prev,
        // Display Name comes from Firebase user — NEVER from backend store profile
        displayName: user?.displayName || user?.email?.split('@')[0] || '',
        email:       user?.email                || '',
        phone:       user?.phone                || '',
        // Store Name comes exclusively from the backend vendor profile
        storeName:   backendProfile.name        || '',
        storeBio:    backendProfile.bio         || backendProfile.storeBio || '',
        storeUrl:    backendProfile.storeUrl    || '',
        website:     backendProfile.website     || '',
        country:     user?.country              || '',
        github:      user?.github               || '',
        twitter:     backendProfile.twitter     || '',
        role:        user?.role                 || 'vendor',
        avatar:      backendProfile.avatar      || user?.avatar      || prev.avatar,
        // Payment fields from backend
        upiId:             backendProfile.upiId             || '',
        accountHolderName: backendProfile.accountHolderName || '',
        bankName:          backendProfile.bankName          || '',
        accountNumber:     backendProfile.accountNumber     || '',
        ifscCode:          backendProfile.ifscCode          || '',
      }));
    } else if (!profileLoading && user) {
      // Backend not available — populate from auth context only
      setFormData(prev => ({
        ...prev,
        displayName: user.displayName || '',
        email:       user.email       || '',
        phone:       user.phone       || '',
        storeName:   '',
        storeBio:    '',
        storeUrl:    '',
        website:     '',
        country:     user.country     || '',
        github:      user.github      || '',
        twitter:     '',
        role:        user.role        || 'vendor',
        avatar:      user.avatar      || prev.avatar,
      }));
    }
  }, [backendProfile, profileLoading, user?.uid]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    // Only update Firebase display name if user explicitly changed it
    // (never push storeName into Firebase profile)
    if (formData.displayName && formData.displayName !== user?.displayName) {
      updateProfile({ displayName: formData.displayName, avatar: formData.avatar });
    }
    // Persist store fields + payment fields through the backend API
    // displayName is intentionally excluded so Store Name never overwrites user identity
    await saveToBackend({
      displayName: formData.displayName,
      email:       formData.email,
      phone:       formData.phone,
      storeName:   formData.storeName,
      storeBio:    formData.storeBio,
      storeUrl:    formData.storeUrl,
      website:     formData.website,
      country:     formData.country,
      github:      formData.github,
      twitter:     formData.twitter,
      avatar:      formData.avatar,
      upiId:             formData.upiId,
      accountHolderName: formData.accountHolderName,
      bankName:          formData.bankName,
      accountNumber:     formData.accountNumber,
      ifscCode:          formData.ifscCode,
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const PRESET_AVATARS = [
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
    'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
  ];

  // Derive payment completeness for inline status badge
  const hasUpi  = !!(formData.upiId.trim());
  const hasBank = !!(
    formData.accountHolderName.trim() &&
    formData.bankName.trim() &&
    formData.accountNumber.trim() &&
    formData.ifscCode.trim()
  );
  const paymentComplete = hasUpi || hasBank;

  return (
    <VendorLayout activePage="profile" title="My Profile" subtitle="Manage your personal vendor details and contact information">
      {saved && (
        <div style={{
          padding: '12px 16px', borderRadius: 12, marginBottom: 20,
          background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.22)',
          color: '#16a34a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8
        }}>
          ✓ Profile settings saved successfully
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 24 }}>
        {/* ── Left sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="v-card v-card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ position: 'relative', width: 90, height: 90, borderRadius: '50%', overflow: 'hidden', border: '3px solid rgba(168,85,247,0.2)', marginBottom: 12 }}>
              <img src={formData.avatar} alt="Profile Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--v-dark)' }}>{formData.displayName || 'Vendor Name'}</div>
            <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 2 }}>{formData.email || 'vendor@email.com'}</div>

            <div className="v-badge v-badge-purple" style={{ marginTop: 12 }}>
              🏅 {user?.level || 'Creator'}
            </div>

            <div className="v-divider" style={{ width: '100%', margin: '16px 0' }} />

            <div style={{ textAlign: 'left', width: '100%' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--v-text3)', textTransform: 'uppercase', marginBottom: 8 }}>Preset Avatars</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PRESET_AVATARS.map((url, i) => (
                  <button key={i} onClick={() => setFormData(prev => ({ ...prev, avatar: url }))}
                    style={{
                      width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
                      border: formData.avatar === url ? '2px solid var(--v-purple)' : '1px solid rgba(0,0,0,0.1)',
                      cursor: 'pointer', padding: 0, opacity: formData.avatar === url ? 1 : 0.75
                    }}>
                    <img src={url} alt="Preset Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="v-card v-card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div className="v-section-title" style={{ marginBottom: 4 }}>Console Status</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--v-text3)' }}>Role:</span>
              <span style={{ fontWeight: 500, color: 'var(--v-purple)' }}>{formData.role}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--v-text3)' }}>Joined:</span>
              <span style={{ color: 'var(--v-dark)' }}>{user?.joined || 'June 2026'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--v-text3)' }}>Status:</span>
              <span className="v-badge v-badge-green" style={{ padding: '1px 6px', fontSize: 10 }}>Active</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--v-text3)' }}>Payment:</span>
              <span className={`v-badge ${paymentComplete ? 'v-badge-green' : 'v-badge-amber'}`} style={{ padding: '1px 6px', fontSize: 10 }}>
                {paymentComplete ? 'Set ✓' : 'Required'}
              </span>
            </div>
          </div>
        </div>

        {/* ── Main form ── */}
        <div className="v-card v-card-pad">
          <form onSubmit={handleSave}>

            {/* Personal Information */}
            <div className="v-section-title" style={{ marginBottom: 20 }}>Personal & Profile Information</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="v-field">
                <label className="v-label">Display Name</label>
                <input type="text" name="displayName" className="v-input" value={formData.displayName} onChange={handleChange} required />
              </div>
              <div className="v-field">
                <label className="v-label">Email Address</label>
                <input type="email" name="email" className="v-input" value={formData.email} onChange={handleChange} required />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="v-field">
                <label className="v-label">Phone Number</label>
                <input type="text" name="phone" className="v-input" value={formData.phone} onChange={handleChange} />
              </div>
              <div className="v-field">
                <label className="v-label">Country / Region</label>
                <input type="text" name="country" className="v-input" value={formData.country} onChange={handleChange} />
              </div>
            </div>

            <div className="v-divider" />

            {/* Store Information */}
            <div className="v-section-title" style={{ marginBottom: 20 }}>Store Profile Information</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="v-field">
                <label className="v-label">Store / Handle Name</label>
                <input type="text" name="storeName" className="v-input" value={formData.storeName} onChange={handleChange} />
              </div>
              <div className="v-field">
                <label className="v-label">Store Domain / URL</label>
                <input type="text" name="storeUrl" className="v-input" value={formData.storeUrl} onChange={handleChange} />
              </div>
            </div>

            <div className="v-field">
              <label className="v-label">Store Bio / Description</label>
              <textarea name="storeBio" className="v-textarea" rows={3} value={formData.storeBio} onChange={handleChange} />
            </div>

            <div className="v-divider" />

            {/* Social Profiles */}
            <div className="v-section-title" style={{ marginBottom: 20 }}>Social Profiles & Web Presence</div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="v-field">
                <label className="v-label">Personal / Business Website</label>
                <input type="text" name="website" className="v-input" value={formData.website} onChange={handleChange} placeholder="https://example.com" />
              </div>
              <div className="v-field">
                <label className="v-label">Avatar URL (Custom)</label>
                <input type="text" name="avatar" className="v-input" value={formData.avatar} onChange={handleChange} placeholder="https://..." />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="v-field">
                <label className="v-label">GitHub Handle</label>
                <input type="text" name="github" className="v-input" value={formData.github} onChange={handleChange} placeholder="github.com/handle" />
              </div>
              <div className="v-field">
                <label className="v-label">Twitter Handle</label>
                <input type="text" name="twitter" className="v-input" value={formData.twitter} onChange={handleChange} placeholder="twitter.com/handle" />
              </div>
            </div>

            <div className="v-divider" />

            {/* ── Payment Information ─────────────────────────────────────── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div className="v-section-title" style={{ marginBottom: 0 }}>Payment Information</div>
              {paymentComplete
                ? <span className="v-badge v-badge-green" style={{ fontSize: 10 }}>✓ Complete</span>
                : <span className="v-badge v-badge-amber" style={{ fontSize: 10 }}>Required for product creation</span>
              }
            </div>
            <div style={{ fontSize: 12.5, color: 'var(--v-text3)', marginBottom: 20 }}>
              Provide either a UPI ID or complete bank details. One is sufficient.
            </div>

            {/* UPI option */}
            <div style={{
              padding: '16px 18px', borderRadius: 14, marginBottom: 14,
              background: hasUpi ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.60)',
              border: `1px solid ${hasUpi ? 'rgba(34,197,94,0.22)' : 'rgba(196,148,230,0.22)'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--v-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                Option 1 — UPI
              </div>
              <div className="v-field" style={{ marginBottom: 0 }}>
                <label className="v-label">UPI ID</label>
                <input
                  type="text"
                  name="upiId"
                  className="v-input"
                  value={formData.upiId}
                  onChange={handleChange}
                  placeholder="yourname@upi"
                />
              </div>
            </div>

            {/* Divider between options */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 14px' }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(196,148,230,0.18)' }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--v-text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>or</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(196,148,230,0.18)' }} />
            </div>

            {/* Bank option */}
            <div style={{
              padding: '16px 18px', borderRadius: 14, marginBottom: 20,
              background: hasBank ? 'rgba(34,197,94,0.05)' : 'rgba(255,255,255,0.60)',
              border: `1px solid ${hasBank ? 'rgba(34,197,94,0.22)' : 'rgba(196,148,230,0.22)'}`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--v-text3)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>
                Option 2 — Bank Account
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div className="v-field">
                  <label className="v-label">Account Holder Name</label>
                  <input type="text" name="accountHolderName" className="v-input" value={formData.accountHolderName} onChange={handleChange} placeholder="Full name on account" />
                </div>
                <div className="v-field">
                  <label className="v-label">Bank Name</label>
                  <input type="text" name="bankName" className="v-input" value={formData.bankName} onChange={handleChange} placeholder="e.g. State Bank of India" />
                </div>
                <div className="v-field">
                  <label className="v-label">Account Number</label>
                  <input type="text" name="accountNumber" className="v-input" value={formData.accountNumber} onChange={handleChange} placeholder="XXXX XXXX XXXX" />
                </div>
                <div className="v-field">
                  <label className="v-label">IFSC Code</label>
                  <input type="text" name="ifscCode" className="v-input" value={formData.ifscCode} onChange={handleChange} placeholder="e.g. SBIN0001234" />
                </div>
              </div>
            </div>

            <button type="submit" className="v-btn v-btn-primary" style={{ marginTop: 8 }} disabled={saving}>
              {saving ? 'Saving…' : 'Save Profile Changes'}
            </button>
          </form>
        </div>
      </div>
    </VendorLayout>
  );
}
