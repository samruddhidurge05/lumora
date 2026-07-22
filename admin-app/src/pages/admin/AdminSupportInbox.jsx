import React, { useState, useEffect, useRef, useCallback } from 'react';
import AdminLayout from './components/AdminLayout';
import { AdminSelect } from './components/AdminComponents';
import { backendFetch } from '../../utils/api';
import { MessageSquare, RefreshCw, Send, ChevronRight } from 'lucide-react';

const STATUS_OPTIONS = ['open', 'pending', 'resolved', 'closed'];

function statusColor(s) {
  if (!s) return '#7B3FA0';
  const v = s.toLowerCase();
  if (v === 'resolved' || v === 'closed') return '#10b981';
  if (v === 'pending') return '#f59e0b';
  return '#7B3FA0';
}

export default function AdminSupportInbox() {
  const [tickets, setTickets] = useState([]);
  const [loadingTickets, setLoadingTickets] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const pollRef = useRef(null);

  // ── Fetch ticket list ─────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    setLoadingTickets(true);
    try {
      const qs = statusFilter ? `?status=${statusFilter}` : '';
      const data = await backendFetch(`/admin/support/tickets${qs}`);
      setTickets(data?.tickets || []);
    } catch (e) {
      console.warn('[AdminSupportInbox] tickets fetch error:', e);
    } finally {
      setLoadingTickets(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  // ── Fetch messages for selected ticket ───────────────────────────
  const fetchMessages = useCallback(async (ticketId) => {
    try {
      const data = await backendFetch(`/admin/support/${ticketId}/messages`);
      setMessages(data?.messages || []);
    } catch (e) {
      console.warn('[AdminSupportInbox] messages fetch error:', e);
    }
  }, []);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const selectTicket = async (ticket) => {
    stopPolling();
    setSelectedTicket(ticket);
    setMessages([]);
    setReplyText('');
    await fetchMessages(ticket.id);
    pollRef.current = setInterval(() => fetchMessages(ticket.id), 4000);
  };

  useEffect(() => () => stopPolling(), []);

  // ── Send admin reply ──────────────────────────────────────────────
  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      await backendFetch(`/admin/support/${selectedTicket.id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: replyText.trim() }),
      });
      setReplyText('');
      await fetchMessages(selectedTicket.id);
    } catch (err) {
      console.error('[AdminSupportInbox] reply error:', err);
    } finally {
      setSendingReply(false);
    }
  };

  // ── Change ticket status ──────────────────────────────────────────
  const handleStatusChange = async (newStatus) => {
    if (!selectedTicket || updatingStatus) return;
    setUpdatingStatus(true);
    try {
      await backendFetch(`/admin/support/${selectedTicket.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus }),
      });
      const updated = { ...selectedTicket, status: newStatus };
      setSelectedTicket(updated);
      setTickets(prev => prev.map(t => t.id === updated.id ? { ...t, status: newStatus } : t));
    } catch (err) {
      console.error('[AdminSupportInbox] status update error:', err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── UI ────────────────────────────────────────────────────────────
  return (
    <AdminLayout activePage="support">
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div>
            <span style={{ fontSize: '0.62rem', fontWeight: 800, letterSpacing: '0.08em', color: '#8B6B5B', textTransform: 'uppercase' }}>Support</span>
            <h1 style={{ fontFamily: 'var(--font-editorial, serif)', fontSize: '2rem', fontWeight: 400, color: '#2D004D', margin: 0 }}>
              Support Inbox
            </h1>
          </div>
          {/* Status filter */}
          <AdminSelect
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              ...STATUS_OPTIONS.map(s => ({
                value: s,
                label: s.charAt(0).toUpperCase() + s.slice(1)
              }))
            ]}
          />
        </div>

        {/* Two-panel layout */}
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: '20px', flex: 1, minHeight: 0 }}>

          {/* ── Left: Ticket list ── */}
          <div style={{ background: 'rgba(255,255,255,0.48)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '20px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(220,198,255,0.18)', fontSize: '0.74rem', fontWeight: 800, color: '#8B6B5B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tickets {!loadingTickets && `(${tickets.length})`}
            </div>
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {loadingTickets ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#8B6B5B', fontSize: '0.82rem' }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                </div>
              ) : tickets.length === 0 ? (
                <div style={{ padding: '32px', textAlign: 'center', color: '#8B6B5B', fontSize: '0.82rem' }}>No tickets found.</div>
              ) : tickets.map(t => (
                <div
                  key={t.id}
                  onClick={() => selectTicket(t)}
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid rgba(220,198,255,0.12)',
                    cursor: 'pointer',
                    background: selectedTicket?.id === t.id ? 'rgba(123,63,160,0.06)' : 'transparent',
                    transition: 'background 0.18s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                  }}
                  onMouseEnter={e => { if (selectedTicket?.id !== t.id) e.currentTarget.style.background = 'rgba(123,63,160,0.03)'; }}
                  onMouseLeave={e => { if (selectedTicket?.id !== t.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#2D004D', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.title || `Ticket #${t.id}`}</div>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '4px', flexWrap: 'wrap' }}>
                      {t.category && <span style={{ fontSize: '0.60rem', fontWeight: 700, background: 'rgba(123,63,160,0.08)', color: '#7B3FA0', padding: '1px 7px', borderRadius: '6px' }}>{t.category}</span>}
                      <span style={{ fontSize: '0.60rem', color: '#8B6B5B' }}>{t.buyer_name || `User #${t.buyer_id}`}</span>
                      {t.created_at && <span style={{ fontSize: '0.60rem', color: '#8B6B5B' }}>· {new Date(t.created_at).toLocaleDateString()}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 700, padding: '2px 8px', borderRadius: '10px', background: `${statusColor(t.status)}15`, color: statusColor(t.status), border: `1px solid ${statusColor(t.status)}30` }}>{t.status}</span>
                    <ChevronRight size={12} style={{ color: '#8B6B5B' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Right: Thread view ── */}
          {selectedTicket ? (
            <div style={{ background: 'rgba(255,255,255,0.48)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '20px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              {/* Thread header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(220,198,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '0.94rem', fontWeight: 700, color: '#2D004D' }}>{selectedTicket.title || `Ticket #${selectedTicket.id}`}</div>
                  <div style={{ fontSize: '0.70rem', color: '#8B6B5B', marginTop: '2px' }}>{selectedTicket.buyer_name} · #{selectedTicket.id}</div>
                </div>
                {/* Status changer */}
                <AdminSelect
                  value={selectedTicket.status || 'open'}
                  onChange={e => handleStatusChange(e.target.value)}
                  disabled={updatingStatus}
                  options={STATUS_OPTIONS.map(s => ({
                    value: s,
                    label: s.charAt(0).toUpperCase() + s.slice(1)
                  }))}
                />
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#8B6B5B', fontSize: '0.82rem', padding: '32px' }}>No messages yet.</div>
                ) : messages.map((m, i) => {
                  const isAdmin = String(m.sender_id) !== String(selectedTicket.buyer_id);
                  return (
                    <div key={m.id || i} style={{ alignSelf: isAdmin ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                      <div style={{ padding: '10px 14px', borderRadius: '14px', background: isAdmin ? 'linear-gradient(135deg,#7B3FA0,#5A1E7E)' : 'rgba(245,243,255,0.9)', color: isAdmin ? '#fff' : '#2D004D', fontSize: '0.83rem', lineHeight: 1.5, fontWeight: 500, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
                        {m.content}
                      </div>
                      <div style={{ fontSize: '0.60rem', color: '#8B6B5B', marginTop: '3px', textAlign: isAdmin ? 'right' : 'left' }}>
                        {isAdmin ? 'Admin' : selectedTicket.buyer_name} · {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Reply input */}
              <form onSubmit={handleReply} style={{ padding: '16px 24px', borderTop: '1px solid rgba(220,198,255,0.18)', display: 'flex', gap: '10px' }}>
                <input
                  type="text"
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  placeholder="Reply to customer..."
                  disabled={selectedTicket.status === 'closed'}
                  style={{ flex: 1, padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(196,181,253,0.35)', background: 'rgba(255,255,255,0.7)', fontSize: '0.83rem', outline: 'none', fontFamily: 'inherit' }}
                />
                <button
                  type="submit"
                  disabled={sendingReply || !replyText.trim() || selectedTicket.status === 'closed'}
                  style={{ padding: '10px 18px', borderRadius: '10px', border: 'none', background: sendingReply || !replyText.trim() ? 'rgba(123,63,160,0.3)' : 'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color: '#fff', cursor: sendingReply || !replyText.trim() ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700, fontSize: '0.80rem' }}
                >
                  {sendingReply ? <RefreshCw size={14} /> : <Send size={14} />} Reply
                </button>
              </form>
            </div>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.48)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.4)', borderRadius: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: '#8B6B5B' }}>
              <MessageSquare size={40} style={{ opacity: 0.3 }} />
              <p style={{ fontSize: '0.86rem', fontWeight: 600 }}>Select a ticket to view the thread</p>
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </AdminLayout>
  );
}
