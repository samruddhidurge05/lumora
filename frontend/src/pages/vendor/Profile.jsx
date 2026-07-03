import React, { useState } from 'react';
import VendorLayout from './VendorLayout';
import useAuth from '../../hooks/useAuth';
import '../styles/vendor.css';
import { useVendorProfile } from '../../hooks/useVendorData';

export default function Profile() {
  const { user, updateProfile } = useAuth();
  const { save: saveToFirestore, saving } = useVendorProfile(user);
  const [saved, setSaved] = useState(false);
  const [activeTab, setActiveTab] = useState('profile');

  const [formData, setFormData] = useState({
    displayName: user?.displayName || '',
    email:       user?.email       || '',
    phone:       user?.phone       || '',
    storeName:   user?.storeName   || '',
    storeBio:    user?.storeBio    || '',
    storeUrl:    user?.storeUrl    || '',
    website:     user?.website     || '',
    country:     user?.country     || '',
    github:      user?.github      || '',
    twitter:     user?.twitter     || '',
    role:        user?.role        || 'vendor',
    avatar:      user?.avatar      || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    updateProfile(formData);
    await saveToFirestore(formData);
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
          </div>
        </div>

        <div className="v-card v-card-pad">
          <form onSubmit={handleSave}>
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

            <button type="submit" className="v-btn v-btn-primary" style={{ marginTop: 8 }}>
              Save Profile Changes
            </button>
          </form>
        </div>
      </div>
    </VendorLayout>
  );
}
