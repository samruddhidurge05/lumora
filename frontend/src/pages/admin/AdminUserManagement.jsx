import React, { useState, useEffect } from 'react';
import AdminLayout from './components/AdminLayout';
import { backendFetch } from '../../utils/api';

const ROLES = ['super_admin', 'admin', 'moderator', 'support', 'finance', 'marketing', 'analyst'];

const ROLE_COLORS = {
  super_admin: { bg: 'rgba(123,63,160,0.12)', text: '#5A1E7E' },
  admin:       { bg: 'rgba(59,130,246,0.12)', text: '#1D4ED8' },
  moderator:   { bg: 'rgba(245,158,11,0.12)', text: '#B45309' },
  support:     { bg: 'rgba(16,185,129,0.12)', text: '#065F46' },
  finance:     { bg: 'rgba(239,68,68,0.12)',  text: '#B91C1C' },
  marketing:   { bg: 'rgba(139,92,246,0.12)', text: '#6D28D9' },
  analyst:     { bg: 'rgba(107,114,128,0.12)', text: '#374151' },
};

export default function AdminUserManagement() {
  const [team, setTeam] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Invite modal state
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('admin');
  const [inviting, setInviting] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);

  // Deactivate confirmation
  const [deactivateTarget, setDeactivateTarget] = useState(null);

  // Role change
  const [roleChangeTarget, setRoleChangeTarget] = useState(null); // { userId, newRole }

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [teamData, invData] = await Promise.allSettled([
        backendFetch('/admin/team'),
        backendFetch('/admin/team/invitations'),
      ]);
      setTeam(teamData.status === 'fulfilled' ? (teamData.value || []) : []);
      setInvitations(invData.status === 'fulfilled' ? (invData.value || []) : []);
    } catch (err) {
      setError('Failed to load team data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    setInviting(true);
    setInviteResult(null);
    try {
      const result = await backendFetch('/admin/team/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role_level: inviteRole }),
      });
      setInviteResult({ type: 'success', token: result.invite_token, acceptUrl: result.accept_url, email: result.email });
      setInviteEmail('');
      fetchData();
    } catch (err) {
      setInviteResult({ type: 'error', message: err.message || 'Failed to send invitation.' });
    } finally {
      setInviting(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await backendFetch(`/admin/team/${deactivateTarget}/deactivate`, { method: 'POST' });
      setDeactivateTarget(null);
      fetchData();
    } catch (err) {
      alert('Failed to deactivate: ' + err.message);
    }
  };

  const handleRoleChange = async () => {
    if (!roleChangeTarget) return;
    try {
      await backendFetch(`/admin/team/${roleChangeTarget.userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role_level: roleChangeTarget.newRole }),
      });
      setRoleChangeTarget(null);
      fetchData();
    } catch (err) {
      alert('Failed to change role: ' + err.message);
    }
  };

  const handleCancelInvitation = async (invId) => {
    try {
      await backendFetch(`/admin/team/invitations/${invId}`, { method: 'DELETE' });
      fetchData();
    } catch (err) {
      alert('Failed to cancel invitation: ' + err.message);
    }
  };

  const roleBadge = (role) => {
    const c = ROLE_COLORS[role] || { bg: 'rgba(107,114,128,0.1)', text: '#374151' };
    return (
      <span style={{ padding: '2px 10px', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 800, background: c.bg, color: c.text, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {role?.replace(/_/g, ' ')}
      </span>
    );
  };

  return (
    <AdminLayout activePage="team">
      <main className="admin-page-container px-4 md:px-8 pt-6 pb-24 relative z-10">

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
              style={{ padding: '10px 20px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}
            >
              + Invite Member
            </button>
          </div>
        </section>

        {error && (
          <div style={{ padding: '14px 20px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px', color: '#DC2626', marginBottom: '20px', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}

        {/* Team table */}
        <section className="glass-surface rounded-3xl border border-white/50 shadow-sm overflow-hidden mb-8">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(196,148,230,0.15)' }}>
            <h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#2D004D' }}>Active Team Members</h2>
          </div>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#7B3FA0', fontSize: '0.85rem' }}>Loading...</div>
          ) : team.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#7B3FA0', opacity: 0.6, fontSize: '0.85rem' }}>No team members found.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(196,148,230,0.15)', background: 'rgba(245,233,221,0.3)' }}>
                    {['Name', 'Email', 'Role', 'Joined', 'Actions'].map(h => (
                      <th key={h} style={{ padding: '12px 20px', textAlign: 'left', fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#7B3FA0' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {team.map((member) => (
                    <tr key={member.id} style={{ borderBottom: '1px solid rgba(196,148,230,0.1)' }}>
                      <td style={{ padding: '14px 20px', fontSize: '0.85rem', fontWeight: 700, color: '#2D004D' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.75rem', flexShrink: 0 }}>
                            {(member.name || 'A')[0].toUpperCase()}
                          </div>
                          {member.name}
                        </div>
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '0.78rem', color: '#7B3FA0' }}>{member.email}</td>
                      <td style={{ padding: '14px 20px' }}>
                        {roleBadge(member.role_level)}
                      </td>
                      <td style={{ padding: '14px 20px', fontSize: '0.72rem', color: '#8E6AA8' }}>
                        {member.activated_at ? new Date(member.activated_at).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <select
                            value={member.role_level}
                            onChange={e => setRoleChangeTarget({ userId: member.user_id, newRole: e.target.value })}
                            style={{ padding: '5px 10px', borderRadius: '8px', border: '1px solid rgba(123,63,160,0.25)', fontSize: '0.72rem', background: '#fff', color: '#2D004D', cursor: 'pointer' }}
                          >
                            {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                          </select>
                          <button
                            onClick={() => setDeactivateTarget(member.user_id)}
                            style={{ padding: '5px 12px', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                          >
                            Deactivate
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Pending invitations */}
        {invitations.length > 0 && (
          <section className="glass-surface rounded-3xl border border-white/50 shadow-sm overflow-hidden mb-8">
            <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(196,148,230,0.15)' }}>
              <h2 style={{ margin: 0, fontSize: '0.88rem', fontWeight: 700, color: '#2D004D' }}>Pending Invitations</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              {invitations.map(inv => (
                <div key={inv.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 24px', borderBottom: '1px solid rgba(196,148,230,0.08)' }}>
                  <div>
                    <p style={{ margin: 0, fontSize: '0.85rem', fontWeight: 700, color: '#2D004D' }}>{inv.email}</p>
                    <p style={{ margin: '2px 0 0', fontSize: '0.72rem', color: '#7B3FA0' }}>
                      Role: {inv.role_level?.replace(/_/g, ' ')} &bull; Expires: {inv.expires_at ? new Date(inv.expires_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleCancelInvitation(inv.id)}
                    style={{ padding: '6px 14px', borderRadius: '8px', border: '1px solid rgba(220,38,38,0.25)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', fontSize: '0.72rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

      </main>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '24px', padding: '32px', maxWidth: '460px', width: '90%', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ margin: '0 0 20px', color: '#2D004D', fontWeight: 700, fontSize: '1.1rem' }}>Invite Team Member</h3>
            <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Email</label>
                <input
                  type="email" required value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(123,63,160,0.25)', fontSize: '0.85rem', boxSizing: 'border-box', outline: 'none' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: '#7B3FA0', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: '6px' }}>Role</label>
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(123,63,160,0.25)', fontSize: '0.85rem', boxSizing: 'border-box', background: '#fff', cursor: 'pointer' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
                </select>
              </div>
              {inviteResult && inviteResult.type === 'success' && (
                <div style={{ padding: '14px', background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', borderRadius: '10px', fontSize: '0.78rem', color: '#065F46' }}>
                  <p style={{ margin: '0 0 8px', fontWeight: 700 }}>Invitation created for {inviteResult.email}</p>
                  <p style={{ margin: '0 0 4px' }}>Share this invite token:</p>
                  <code style={{ background: 'rgba(0,0,0,0.06)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.72rem', wordBreak: 'break-all' }}>{inviteResult.token}</code>
                  <p style={{ margin: '8px 0 0' }}>Accept URL: <code style={{ fontSize: '0.7rem' }}>/admin/accept-invite?token={inviteResult.token}</code></p>
                </div>
              )}
              {inviteResult && inviteResult.type === 'error' && (
                <div style={{ padding: '12px', background: 'rgba(220,38,38,0.08)', borderRadius: '10px', color: '#DC2626', fontSize: '0.78rem' }}>{inviteResult.message}</div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => { setShowInvite(false); setInviteResult(null); }}
                  style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(123,63,160,0.25)', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>
                  {inviteResult?.type === 'success' ? 'Close' : 'Cancel'}
                </button>
                {inviteResult?.type !== 'success' && (
                  <button type="submit" disabled={inviting}
                    style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', cursor: 'pointer', fontWeight: 700, opacity: inviting ? 0.7 : 1 }}>
                    {inviting ? 'Sending…' : 'Send Invite'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Deactivate confirmation */}
      {deactivateTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: '0 0 12px', color: '#2D004D', fontWeight: 700 }}>Deactivate Admin</h3>
            <p style={{ color: '#7B3FA0', fontSize: '0.85rem', margin: '0 0 24px' }}>This will immediately revoke their admin access. They will get a 403 on their next request.</p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setDeactivateTarget(null)}
                style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(123,63,160,0.25)', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={handleDeactivate}
                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: '#DC2626', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Role change confirmation */}
      {roleChangeTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '32px', maxWidth: '400px', width: '90%' }}>
            <h3 style={{ margin: '0 0 12px', color: '#2D004D', fontWeight: 700 }}>Change Role</h3>
            <p style={{ color: '#7B3FA0', fontSize: '0.85rem', margin: '0 0 24px' }}>
              Change role to <strong>{roleChangeTarget.newRole.replace(/_/g, ' ')}</strong>?
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setRoleChangeTarget(null)}
                style={{ padding: '10px 20px', borderRadius: '10px', border: '1px solid rgba(123,63,160,0.25)', background: 'transparent', cursor: 'pointer', fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={handleRoleChange}
                style={{ padding: '10px 20px', borderRadius: '10px', border: 'none', background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', cursor: 'pointer', fontWeight: 700 }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

    </AdminLayout>
  );
}
