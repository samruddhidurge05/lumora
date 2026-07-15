import React, { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from './components/AdminLayout';
import { backendFetch } from '../../utils/api';
import { db } from '../../firebase';
import { collection, onSnapshot, updateDoc, doc } from 'firebase/firestore';
import { useAdminContext } from '../../context/AdminContext';

const ROLES = ['super_admin', 'admin', 'moderator', 'support', 'finance', 'marketing', 'analyst'];
const ROLE_PERMISSIONS_DESC = {
  super_admin: 'Full platform access — all permissions including team management.',
  admin:       'Read all + write products, orders, reviews, reports, support, vendors, affiliates, settings.',
  moderator:   'Read all + write reviews, reports, support.',
  support:     'Read & write support tickets; read customers.',
  finance:     'Read orders, payments, analytics, reports.',
  marketing:   'Read products & analytics; write referral links.',
  analyst:     'Read analytics, reports, audit logs.',
};
const ROLE_COLORS = {
  super_admin: { bg: 'rgba(123,63,160,0.12)', text: '#5A1E7E' },
  admin:       { bg: 'rgba(59,130,246,0.12)',  text: '#1D4ED8' },
  moderator:   { bg: 'rgba(245,158,11,0.12)',  text: '#B45309' },
  support:     { bg: 'rgba(16,185,129,0.12)',  text: '#065F46' },
  finance:     { bg: 'rgba(239,68,68,0.12)',   text: '#B91C1C' },
  marketing:   { bg: 'rgba(139,92,246,0.12)',  text: '#6D28D9' },
  analyst:     { bg: 'rgba(107,114,128,0.12)', text: '#374151' },
};
const STATUS_COLORS = {
  revoked:  { bg: 'rgba(107,114,128,0.12)', text: '#374151' },
  accepted: { bg: 'rgba(5,150,105,0.12)',   text: '#065F46' },
  expired:  { bg: 'rgba(239,68,68,0.10)',   text: '#B91C1C' },
  pending:  { bg: 'rgba(245,158,11,0.12)',  text: '#B45309' },
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatRelativeTime(iso) {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return 'Just now';
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function roleBadge(role) {
  const c = ROLE_COLORS[role] || { bg: 'rgba(107,114,128,0.1)', text: '#374151' };
  return (
    <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.65rem',
                   fontWeight: 800, background: c.bg, color: c.text,
                   textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {role?.replace(/_/g, ' ')}
    </span>
  );
}

function statusBadge(status) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return (
    <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.62rem',
                   fontWeight: 800, background: c.bg, color: c.text,
                   textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {status}
    </span>
  );
}

function copyToClipboard(text, onSuccess) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
      const el = document.createElement('textarea');
      el.value = text; document.body.appendChild(el); el.select();
      document.execCommand('copy'); document.body.removeChild(el);
      onSuccess();
    });
  } else {
    const el = document.createElement('textarea');
    el.value = text; document.body.appendChild(el); el.select();
    document.execCommand('copy'); document.body.removeChild(el);
    onSuccess();
  }
}

