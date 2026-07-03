import React, { useState, useEffect } from 'react';
import { Bell, Check, Trash2, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '../../services/notificationService';
import { backendFetch } from '../../utils/api';

export default function CustomerNotifications() {
  const { user } = useAuth();
  const { notifications: contextNotifs, setNotifications: setContextNotifs } = useApp();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 1. Fetch notifications & Display notification history
  const fetchNotifs = async () => {
    if (!user) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // Connect to existing FastAPI backend
      const backendData = await backendFetch('/notifications/').catch(err => {
        console.warn('Backend notifications fetch notice:', err);
        return null;
      });

      if (Array.isArray(backendData) && backendData.length > 0) {
        const formatted = backendData.map(n => ({
          id: n.id,
          title: n.title || 'System Alert',
          text: n.message || n.text || '',
          date: n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Recent',
          read: Boolean(n.is_read || n.isRead || n.read)
        }));
        setNotifications(formatted);
        setContextNotifs(formatted);
        return;
      }

      // Firestore service fallback
      const data = await getUserNotifications(user.uid).catch(() => null);
      if (Array.isArray(data) && data.length > 0) {
        const formatted = data.map(n => ({
          id: n.id,
          title: n.title || 'Notification',
          text: n.message || n.text || '',
          date: n.created_at ? new Date(n.created_at).toLocaleDateString() : 'Recent',
          read: Boolean(n.isRead || n.read)
        }));
        setNotifications(formatted);
      } else {
        setNotifications(contextNotifs);
      }
    } catch (err) {
      console.error('[Notifications] Error fetching notifications:', err);
      setError('Could not load user notifications from server.');
      setNotifications(contextNotifs);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifs();
  }, [user]);

  // 3. Mark all as read
  const markAllRead = async () => {
    try {
      // Connect to FastAPI backend
      await backendFetch('/notifications/mark-all-read', { method: 'POST' }).catch(() => null);
      if (user) await markAllNotificationsAsRead(user.uid).catch(() => null);
    } catch (err) {
      console.warn('[Notifications] Error marking all read:', err);
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setContextNotifs(prev => prev.map(n => ({ ...n, read: true })));
  };

  // 2. Mark single notification as read
  const handleSingleRead = async (n) => {
    if (n.read) return;
    try {
      await backendFetch(`/notifications/${n.id}/read`, { method: 'PUT' }).catch(() => null);
      await markNotificationAsRead(n.id).catch(() => null);
    } catch (err) {
      console.warn('[Notifications] Error marking single read:', err);
    }
    setNotifications(prev => prev.map(item => String(item.id) === String(n.id) ? { ...item, read: true } : item));
    setContextNotifs(prev => prev.map(item => String(item.id) === String(n.id) ? { ...item, read: true } : item));
  };

  const deleteNotif = (id) => {
    setNotifications(prev => prev.filter(n => String(n.id) !== String(id)));
    setContextNotifs(prev => prev.filter(n => String(n.id) !== String(id)));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.5s ease' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em' }}>INBOX</span>
          <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>Notifications</h2>
        </div>
        <button onClick={markAllRead} className="btn-premium" style={{ padding: '8px 16px', fontSize: '0.75rem', cursor: 'pointer' }}>
          <Check size={13} /> Mark all read
        </button>
      </div>

      {/* 6. Handle errors */}
      {error && !loading && (
        <div style={{ padding: '12px 20px', borderRadius: '14px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', color: '#DC2626', fontSize: '0.84rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
          <button onClick={fetchNotifs} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(239,68,68,0.12)', border: 'none', padding: '6px 12px', borderRadius: '8px', color: '#DC2626', fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* 5. Handle loading */}
      {loading ? (
        <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#7B3FA0', fontSize: '0.88rem', fontWeight: 600 }}>
          <Clock size={16} style={{ animation: 'spin 2s linear infinite' }} />
          <span>Loading user notifications...</span>
        </div>
      ) : notifications.length === 0 ? (
        <div className="glass-card" style={{ padding: '60px', textAlign: 'center', border: '1px dashed rgba(123,63,160,0.30)', borderRadius: '20px' }}>
          <Bell size={44} style={{ color: 'rgba(123,63,160,0.25)', margin: '0 auto 12px' }} />
          <p style={{ color: 'var(--color-mocha)', fontWeight: 600 }}>All caught up! No notifications.</p>
        </div>
      ) : (
        /* 4. Display notification history */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {notifications.map(n => (
            <div
              key={n.id}
              onClick={() => handleSingleRead(n)}
              className="glass-card"
              style={{
                padding: '18px 22px', display: 'flex', gap: '14px', alignItems: 'flex-start',
                border: `1px solid ${!n.read ? 'rgba(123,63,160,0.25)' : 'rgba(196,181,253,0.16)'}`,
                borderLeft: !n.read ? '3px solid #7B3FA0' : '3px solid transparent',
                cursor: !n.read ? 'pointer' : 'default'
              }}
            >
              <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(123,63,160,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0', flexShrink: 0 }}>
                <Bell size={15} />
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{n.title}</h4>
                <p style={{ fontSize: '0.78rem', color: 'var(--color-mocha)', marginTop: '3px', lineHeight: 1.4 }}>{n.text}</p>
                <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '6px', display: 'block' }}>{n.date}</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(220,38,38,0.5)', padding: '2px' }}>
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
