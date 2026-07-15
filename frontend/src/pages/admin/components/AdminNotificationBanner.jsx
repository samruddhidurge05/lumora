/**
 * AdminNotificationBanner.jsx  (Req 7)
 * ──────────────────────────────────────
 * Listens to Firestore admin/notifications/items for unread invite-accepted
 * notifications and shows a dismissible banner in the admin header.
 *
 * Only rendered when role_level === 'super_admin'.
 */
import React, { useState, useEffect } from 'react';
import { db } from '../../../firebase';
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAdminContext } from '../../../context/AdminContext';

export default function AdminNotificationBanner() {
  const { adminProfile } = useAdminContext();
  const [notifications, setNotifications] = useState([]);

  // Only super_admin sees these banners (Req 7.6)
  const isSuperAdmin = adminProfile?.role_level === 'super_admin' ||
                       adminProfile?.role_level === 'admin'; // legacy admin also sees them

  useEffect(() => {
    if (!isSuperAdmin) return;
    let unsub;
    try {
      const q = query(
        collection(db, 'admin', 'notifications', 'items'),
        where('read', '==', false)
      );
      unsub = onSnapshot(q, snap => {
        setNotifications(snap.docs.map(d => ({ _id: d.id, ...d.data() })));
      }, () => {
        // Firestore unavailable — fail silently
      });
    } catch (_) {}
    return () => { if (unsub) unsub(); };
  }, [isSuperAdmin]);

  const dismiss = async (notifId) => {
    try {
      await updateDoc(doc(db, 'admin', 'notifications', 'items', notifId), { read: true });
    } catch (_) {
      // Remove optimistically from local state even if Firestore fails
      setNotifications(prev => prev.filter(n => n._id !== notifId));
    }
  };

  if (!isSuperAdmin || notifications.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px',
                  position: 'fixed', top: '80px', right: '24px', zIndex: 99998,
                  maxWidth: '400px', width: 'calc(100vw - 48px)' }}>
      {notifications.slice(0, 5).map(n => (
        <div key={n._id}
          style={{ display: 'flex', alignItems: 'flex-start', gap: '12px',
                   background: 'rgba(255,255,255,0.97)', borderRadius: '14px',
                   padding: '14px 16px',
                   border: '1px solid rgba(123,63,160,0.20)',
                   boxShadow: '0 8px 28px rgba(45,0,96,0.12)',
                   animation: 'notifSlideIn 0.25s ease' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontSize: '0.9rem' }}>
            ✓
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '0.82rem', fontWeight: 700, color: '#2D004D', lineHeight: 1.4 }}>
              New admin joined
            </p>
            <p style={{ margin: '2px 0 0', fontSize: '0.75rem', color: '#7B3FA0', lineHeight: 1.4 }}>
              <strong>{n.actor_name || n.actor_email}</strong>
              {n.actor_name && n.actor_email && ` (${n.actor_email})`} accepted their invitation and joined as{' '}
              <strong>{(n.role_level || '').replace(/_/g, ' ')}</strong>.
            </p>
          </div>
          <button
            onClick={() => dismiss(n._id)}
            aria-label="Dismiss notification"
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                     color: '#8E6AA8', fontSize: '1rem', lineHeight: 1,
                     padding: '0 0 0 4px', flexShrink: 0 }}>
            ✕
          </button>
        </div>
      ))}
      <style>{`
        @keyframes notifSlideIn {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}
