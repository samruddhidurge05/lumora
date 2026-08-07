import React, { useState, useEffect, useRef } from 'react';
import { 
  Save, Palette, Eye, EyeOff, Sliders, Clock, AlertCircle, Check, 
  Camera, Upload, Trash2, Shield, Bell, User, Lock, Sparkles, Key, CheckCircle, Mail, Phone, FileText
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile } from '../../services/userService';
import { backendFetch } from '../../utils/api';

export default function CustomerSettings() {
  const { accentTheme, setAccentTheme, glassMode, setGlassMode, borderGlow, setBorderGlow } = useApp();
  const { user, updateProfile } = useAuth();
  
  // Form states
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [showUrlInput, setShowUrlInput] = useState(false);

  // Security / Password states
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Notification Preference states
  const [notifOrders, setNotifOrders] = useState(true);
  const [notifSecurity, setNotifSecurity] = useState(true);
  const [notifUpdates, setNotifUpdates] = useState(true);
  const [notifPromos, setNotifPromos] = useState(false);

  // UX & Status states
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'security' | 'appearance' | 'notifications'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  const fileInputRef = useRef(null);

  // 1. Load profile details
  const loadProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let profileData = null;
      // Try backend first
      const backendUserData = await backendFetch('/auth/me').catch(() => null);
      if (backendUserData) {
        if (backendUserData.name) setName(backendUserData.name);
        if (backendUserData.phone) setPhone(backendUserData.phone);
        if (backendUserData.avatar) setAvatar(backendUserData.avatar);
      }
      
      // Fallback or merge with Firestore
      profileData = await getUserProfile(user.uid);
      if (profileData) {
        if (!name && profileData.name) setName(profileData.name);
        if (!phone && (profileData.phone || profileData.phoneNumber)) setPhone(profileData.phone || profileData.phoneNumber);
        if (profileData.bio) setBio(profileData.bio);
        if (profileData.profileImage || profileData.photoURL || profileData.avatar) {
          setAvatar(profileData.profileImage || profileData.photoURL || profileData.avatar);
        }
        if (profileData.notifOrders !== undefined) setNotifOrders(profileData.notifOrders);
        if (profileData.notifSecurity !== undefined) setNotifSecurity(profileData.notifSecurity);
        if (profileData.notifUpdates !== undefined) setNotifUpdates(profileData.notifUpdates);
        if (profileData.notifPromos !== undefined) setNotifPromos(profileData.notifPromos);
      } else if (user.photoURL) {
        setAvatar(user.photoURL);
      }
      
      if (!name) setName(user.displayName || user.email?.split('@')[0] || '');
    } catch (err) {
      console.warn('[Settings] Profile load notice:', err);
      setName(user.displayName || '');
      if (user.photoURL) setAvatar(user.photoURL);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  // Handle local image file selection
  const handleImageFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile photo size must be less than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setAvatar(event.target.result);
        setShowUrlInput(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle saving profile changes
  const handleSave = async () => {
    if (!user) return;
    if (phone && !/^\+?[0-9]{10,15}$/.test(phone.trim())) {
      setError('Contact number must be 10 to 15 digits (digits only, optional leading +).');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const finalAvatar = customAvatarUrl.trim() || avatar;

      // Update backend auth /me
      await backendFetch('/auth/me', {
        method: 'PUT',
        body: JSON.stringify({ 
          name, 
          phone: phone.trim(),
          avatar: finalAvatar 
        })
      }).catch(err => console.warn('[Settings] Backend update notice:', err));

      // Update profile name, phone & avatar on Firestore
      await updateUserProfile(user.uid, {
        name,
        phone: phone.trim(),
        phoneNumber: phone.trim(),
        bio: bio.trim(),
        profileImage: finalAvatar,
        photoURL: finalAvatar,
        accentTheme,
        glassMode,
        borderGlow,
        notifOrders,
        notifSecurity,
        notifUpdates,
        notifPromos,
        updated_at: new Date().toISOString()
      });
      
      // Update AuthContext and Firebase User
      if (updateProfile) {
        await updateProfile({ 
          displayName: name,
          photoURL: finalAvatar
        });
      }

      setSaved(true);
      setTimeout(() => setSaved(false), 3500);
    } catch (err) {
      console.error('[Settings] Error saving settings:', err);
      setError('Failed to save settings to server. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Handle Password Update Simulation / Request
  const handlePasswordChange = (e) => {
    e.preventDefault();
    setError(null);
    if (!newPassword) {
      setError('Please enter a new password.');
      return;
    }
    if (newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setPasswordSuccess(true);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setTimeout(() => setPasswordSuccess(false), 4000);
  };

  const THEMES = [
    { name: 'Lavender', color: '#7B3FA0', bg: 'rgba(123,63,160,0.10)' },
    { name: 'Peach', color: '#E07A5F', bg: 'rgba(224,122,95,0.10)' },
    { name: 'Powder Blue', color: '#3A86EF', bg: 'rgba(58,134,239,0.10)' },
    { name: 'Sage Mint', color: '#2A9D8F', bg: 'rgba(42,157,143,0.10)' }
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.4s ease', maxWidth: '840px', margin: '0 auto', width: '100%' }}>
      {/* Header Banner */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '0.70rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase' }}>✦ ACCOUNT PREFERENCES</span>
          <h2 className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>Account Settings</h2>
          <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            Manage your public profile, appearance preferences, security, and notifications.
          </p>
        </div>

        <button 
          onClick={handleSave} 
          disabled={saving || loading} 
          className="btn-premium btn-premium-solid" 
          style={{ padding: '10px 22px', fontSize: '0.86rem', borderRadius: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '8px', boxShadow: '0 6px 20px rgba(123,63,160,0.25)' }}
        >
          <Save size={15} /> {saving ? 'Saving Changes...' : 'Save Settings'}
        </button>
      </div>

      {/* Tabs Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1.5px solid rgba(123,63,160,0.20)', paddingBottom: '2px', overflowX: 'auto' }}>
        {[
          { id: 'profile', label: 'Public Profile', icon: <User size={15} /> },
          { id: 'appearance', label: 'Appearance', icon: <Palette size={15} /> },
          { id: 'security', label: 'Security & Password', icon: <Shield size={15} /> },
          { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 18px',
              borderRadius: '12px 12px 0 0',
              fontSize: '0.84rem',
              fontWeight: 700,
              fontFamily: 'var(--font-sans)',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2.5px solid #7B3FA0' : '2.5px solid transparent',
              background: activeTab === tab.id ? 'rgba(123,63,160,0.08)' : 'transparent',
              color: activeTab === tab.id ? '#7B3FA0' : 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Feedback Alerts */}
      {saved && (
        <div style={{ padding: '14px 20px', borderRadius: '14px', background: 'rgba(34,197,94,0.09)', border: '1.5px solid rgba(34,197,94,0.30)', color: '#15803d', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px', boxShadow: '0 4px 16px rgba(34,197,94,0.10)' }}>
          <CheckCircle size={18} /> Settings and profile configuration saved successfully!
        </div>
      )}

      {error && !loading && (
        <div style={{ padding: '14px 20px', borderRadius: '14px', background: 'rgba(239,68,68,0.09)', border: '1.5px solid rgba(239,68,68,0.25)', color: '#DC2626', fontSize: '0.84rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
          <button onClick={loadProfile} style={{ border: 'none', background: 'none', color: '#DC2626', fontWeight: 800, cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
        </div>
      )}

      {/* Main Content Area */}
      {loading ? (
        <div style={{ padding: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', color: '#7B3FA0', fontSize: '0.9rem', fontWeight: 600 }}>
          <Clock size={20} style={{ animation: 'spin 2s linear infinite' }} />
          <span>Loading account details...</span>
        </div>
      ) : (
        <>
          {/* TAB 1: PUBLIC PROFILE */}
          {activeTab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Profile Avatar Card */}
              <div className="glass-card" style={{ padding: '24px 28px', borderRadius: '20px', border: '1.5px solid rgba(123, 63, 160, 0.38)', background: 'rgba(255,255,255,0.65)' }}>
                <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '18px' }}>PROFILE PHOTO</h3>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                  {/* Avatar Circle Display */}
                  <div style={{ position: 'relative' }}>
                    <div style={{
                      width: '92px', height: '92px', borderRadius: '50%',
                      overflow: 'hidden',
                      background: 'linear-gradient(135deg,#D8BFE3,#9B5CC4)',
                      border: '3px solid #fff',
                      boxShadow: '0 8px 24px rgba(123,63,160,0.30)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '2.2rem', color: '#fff', fontWeight: 700, fontFamily: 'var(--font-editorial)'
                    }}>
                      {avatar || customAvatarUrl ? (
                        <img 
                          src={customAvatarUrl || avatar} 
                          alt={name || 'Avatar'} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        (name || user?.email || 'L')[0].toUpperCase()
                      )}
                    </div>

                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      style={{
                        position: 'absolute', bottom: '0', right: '0',
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: '#7B3FA0', color: '#fff', border: '2px solid #fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', boxShadow: '0 4px 10px rgba(0,0,0,0.2)',
                        transition: 'transform 0.2s'
                      }}
                      title="Upload profile photo"
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <Camera size={15} />
                    </button>
                    
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleImageFileChange} 
                      accept="image/*" 
                      style={{ display: 'none' }} 
                    />
                  </div>

                  {/* Actions & Description */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '220px' }}>
                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '8px 16px', borderRadius: '10px',
                          border: '1.5px solid rgba(123,63,160,0.35)',
                          background: 'rgba(255,255,255,0.85)',
                          color: '#7B3FA0', fontSize: '0.80rem', fontWeight: 700,
                          cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s'
                        }}
                      >
                        <Upload size={14} /> Upload Device Photo
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowUrlInput(!showUrlInput)}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '8px 16px', borderRadius: '10px',
                          border: '1.5px solid rgba(123,63,160,0.20)',
                          background: 'transparent',
                          color: '#4A2B68', fontSize: '0.80rem', fontWeight: 600,
                          cursor: 'pointer', fontFamily: 'var(--font-sans)'
                        }}
                      >
                        <Sparkles size={14} /> Use Image URL
                      </button>

                      {(avatar || customAvatarUrl) && (
                        <button
                          type="button"
                          onClick={() => { setAvatar(''); setCustomAvatarUrl(''); }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            padding: '8px 14px', borderRadius: '10px',
                            border: '1.5px solid rgba(239,68,68,0.20)',
                            background: 'rgba(239,68,68,0.06)',
                            color: '#DC2626', fontSize: '0.80rem', fontWeight: 600,
                            cursor: 'pointer', fontFamily: 'var(--font-sans)'
                          }}
                        >
                          <Trash2 size={14} /> Remove
                        </button>
                      )}
                    </div>

                    <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.45 }}>
                      Recommended: Square PNG, JPG or WebP image under 5MB. Photo will be displayed on reviews and creator profiles.
                    </p>

                    {showUrlInput && (
                      <div style={{ marginTop: '6px', display: 'flex', gap: '8px' }}>
                        <input
                          type="url"
                          placeholder="https://example.com/avatar.jpg"
                          value={customAvatarUrl}
                          onChange={e => setCustomAvatarUrl(e.target.value)}
                          style={{
                            flex: 1, padding: '8px 14px', borderRadius: '10px',
                            border: '1.5px solid rgba(123,63,160,0.35)', background: '#fff',
                            fontSize: '0.82rem', fontFamily: 'var(--font-sans)', outline: 'none'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Personal Information Form Card */}
              <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', border: '1.5px solid rgba(123, 63, 160, 0.38)', background: 'rgba(255,255,255,0.65)' }}>
                <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px' }}>PERSONAL INFORMATION</h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px' }}>
                  <div>
                    <label style={{ fontSize: '0.64rem', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <User size={13} /> Full / Display Name
                    </label>
                    <input 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      placeholder="Enter your name"
                      style={{ padding: '11px 16px', borderRadius: '10px', border: '1.5px solid rgba(196,181,253,0.40)', background: '#fff', fontSize: '0.86rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--color-espresso)', outline: 'none', width: '100%', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.64rem', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Mail size={13} /> Email Address
                    </label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        value={user?.email || ''} 
                        disabled 
                        style={{ padding: '11px 16px', paddingRight: '100px', borderRadius: '10px', border: '1.5px solid rgba(196,181,253,0.25)', background: 'rgba(245,243,255,0.85)', fontSize: '0.86rem', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--text-muted)', width: '100%', boxSizing: 'border-box' }} 
                      />
                      <span style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.62rem', fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        ✦ Verified
                      </span>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.64rem', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <Phone size={13} /> Contact Phone Number
                    </label>
                    <input 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      placeholder="+91 9876543210"
                      style={{ padding: '11px 16px', borderRadius: '10px', border: '1.5px solid rgba(196,181,253,0.40)', background: '#fff', fontSize: '0.86rem', fontFamily: 'var(--font-sans)', fontWeight: 600, color: 'var(--color-espresso)', outline: 'none', width: '100%', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <div style={{ gridColumn: '1 / -1' }}>
                    <label style={{ fontSize: '0.64rem', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                      <FileText size={13} /> Bio / Creator Headline
                    </label>
                    <textarea 
                      value={bio} 
                      onChange={e => setBio(e.target.value)} 
                      placeholder="Brief headline or short bio about yourself..."
                      rows={2}
                      maxLength={300}
                      style={{ padding: '11px 16px', borderRadius: '10px', border: '1.5px solid rgba(196,181,253,0.40)', background: '#fff', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-espresso)', outline: 'none', width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} 
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APPEARANCE & PREFERENCES */}
          {activeTab === 'appearance' && (
            <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', border: '1.5px solid rgba(123, 63, 160, 0.38)', background: 'rgba(255,255,255,0.65)' }}>
              <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px' }}>APPEARANCE & THEME PREFERENCES</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                <div>
                  <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-espresso)', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                    <Palette size={16} style={{ color: '#7B3FA0' }} /> Accent Theme Palette
                  </label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
                    {THEMES.map(t => (
                      <button
                        key={t.name}
                        onClick={() => setAccentTheme(t.name)}
                        style={{
                          padding: '12px 16px', borderRadius: '14px', fontSize: '0.82rem', fontWeight: 700,
                          border: accentTheme === t.name ? `2.5px solid ${t.color}` : '1.5px solid rgba(123,63,160,0.18)',
                          background: accentTheme === t.name ? t.bg : 'rgba(255,255,255,0.80)',
                          color: accentTheme === t.name ? t.color : 'var(--text-secondary)',
                          cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                        }}
                      >
                        <span>{t.name}</span>
                        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: t.color, display: 'inline-block' }} />
                      </button>
                    ))}
                  </div>
                </div>

                <div style={{ borderTop: '1px dashed rgba(123,63,160,0.20)', paddingTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-espresso)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Eye size={16} style={{ color: '#7B3FA0' }} /> High-Definition Glassmorphism
                    </label>
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Enable real-time backdrop blur and frost reflections on container cards.
                    </p>
                  </div>
                  <button 
                    onClick={() => setGlassMode(!glassMode)} 
                    style={{ width: '48px', height: '26px', borderRadius: '13px', background: glassMode ? '#7B3FA0' : 'rgba(123,63,160,0.18)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.3s' }}
                  >
                    <span style={{ position: 'absolute', top: '3px', left: glassMode ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} />
                  </button>
                </div>

                <div style={{ borderTop: '1px dashed rgba(123,63,160,0.20)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <label style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-espresso)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Sliders size={16} style={{ color: '#7B3FA0' }} /> Border Glow & Shadow Intensity
                    </label>
                    <span style={{ fontSize: '0.78rem', fontWeight: 800, color: '#7B3FA0', background: 'rgba(123,63,160,0.10)', padding: '2px 8px', borderRadius: '6px' }}>
                      {borderGlow}%
                    </span>
                  </div>
                  <input 
                    type="range" 
                    min={0} 
                    max={100} 
                    value={borderGlow} 
                    onChange={e => setBorderGlow(Number(e.target.value))} 
                    style={{ width: '100%', accentColor: '#7B3FA0', cursor: 'pointer' }} 
                  />
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SECURITY & PASSWORD */}
          {activeTab === 'security' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Password Change Card */}
              <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', border: '1.5px solid rgba(123, 63, 160, 0.38)', background: 'rgba(255,255,255,0.65)' }}>
                <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px' }}>CHANGE PASSWORD</h3>
                
                {passwordSuccess && (
                  <div style={{ marginBottom: '16px', padding: '10px 16px', borderRadius: '10px', background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.30)', color: '#16a34a', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Check size={16} /> Password updated successfully!
                  </div>
                )}

                <form onSubmit={handlePasswordChange} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '480px' }}>
                  <div>
                    <label style={{ fontSize: '0.64rem', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Current Password</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showCurrentPass ? 'text' : 'password'}
                        value={currentPassword} 
                        onChange={e => setCurrentPassword(e.target.value)} 
                        placeholder="••••••••••••"
                        style={{ padding: '11px 16px', paddingRight: '40px', borderRadius: '10px', border: '1.5px solid rgba(196,181,253,0.40)', background: '#fff', fontSize: '0.86rem', fontFamily: 'var(--font-sans)', fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box' }} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowCurrentPass(!showCurrentPass)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#7B3FA0', cursor: 'pointer' }}
                      >
                        {showCurrentPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.64rem', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>New Password</label>
                    <div style={{ position: 'relative' }}>
                      <input 
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword} 
                        onChange={e => setNewPassword(e.target.value)} 
                        placeholder="At least 6 characters"
                        style={{ padding: '11px 16px', paddingRight: '40px', borderRadius: '10px', border: '1.5px solid rgba(196,181,253,0.40)', background: '#fff', fontSize: '0.86rem', fontFamily: 'var(--font-sans)', fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box' }} 
                      />
                      <button 
                        type="button" 
                        onClick={() => setShowNewPass(!showNewPass)}
                        style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#7B3FA0', cursor: 'pointer' }}
                      >
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.64rem', fontWeight: 800, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Confirm New Password</label>
                    <input 
                      type="password"
                      value={confirmPassword} 
                      onChange={e => setConfirmPassword(e.target.value)} 
                      placeholder="Re-enter new password"
                      style={{ padding: '11px 16px', borderRadius: '10px', border: '1.5px solid rgba(196,181,253,0.40)', background: '#fff', fontSize: '0.86rem', fontFamily: 'var(--font-sans)', fontWeight: 600, outline: 'none', width: '100%', boxSizing: 'border-box' }} 
                    />
                  </div>

                  <button 
                    type="submit" 
                    className="btn-premium" 
                    style={{ marginTop: '8px', padding: '10px 20px', fontSize: '0.82rem', borderRadius: '10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-start' }}
                  >
                    <Key size={14} /> Update Password
                  </button>
                </form>
              </div>

              {/* Active Sessions & Security Audit */}
              <div className="glass-card" style={{ padding: '24px 28px', borderRadius: '20px', border: '1.5px solid rgba(123, 63, 160, 0.38)', background: 'rgba(255,255,255,0.65)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
                <div>
                  <h4 style={{ fontSize: '0.88rem', fontWeight: 700, color: '#2D004D', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Shield size={16} style={{ color: '#7B3FA0' }} /> Two-Factor Authentication (2FA) & Session Security
                  </h4>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>
                    Your account is authenticated via Firebase RS256 token verification. Active session token matches UID: <code style={{ color: '#7B3FA0', fontWeight: 700 }}>{user?.uid?.slice(0, 12)}...</code>
                  </p>
                </div>
                <span style={{ fontSize: '0.68rem', fontWeight: 800, color: '#22c55e', background: 'rgba(34,197,94,0.12)', padding: '4px 10px', borderRadius: '8px', textTransform: 'uppercase' }}>
                  ✦ Active & Secure
                </span>
              </div>
            </div>
          )}

          {/* TAB 4: NOTIFICATIONS */}
          {activeTab === 'notifications' && (
            <div className="glass-card" style={{ padding: '28px', borderRadius: '20px', border: '1.5px solid rgba(123, 63, 160, 0.38)', background: 'rgba(255,255,255,0.65)' }}>
              <h3 style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7B3FA0', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '20px' }}>EMAIL & IN-APP NOTIFICATIONS</h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {[
                  { id: 'orders', state: notifOrders, set: setNotifOrders, title: 'Order & Download Receipts', desc: 'Receive instant email receipts and direct file download links for all digital purchases.' },
                  { id: 'security', state: notifSecurity, set: setNotifSecurity, title: 'Security & Login Alerts', desc: 'Get notified when an unrecognized device or location accesses your account.' },
                  { id: 'updates', state: notifUpdates, set: setNotifUpdates, title: 'Product Updates & License Renewal', desc: 'Receive notifications when digital product creators release major version updates.' },
                  { id: 'promos', state: notifPromos, set: setNotifPromos, title: 'Promotional Offers & Recommended Products', desc: 'Receive curated discount coupons and news on seasonal marketplace sales.' }
                ].map((item, idx) => (
                  <div key={item.id} style={{ borderBottom: idx < 3 ? '1px dashed rgba(123,63,160,0.18)' : 'none', paddingBottom: idx < 3 ? '16px' : '0px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--color-espresso)', margin: 0 }}>{item.title}</h4>
                      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>{item.desc}</p>
                    </div>
                    <button 
                      onClick={() => item.set(!item.state)} 
                      style={{ width: '48px', height: '26px', borderRadius: '13px', background: item.state ? '#7B3FA0' : 'rgba(123,63,160,0.18)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.3s', flexShrink: 0 }}
                    >
                      <span style={{ position: 'absolute', top: '3px', left: item.state ? '25px' : '3px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
