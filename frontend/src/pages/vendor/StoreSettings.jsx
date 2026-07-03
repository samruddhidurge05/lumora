import React, { useState, useEffect } from 'react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useStoreSettings } from '../../hooks/useVendorData';
import { RefreshCw, AlertCircle } from 'lucide-react';

export default function StoreSettings() {
  const [tab,    setTab]    = useState('branding');

  const [vacation,          setVacation]          = useState(false);
  const [vacationMsg,       setVacationMsg]        = useState('');
  const [announcement,      setAnnouncement]       = useState('');
  const [announcementActive,setAnnouncementActive] = useState(false);

  const [branding, setBranding] = useState({
    storeName:  '',
    tagline:    '',
    bio:        '',
    website:    '',
    twitter:    '',
    instagram:  '',
  });

  const [policies, setPolicies] = useState({
    refundPolicy:  '30-day money-back guarantee on all products.',
    supportEmail:  '',
    responseTime:  '24 hours',
  });

  const [notifications, setNotifications] = useState({
    newOrder:         true,
    newReview:        true,
    lowStock:         true,
    withdrawalUpdate: true,
    weeklySummary:    false,
    marketingTips:    false,
  });

  const { settings, loading, saving, error: hookError, saveOk, save } = useStoreSettings();

  useEffect(() => {
    if (settings) {
      setBranding({
        storeName:  settings.name || '',
        tagline:    settings.tagline || '',
        bio:        settings.bio || '',
        website:    settings.website || '',
        twitter:    settings.twitter || '',
        instagram:  settings.instagram || '',
      });
      setPolicies({
        refundPolicy:  settings.refundPolicy || '30-day money-back guarantee on all products.',
        supportEmail:  settings.supportEmail || '',
        responseTime:  settings.responseTime || '24 hours',
      });
      setAnnouncement(settings.announcement || '');
      setAnnouncementActive(!!settings.announcementActive);
      setVacation(!!settings.vacationMode);
      setVacationMsg(settings.vacationMessage || '');
      if (settings.notifications) {
        setNotifications(prev => ({ ...prev, ...settings.notifications }));
      }
    }
  }, [settings, loading]);

  const handleSave = async () => {
    try {
      await save({
        storeName:          branding.storeName,
        tagline:            branding.tagline,
        bio:                branding.bio,
        website:            branding.website,
        twitter:            branding.twitter,
        instagram:          branding.instagram,
        refundPolicy:       policies.refundPolicy,
        supportEmail:       policies.supportEmail,
        responseTime:       policies.responseTime,
        announcement,
        announcementActive,
        vacationMode:       vacation,
        vacationMessage:    vacationMsg,
      });
    } catch (err) {
      console.error('StoreSettings save:', err);
    }
  };

  const logoChar = branding.storeName?.charAt(0).toUpperCase() || 'S';

  return (
    <VendorLayout activePage="store-settings" title="Store Settings" subtitle="Manage your store identity and preferences">

      {saveOk && (
        <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 20,
          background: 'rgba(34,197,94,0.10)', border: '1px solid rgba(34,197,94,0.22)',
          color: '#16a34a', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          ✓ Settings saved successfully
        </div>
      )}

      {hookError && (
        <div style={{ padding: '12px 16px', borderRadius: 12, marginBottom: 20,
          background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.22)',
          color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertCircle size={16} />
          {hookError}
        </div>
      )}

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--v-text3)', fontSize: 13, marginBottom: 16 }}>
          <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
          Loading settings...
        </div>
      )}

      <div className="v-tabs" style={{ marginBottom: 24 }}>
        {['branding','announcement','vacation','policies','notifications'].map(t => (
          <button key={t} className={`v-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {tab === 'branding' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
          <div className="v-card v-card-pad">
            <div className="v-section-title" style={{ marginBottom: 20 }}>Store Identity</div>
            {[
              { key: 'storeName',  label: 'Store Name',  placeholder: 'My Awesome Studio' },
              { key: 'tagline',    label: 'Tagline',      placeholder: 'Premium assets for creators' },
            ].map(f => (
              <div key={f.key} className="v-field">
                <label className="v-label">{f.label}</label>
                <input className="v-input" placeholder={f.placeholder}
                  value={branding[f.key]} onChange={e => setBranding(b => ({ ...b, [f.key]: e.target.value }))} />
              </div>
            ))}
            <div className="v-field">
              <label className="v-label">Bio</label>
              <textarea className="v-textarea" rows={4} value={branding.bio}
                onChange={e => setBranding(b => ({ ...b, bio: e.target.value }))} />
            </div>
            <div className="v-section-title" style={{ margin: '20px 0 16px', fontSize: 16 }}>Social Links</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { key: 'website',   label: 'Website',   placeholder: 'https://...' },
                { key: 'twitter',   label: 'Twitter',   placeholder: '@handle' },
                { key: 'instagram', label: 'Instagram', placeholder: '@handle' },
              ].map(f => (
                <div key={f.key} className="v-field">
                  <label className="v-label">{f.label}</label>
                  <input className="v-input" placeholder={f.placeholder}
                    value={branding[f.key]} onChange={e => setBranding(b => ({ ...b, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>
            <button className="v-btn v-btn-primary" style={{ marginTop: 8 }} onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>

          <div className="v-card v-card-pad">
            <div className="v-section-title" style={{ marginBottom: 16 }}>Store Preview</div>
            <div style={{ borderRadius: 16, overflow: 'hidden', border: '1px solid var(--v-border)' }}>
              <div style={{ height: 80, background: 'linear-gradient(135deg, #D8BFE3, #B886D0)' }} />
              <div style={{ padding: '0 16px 16px', background: 'rgba(255,255,255,0.80)' }}>
                <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)',
                  marginTop: -28, border: '3px solid #fff', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: 20, color: '#fff', fontWeight: 700 }}>
                  {logoChar}
                </div>
                <div style={{ fontWeight: 700, color: 'var(--v-dark)', marginTop: 8, fontSize: 15 }}>{branding.storeName || 'Your Store'}</div>
                <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 3 }}>{branding.tagline}</div>
                <div style={{ fontSize: 12, color: 'var(--v-text2)', marginTop: 8, lineHeight: 1.5 }}>
                  {(branding.bio || '').slice(0, 80)}{branding.bio?.length > 80 ? '...' : ''}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'announcement' && (
        <div className="v-card v-card-pad" style={{ maxWidth: 640 }}>
          <div className="v-section-title" style={{ marginBottom: 6 }}>Store Announcement</div>
          <div style={{ fontSize: 13, color: 'var(--v-text3)', marginBottom: 20 }}>
            Display a banner message on your store page for customers.
          </div>
          <div className="v-field">
            <label className="v-label">Announcement Message</label>
            <textarea className="v-textarea" rows={3}
              placeholder="e.g. 🎉 Summer Sale — 30% off all UI Kits this week!"
              value={announcement} onChange={e => setAnnouncement(e.target.value)} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" style={{ accentColor: '#B886D0', width: 16, height: 16 }}
                checked={announcementActive} onChange={e => setAnnouncementActive(e.target.checked)} />
              <span style={{ fontSize: 13, color: 'var(--v-text2)' }}>Show announcement on store</span>
            </label>
          </div>
          {announcement && (
            <div style={{ padding: '12px 16px', borderRadius: 10, marginBottom: 20,
              background: 'rgba(184,134,208,0.15)', border: '1px solid rgba(184,134,208,0.30)',
              fontSize: 13, color: 'var(--v-deep)' }}>
              <strong>Preview:</strong> {announcement}
            </div>
          )}
          <button className="v-btn v-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Announcement'}
          </button>
        </div>
      )}

      {tab === 'vacation' && (
        <div className="v-card v-card-pad" style={{ maxWidth: 560 }}>
          <div className="v-section-title" style={{ marginBottom: 6 }}>Vacation Mode</div>
          <div style={{ fontSize: 13, color: 'var(--v-text3)', marginBottom: 24 }}>
            Pause your store temporarily. Customers will see a vacation notice.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderRadius: 14,
            background: vacation ? 'rgba(245,158,11,0.10)' : 'rgba(216,191,227,0.12)',
            border: `1px solid ${vacation ? 'rgba(245,158,11,0.30)' : 'rgba(184,134,208,0.20)'}`,
            marginBottom: 20 }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--v-dark)', fontSize: 14 }}>
                {vacation ? '🏖 Vacation Mode Active' : '🟢 Store is Open'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 3 }}>
                {vacation ? 'Your store is paused.' : 'Accepting orders normally.'}
              </div>
            </div>
            <button className={`v-btn ${vacation ? 'v-btn-secondary' : 'v-btn-primary'}`}
              onClick={() => setVacation(v => !v)}>
              {vacation ? 'Resume Store' : 'Enable Vacation'}
            </button>
          </div>
          {vacation && (
            <div className="v-field">
              <label className="v-label">Vacation Message</label>
              <textarea className="v-textarea" rows={3}
                placeholder="e.g. I'm on vacation until June 15."
                value={vacationMsg} onChange={e => setVacationMsg(e.target.value)} />
              <div className="v-field-hint">Shown to customers visiting your store.</div>
            </div>
          )}
          <button className="v-btn v-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}

      {tab === 'policies' && (
        <div className="v-card v-card-pad" style={{ maxWidth: 640 }}>
          <div className="v-section-title" style={{ marginBottom: 20 }}>Store Policies</div>
          <div className="v-field">
            <label className="v-label">Refund Policy</label>
            <textarea className="v-textarea" rows={4} value={policies.refundPolicy}
              onChange={e => setPolicies(p => ({ ...p, refundPolicy: e.target.value }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div className="v-field">
              <label className="v-label">Support Email</label>
              <input className="v-input" value={policies.supportEmail}
                onChange={e => setPolicies(p => ({ ...p, supportEmail: e.target.value }))} />
            </div>
            <div className="v-field">
              <label className="v-label">Response Time</label>
              <select className="v-select" value={policies.responseTime}
                onChange={e => setPolicies(p => ({ ...p, responseTime: e.target.value }))}>
                <option value="24 hours">Within 24 hours</option>
                <option value="48 hours">Within 48 hours</option>
                <option value="72 hours">Within 72 hours</option>
              </select>
            </div>
          </div>
          <button className="v-btn v-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Policies'}
          </button>
        </div>
      )}

      {tab === 'notifications' && (
        <div className="v-card v-card-pad" style={{ maxWidth: 560 }}>
          <div className="v-section-title" style={{ marginBottom: 20 }}>Notification Preferences</div>
          {[
            { key: 'newOrder',         label: 'New Order',         sub: 'Get notified when a customer places an order' },
            { key: 'newReview',        label: 'New Review',        sub: 'Get notified when a customer leaves a review' },
            { key: 'lowStock',         label: 'Low Stock Alert',   sub: 'Get notified when product stock is running low' },
            { key: 'withdrawalUpdate', label: 'Withdrawal Update', sub: 'Get notified on payout status changes' },
            { key: 'weeklySummary',    label: 'Weekly Summary',    sub: 'Receive a weekly performance digest' },
            { key: 'marketingTips',    label: 'Marketing Tips',    sub: 'Receive tips to grow your store' },
          ].map(n => (
            <div key={n.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 0', borderBottom: '1px solid rgba(184,134,208,0.10)' }}>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--v-dark)' }}>{n.label}</div>
                <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 2 }}>{n.sub}</div>
              </div>
              <input type="checkbox" style={{ accentColor: '#B886D0', width: 16, height: 16 }}
                checked={notifications[n.key]}
                onChange={e => setNotifications(prev => ({ ...prev, [n.key]: e.target.checked }))} />
            </div>
          ))}
          <button className="v-btn v-btn-primary" style={{ marginTop: 20 }} onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Preferences'}
          </button>
        </div>
      )}
    </VendorLayout>
  );
}