const FRONTEND_URL = import.meta.env.VITE_FRONTEND_URL || window.location.origin;
function buildAcceptUrl(token) {
  return `${FRONTEND_URL}/admin/accept-invite?token=${token}`;
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 3000); return () => clearTimeout(t); }, [onDone]);
  return (
    <div style={{ position: 'fixed', bottom: 32, right: 32, zIndex: 99999,
                  background: '#2D004D', color: '#fff', borderRadius: '12px',
                  padding: '12px 20px', fontSize: '0.82rem', fontWeight: 600,
                  boxShadow: '0 8px 32px rgba(45,0,96,0.25)', animation: 'fadeIn .2s ease' }}>
      {message}
      <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}`}</style>
    </div>
  );
}

// ── Team Audit Log section ────────────────────────────────────────────────────
function TeamAuditLog() {
  const [items, setItems]   = useState([]);
  const [total, setTotal]   = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const LIMIT = 50;
  const ACTION_LABELS = {
    admin_invited:             '✉ Invitation sent',
    admin_invite_accepted:     '✓ Invitation accepted',
    admin_invitation_resent:   '↩ Invitation resent',
    admin_invitation_revoked:  '✕ Invitation revoked',
    admin_deactivated:         '🔒 Admin deactivated',
    admin_role_changed:        '↕ Role changed',
  };

  const load = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const data = await backendFetch(`/admin/team/audit-log?limit=${LIMIT}&offset=${off}`);
      if (off === 0) setItems(data.items || []);
      else setItems(prev => [...prev, ...(data.items || [])]);
      setTotal(data.total || 0);
      setOffset(off);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(0); }, [load]);

  return (
    <section style={{ background: 'rgba(255,255,255,0.6)', borderRadius: '20px',
                      border: '1px solid rgba(196,148,230,0.2)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(196,148,230,0.15)',
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#2D004D' }}>
          Audit Log
        </h2>
        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7B3FA0',
                       textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {total} entries
        </span>
      </div>
      {items.length === 0 && !loading && (
        <div style={{ padding: '32px', textAlign: 'center', color: '#7B3FA0', opacity: 0.6, fontSize: '0.85rem' }}>
          No team events recorded yet.
        </div>
      )}
      {items.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'rgba(245,233,221,0.3)', borderBottom: '1px solid rgba(196,148,230,0.15)' }}>
                {['When', 'Action', 'By', 'Target', 'Details'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.62rem',
                                       fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                                       color: '#7B3FA0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map(row => {
                let details = '';
                try {
                  const m = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : row.metadata;
                  if (m?.old_role && m?.new_role) details = `${m.old_role} → ${m.new_role}`;
                  else if (m?.new_expires_at) details = `Expires ${new Date(m.new_expires_at).toLocaleDateString()}`;
                  else if (m?.role_level) details = m.role_level;
                } catch (_) {}
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid rgba(196,148,230,0.08)' }}>
                    <td style={{ padding: '10px 16px', fontSize: '0.72rem', color: '#8E6AA8', whiteSpace: 'nowrap' }}>
                      {row.created_at ? formatRelativeTime(row.created_at) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '0.75rem', color: '#2D004D', whiteSpace: 'nowrap' }}>
                      {ACTION_LABELS[row.action] || row.action}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '0.72rem', color: '#7B3FA0' }}>
                      {row.admin_email || `User #${row.admin_user_id}`}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '0.72rem', color: '#8E6AA8' }}>
                      {row.target_id ? `${row.target_type} #${row.target_id}` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', fontSize: '0.72rem', color: '#8E6AA8' }}>{details || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {items.length < total && (
        <div style={{ padding: '16px', textAlign: 'center' }}>
          <button
            onClick={() => load(offset + LIMIT)}
            disabled={loading}
            style={{ padding: '8px 20px', borderRadius: '10px', border: '1px solid rgba(123,63,160,0.25)',
                     background: 'transparent', color: '#7B3FA0', fontSize: '0.78rem', fontWeight: 700,
                     cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
            {loading ? 'Loading…' : `Load More (${total - items.length} remaining)`}
          </button>
        </div>
      )}
    </section>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function AdminUserManagement() {
  const { adminProfile } = useAdminContext();
  const ownUserId = parseInt(localStorage.getItem('lumora_backend_uid') || '0', 10);

  const [team, setTeam]             = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading]         = useState(true);
  const [toast, setToast]             = useState(null);
  const [liveStatus, setLiveStatus]   = useState('live'); // live | paused
  const pollRef = useRef(null);

  // ── Invite modal state
  const [showInvite, setShowInvite]       = useState(false);
  const [inviteEmail, setInviteEmail]     = useState('');
  const [inviteName, setInviteName]       = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteRole, setInviteRole]       = useState('admin');
  const [inviting, setInviting]           = useState(false);
  const [inviteResult, setInviteResult]   = useState(null);

  // ── Role change modal state (Req 10)
  const [roleChangeTarget, setRoleChangeTarget] = useState(null); // {userId, currentRole, newRole, memberName}
  const [pendingRole, setPendingRole]           = useState({});   // {userId: selectedValue} for dropdowns

  // ── Deactivate confirmation
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  const showToast = (msg) => setToast(msg);

  // ── REST fallback fetch
  const fetchData = useCallback(async () => {
    try {
      const [teamData, invData] = await Promise.allSettled([
        backendFetch('/admin/team'),
        backendFetch('/admin/team/invitations?include_history=true'),
      ]);
      if (teamData.status === 'fulfilled') setTeam(teamData.value || []);
      if (invData.status  === 'fulfilled') setInvitations(invData.value || []);
    } catch (_) {} finally { setLoading(false); }
  }, []);

  // ── Firestore real-time listeners (Req 5)
  useEffect(() => {
    setLoading(true);
    let unsubTeam, unsubInvites;
    let fsOk = false;

    try {
      unsubTeam = onSnapshot(
        collection(db, 'admin', 'team', 'members'),
        snap => {
          fsOk = true;
          setLiveStatus('live');
          setTeam(snap.docs.map(d => d.data()));
          setLoading(false);
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
        },
        () => startPollingFallback()
      );
      unsubInvites = onSnapshot(
        collection(db, 'admin', 'team', 'invitations'),
        snap => setInvitations(snap.docs.map(d => d.data())),
        () => {}
      );
    } catch (_) {
      startPollingFallback();
    }

    // Initial REST load so the page isn't empty while Firestore connects
    fetchData();

    return () => {
      if (unsubTeam)   unsubTeam();
      if (unsubInvites) unsubInvites();
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchData]);

  function startPollingFallback() {
    setLiveStatus('paused');
    fetchData();
    if (!pollRef.current) {
      pollRef.current = setInterval(fetchData, 30000);
    }
  }

  // ── Action handlers ───────────────────────────────────────────────────────

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true); setInviteResult(null);
    try {
      const result = await backendFetch('/admin/team/invite', {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail, role_level: inviteRole,
                               invited_name: inviteName || null,
                               message: inviteMessage || null }),
      });
      setInviteResult({ type: 'success', acceptUrl: result.accept_url,
                        email: result.email, inviteToken: result.invite_token });
      setInviteEmail(''); setInviteName(''); setInviteMessage('');
      fetchData();
    } catch (err) {
      setInviteResult({ type: 'error', message: err.message || 'Failed to send invitation.' });
    } finally { setInviting(false); }
  };

  const handleResend = async (invId, email) => {
    try {
      await backendFetch(`/admin/team/invitations/${invId}/resend`, { method: 'POST' });
      showToast(`Invitation resent to ${email}`);
      fetchData();
    } catch (err) { showToast(`Resend failed: ${err.message}`); }
  };

  const handleRevoke = async (invId) => {
    try {
      await backendFetch(`/admin/team/invitations/${invId}`, { method: 'DELETE' });
      showToast('Invitation revoked.');
      fetchData();
    } catch (err) { showToast(`Revoke failed: ${err.message}`); }
  };

  const handleCopyLink = (token) => {
    copyToClipboard(buildAcceptUrl(token), () => showToast('Link copied to clipboard'));
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await backendFetch(`/admin/team/${deactivateTarget}/deactivate`, { method: 'POST' });
      setDeactivateTarget(null); fetchData(); showToast('Admin access revoked.');
    } catch (err) { showToast(`Deactivate failed: ${err.message}`); }
  };

  const handleRoleChangeConfirm = async () => {
    if (!roleChangeTarget) return;
    try {
      await backendFetch(`/admin/team/${roleChangeTarget.userId}/role`, {
        method: 'PUT', body: JSON.stringify({ role_level: roleChangeTarget.newRole }),
      });
      showToast(`Role updated to ${roleChangeTarget.newRole.replace(/_/g, ' ')}.`);
      setRoleChangeTarget(null);
      setPendingRole(prev => { const n = { ...prev }; delete n[roleChangeTarget.userId]; return n; });
      fetchData();
    } catch (err) { showToast(`Role change failed: ${err.message}`); }
  };

  const handleRoleChangeCancel = () => {
    if (roleChangeTarget) {
      setPendingRole(prev => { const n = { ...prev }; delete n[roleChangeTarget.userId]; return n; });
    }
    setRoleChangeTarget(null);
  };

  // ── Render ────────────────────────────────────────────────────────────────
  const sortedTeam = [...team].sort((a, b) =>
    (b.last_login_at || '') > (a.last_login_at || '') ? 1 : -1
  );

  return (
    <AdminLayout activePage="team">
      {toast && <Toast message={toast} onDone={() => setToast(null)} />}

      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

        {/* Live status banner (Req 5) */}
        {liveStatus === 'paused' && (
          <div style={{ padding: '10px 20px', marginBottom: '16px', borderRadius: '10px',
                        background: 'rgba(245,158,11,0.10)', border: '1px solid rgba(245,158,11,0.25)',
                        color: '#B45309', fontSize: '0.78rem', fontWeight: 600 }}>
            ⚠ Live updates paused — reconnecting…
          </div>
        )}

        {/* Header */}
        <section className="mb-8">
          <div className="glass-surface rounded-3xl p-6 border border-white/50 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl font-serif font-black text-[#2D004D]">Team Management</h1>
              <p className="text-[9px] font-bold text-[#7B3FA0] uppercase tracking-wider mt-0.5">
                Admin roles · {team.length} active members
              </p>
            </div>
            <button
              onClick={() => { setShowInvite(true); setInviteResult(null); }}
              style={{ padding: '10px 20px', borderRadius: '12px', border: 'none',
                       background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff',
                       fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              + Invite Member
            </button>
          </div>
        </section>

        {/* Active team table */}
        <section className="glass-surface rounded-3xl border border-white/50 shadow-sm overflow-hidden mb-8">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(196,148,230,0.15)' }}>
            <h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#2D004D' }}>
              Active Team Members
            </h2>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#7B3FA0', fontSize: '0.85rem' }}>Loading…</div>
          ) : sortedTeam.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#7B3FA0', opacity: 0.6, fontSize: '0.85rem' }}>
              No team members found.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(196,148,230,0.15)', background: 'rgba(245,233,221,0.3)' }}>
                    {['Name', 'Email', 'Role', 'Joined', 'Last Login', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.65rem',
                                           fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7B3FA0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sortedTeam.map((member) => {
                    const isOwnRow = member.user_id === ownUserId;
                    const currentRole = pendingRole[member.user_id] ?? member.role_level;
                    return (
                      <tr key={member.user_id || member.id} style={{ borderBottom: '1px solid rgba(196,148,230,0.1)' }}>
                        <td style={{ padding: '14px 20px', fontSize: '0.85rem', fontWeight: 700, color: '#2D004D' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%',
                                          background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                              {(member.name || 'A')[0].toUpperCase()}
                            </div>
                            {member.name}
                            {isOwnRow && <span style={{ fontSize: '0.6rem', color: '#7B3FA0', background: 'rgba(123,63,160,0.08)', padding: '1px 6px', borderRadius: '4px' }}>You</span>}
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '0.78rem', color: '#7B3FA0' }}>{member.email}</td>
                        <td style={{ padding: '14px 20px' }}>{roleBadge(member.role_level)}</td>
                        <td style={{ padding: '14px 20px', fontSize: '0.72rem', color: '#8E6AA8' }}>
                          {member.activated_at ? new Date(member.activated_at).toLocaleDateString() : '—'}
                        </td>
                        <td style={{ padding: '14px 20px', fontSize: '0.72rem', color: '#8E6AA8' }}>
                          {formatRelativeTime(member.last_login_at)}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <select
                              value={currentRole}
                              disabled={isOwnRow}
                              onChange={e => {
                                const newRole = e.target.value;
                                setPendingRole(prev => ({ ...prev, [member.user_id]: newRole }));
                                setRoleChangeTarget({ userId: member.user_id, currentRole: member.role_level, newRole, memberName: member.name });
                              }}
                              style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(123,63,160,0.25)',
                                       fontSize: '0.72rem', background: '#fff', color: '#2D004D', cursor: isOwnRow ? 'not-allowed' : 'pointer',
                                       opacity: isOwnRow ? 0.45 : 1 }}>
                              {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                            </select>
                            {!isOwnRow && (
                              <button
                                onClick={() => setDeactivateTarget(member.user_id)}
                                style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.25)',
                                         background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: '0.72rem',
                                         fontWeight: 700, cursor: 'pointer' }}>
                                Deactivate
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Invitation history table */}
        <section className="glass-surface rounded-3xl border border-white/50 shadow-sm overflow-hidden mb-8">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(196,148,230,0.15)',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#2D004D' }}>Invitation History</h2>
            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {invitations.length} total
            </span>
          </div>
          {invitations.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#7B3FA0', opacity: 0.6, fontSize: '0.85rem' }}>
              No invitations sent yet.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(196,148,230,0.15)', background: 'rgba(245,233,221,0.3)' }}>
                    {['Email', 'Role', 'Status', 'Sent', 'Expires / Accepted', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '0.62rem',
                                           fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em',
                                           color: '#7B3FA0', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {invitations.map(inv => (
                    <tr key={inv.id} style={{ borderBottom: '1px solid rgba(196,148,230,0.08)',
                                              opacity: inv.status === 'expired' || inv.status === 'revoked' ? 0.65 : 1 }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#2D004D' }}>{inv.email}</div>
                        {inv.invited_name && (
                          <div style={{ fontSize: '0.68rem', color: '#8E6AA8', marginTop: '2px' }}>{inv.invited_name}</div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{roleBadge(inv.role_level)}</td>
                      <td style={{ padding: '12px 16px' }}>{statusBadge(inv.status)}</td>
                      <td style={{ padding: '12px 16px', fontSize: '0.72rem', color: '#8E6AA8' }}>
                        {inv.created_at ? new Date(inv.created_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: '0.72rem', color: '#8E6AA8' }}>
                        {inv.status === 'accepted' && inv.accepted_at
                          ? new Date(inv.accepted_at).toLocaleDateString()
                          : inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                          {/* Copy Link — pending only (Req 11) */}
                          {inv.status === 'pending' && inv.invite_token && (
                            <button
                              onClick={() => handleCopyLink(inv.invite_token)}
                              title="Copy invitation link"
                              style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(123,63,160,0.25)',
                                       background: 'rgba(123,63,160,0.06)', color: '#5A1E7E',
                                       fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                              📋 Copy
                            </button>
                          )}
                          {/* Resend — pending or expired (Req 2) */}
                          {(inv.status === 'pending' || inv.status === 'expired') && (
                            <button
                              onClick={() => handleResend(inv.id, inv.email)}
                              style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(59,130,246,0.25)',
                                       background: 'rgba(59,130,246,0.06)', color: '#1D4ED8',
                                       fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                              ↩ Resend
                            </button>
                          )}
                          {/* Revoke — pending only (Req 3) */}
                          {inv.status === 'pending' && (
                            <button
                              onClick={() => handleRevoke(inv.id)}
                              style={{ padding: '4px 10px', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.25)',
                                       background: 'rgba(220,38,38,0.06)', color: '#DC2626',
                                       fontSize: '0.68rem', fontWeight: 700, cursor: 'pointer' }}>
                              ✕ Revoke
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Audit Log section (Req 6) */}
        <TeamAuditLog />

      </main>

      {/* ── INVITE MODAL ─────────────────────────────────────────────── */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '24px', padding: '32px',
                        maxWidth: '480px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', color: '#2D004D', fontWeight: 700, fontSize: '1.1rem' }}>
              Invite Team Member
            </h3>
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Email */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase',
                                 letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                  Email <span style={{ color: '#DC2626' }}>*</span>
                </label>
                <input type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px',
                           border: '1px solid rgba(123,63,160,0.25)', fontSize: '0.85rem',
                           boxSizing: 'border-box', outline: 'none' }} />
              </div>
              {/* Name (Req 8) */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase',
                                 letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                  Name <span style={{ opacity: 0.5 }}>(optional)</span>
                </label>
                <input type="text" value={inviteName} onChange={e => setInviteName(e.target.value)}
                  maxLength={150} placeholder="Alex Morgan"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px',
                           border: '1px solid rgba(123,63,160,0.25)', fontSize: '0.85rem',
                           boxSizing: 'border-box', outline: 'none' }} />
              </div>
              {/* Role */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase',
                                 letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px',
                           border: '1px solid rgba(123,63,160,0.25)', fontSize: '0.85rem',
                           boxSizing: 'border-box', background: '#fff', cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
                <p style={{ margin: '4px 0 0', fontSize: '0.68rem', color: '#8E6AA8' }}>
                  {ROLE_PERMISSIONS_DESC[inviteRole]}
                </p>
              </div>
              {/* Message (Req 8) */}
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase',
                                 letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>
                  Personal message <span style={{ opacity: 0.5 }}>(optional)</span>
                </label>
                <textarea value={inviteMessage} onChange={e => setInviteMessage(e.target.value)}
                  maxLength={300} rows={2} placeholder="Welcome to the team! Looking forward to working with you."
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px',
                           border: '1px solid rgba(123,63,160,0.25)', fontSize: '0.85rem',
                           boxSizing: 'border-box', outline: 'none', resize: 'vertical' }} />
              </div>

              {/* Success result */}
              {inviteResult?.type === 'success' && (
                <div style={{ padding: '14px', background: 'rgba(5,150,105,0.08)',
                              border: '1px solid rgba(5,150,105,0.2)', borderRadius: '10px',
                              fontSize: '0.78rem', color: '#065F46' }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 700 }}>✓ Invitation created for {inviteResult.email}</p>
                  <p style={{ margin: '0 0 6px' }}>Share this link:</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <code style={{ flex: 1, background: 'rgba(0,0,0,0.06)', padding: '6px 10px',
                                   borderRadius: '6px', fontSize: '0.70rem', wordBreak: 'break-all' }}>
                      {inviteResult.acceptUrl}
                    </code>
                    <button type="button"
                      onClick={() => copyToClipboard(inviteResult.acceptUrl, () => showToast('Link copied!'))}
                      style={{ flexShrink: 0, padding: '6px 12px', borderRadius: '8px',
                               border: '1px solid rgba(5,150,105,0.3)', background: 'rgba(5,150,105,0.08)',
                               color: '#065F46', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}>
                      Copy
                    </button>
                  </div>
                  <p style={{ margin: '8px 0 0', fontSize: '0.70rem', opacity: 0.8 }}>
                    Link expires in 48 hours. Single-use only.
                  </p>
                </div>
              )}
              {inviteResult?.type === 'error' && (
                <div style={{ padding: '12px', background: 'rgba(220,38,38,0.08)',
                              borderRadius: '10px', color: '#DC2626', fontSize: '0.78rem' }}>
                  {inviteResult.message}
                </div>
              )}

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowInvite(false); setInviteResult(null); }}
                  style={{ padding: '10px 20px', borderRadius: '10px',
                           border: '1px solid rgba(123,63,160,0.25)', background: 'transparent',
                           cursor: 'pointer', fontWeight: 600 }}>
                  {inviteResult?.type === 'success' ? 'Close' : 'Cancel'}
                </button>
                {inviteResult?.type !== 'success' && (
                  <button type="submit" disabled={inviting}
                    style={{ padding: '10px 20px', borderRadius: '10px', border: 'none',
                             background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff',
                             cursor: 'pointer', fontWeight: 700, opacity: inviting ? 0.7 : 1 }}>
                    {inviting ? 'Sending…' : 'Send Invite'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── DEACTIVATE CONFIRMATION ───────────────────────────────────── */}
      {deactivateTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: '0 0 12px', color: '#2D004D', fontWeight: 700 }}>Deactivate Admin</h3>
            <p style={{ color: '#7B3FA0', fontSize: '0.85rem', margin: '0 0 24px' }}>
              This will immediately revoke their admin access.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeactivateTarget(null)}
                style={{ padding: '10px 20px', borderRadius: '10px',
                         border: '1px solid rgba(123,63,160,0.25)', background: 'transparent',
                         cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleDeactivate}
                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none',
                         background: '#DC2626', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ROLE CHANGE CONFIRMATION (Req 10) ────────────────────────── */}
      {roleChangeTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999,
                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', maxWidth: '440px', width: '90%' }}>
            <h3 style={{ margin: '0 0 16px', color: '#2D004D', fontWeight: 700 }}>Change Role</h3>
            <p style={{ color: '#2D004D', fontSize: '0.88rem', margin: '0 0 12px' }}>
              <strong>{roleChangeTarget.memberName}</strong>
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              {roleBadge(roleChangeTarget.currentRole)}
              <span style={{ color: '#8E6AA8' }}>→</span>
              {roleBadge(roleChangeTarget.newRole)}
            </div>
            <p style={{ fontSize: '0.78rem', color: '#7B3FA0', marginBottom: '12px', lineHeight: 1.5 }}>
              {ROLE_PERMISSIONS_DESC[roleChangeTarget.newRole]}
            </p>
            {/* Demotion warning */}
            {ROLES.indexOf(roleChangeTarget.newRole) > ROLES.indexOf(roleChangeTarget.currentRole) && (
              <div style={{ padding: '10px 14px', borderRadius: '10px', background: 'rgba(245,158,11,0.10)',
                            border: '1px solid rgba(245,158,11,0.25)', color: '#B45309',
                            fontSize: '0.78rem', fontWeight: 600, marginBottom: '16px' }}>
                ⚠ This will reduce their access. Confirm only if intentional.
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={handleRoleChangeCancel}
                style={{ padding: '10px 20px', borderRadius: '10px',
                         border: '1px solid rgba(123,63,160,0.25)', background: 'transparent',
                         cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
              <button onClick={handleRoleChangeConfirm}
                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none',
                         background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff',
                         cursor: 'pointer', fontWeight: 700 }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
