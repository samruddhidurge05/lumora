import React, { useState, useEffect } from 'react';
import { Save, Palette, Eye, Sliders, Clock, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getUserProfile, updateUserProfile } from '../../services/userService';
import { backendFetch } from '../../utils/api';

export default function CustomerSettings() {
  const { accentTheme, setAccentTheme, glassMode, setGlassMode, borderGlow, setBorderGlow } = useApp();
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(false);

  // 1. Load profile
  const loadProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Try backend first
      const backendUserData = await backendFetch('/auth/me').catch(() => null);
      if (backendUserData && backendUserData.name) {
        setName(backendUserData.name);
      } else {
        // Fallback to Firestore profile or auth user
        const profile = await getUserProfile(user.uid);
        setName(profile?.name || user.displayName || '');
      }
    } catch (err) {
      console.warn('[Settings] Profile load notice:', err);
      setName(user.displayName || '');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, [user]);

  // 2, 3, 4. Update profile, preferences & Save settings
  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError(null);
    try {
      // Update profile name on backend & Firestore
      await updateUserProfile(user.uid, {
        name,
        accentTheme,
        glassMode,
        borderGlow
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('[Settings] Error saving settings:', err);
      setError('Failed to save settings to server.');
    } finally {
      setSaving(false);
    }
  };

  const THEMES = ['Lavender', 'Peach', 'Powder Blue', 'Sage Mint'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', animation: 'fade-in 0.5s ease', maxWidth: '720px' }}>
      <div>
        <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em' }}>ACCOUNT</span>
        <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>Settings</h2>
      </div>

      {/* Handle success message */}
      {saved && (
        <div style={{ padding: '12px 18px', borderRadius: '10px', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)', color: '#16a34a', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Check size={16} /> Settings and preferences saved successfully!
        </div>
      )}

      {/* Handle errors */}
      {error && !loading && (
        <div style={{ padding: '12px 18px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', color: '#DC2626', fontSize: '0.82rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={loadProfile} style={{ border: 'none', background: 'none', color: '#DC2626', fontWeight: 700, cursor: 'pointer' }}>Retry</button>
        </div>
      )}

      {/* Handle loading */}
      {loading ? (
        <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#7B3FA0', fontSize: '0.88rem', fontWeight: 600 }}>
          <Clock size={16} style={{ animation: 'spin 2s linear infinite' }} />
          <span>Loading account configuration...</span>
        </div>
      ) : (
        <>
          {/* Profile */}
          <div className="glass-card" style={{ padding: '28px', borderRadius: '20px' }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em', marginBottom: '20px' }}>PROFILE</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-mocha)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Display Name</label>
                <input 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  placeholder="Your full name"
                  style={{ padding: '11px 16px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.3)', background: '#fff', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--color-espresso)', outline: 'none', width: '100%', boxSizing: 'border-box' }} 
                />
              </div>
              <div>
                <label style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--color-mocha)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Email Registry</label>
                <input 
                  value={user?.email || ''} 
                  disabled 
                  style={{ padding: '11px 16px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.2)', background: 'rgba(245,243,255,0.8)', fontSize: '0.85rem', fontFamily: 'var(--font-sans)', fontWeight: 500, color: 'var(--text-muted)', width: '100%', boxSizing: 'border-box' }} 
                />
              </div>
            </div>
          </div>

          {/* Theme Preferences */}
          <div className="glass-card" style={{ padding: '28px', borderRadius: '20px' }}>
            <h3 style={{ fontSize: '0.7rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em', marginBottom: '20px' }}>APPEARANCE & PREFERENCES</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-espresso)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}><Palette size={14} /> Accent Theme</label>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  {THEMES.map(t => (
                    <button key={t} onClick={() => setAccentTheme(t)} style={{ padding: '8px 16px', borderRadius: '20px', fontSize: '0.78rem', fontWeight: 700, border: accentTheme === t ? '2px solid #7B3FA0' : '1px solid rgba(45,0,96,0.10)', background: accentTheme === t ? 'rgba(123,63,160,0.08)' : 'rgba(255,255,255,0.8)', color: accentTheme === t ? '#7B3FA0' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: 'var(--font-sans)', transition: 'all 0.2s' }}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-espresso)', display: 'flex', alignItems: 'center', gap: '6px' }}><Eye size={14} /> Glassmorphism Mode</label>
                <button onClick={() => setGlassMode(!glassMode)} style={{ width: '44px', height: '24px', borderRadius: '12px', background: glassMode ? '#7B3FA0' : 'rgba(45,0,96,0.12)', border: 'none', cursor: 'pointer', position: 'relative', transition: 'background 0.3s' }}>
                  <span style={{ position: 'absolute', top: '2px', left: glassMode ? '22px' : '2px', width: '20px', height: '20px', borderRadius: '50%', background: '#fff', transition: 'left 0.3s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
                </button>
              </div>
              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--color-espresso)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}><Sliders size={14} /> Border Glow Intensity: {borderGlow}%</label>
                <input type="range" min={0} max={100} value={borderGlow} onChange={e => setBorderGlow(Number(e.target.value))} style={{ width: '100%', accentColor: '#7B3FA0', cursor: 'pointer' }} />
              </div>
            </div>
          </div>

          <button onClick={handleSave} disabled={saving} className="btn-premium btn-premium-solid" style={{ alignSelf: 'flex-start', padding: '12px 28px', fontSize: '0.88rem', borderRadius: '12px', cursor: 'pointer' }}>
            <Save size={15} /> {saving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </>
      )}
    </div>
  );
}
