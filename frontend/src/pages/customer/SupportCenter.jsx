import React, { useState, useEffect } from 'react';
import { HelpCircle, Plus, Send, RefreshCw, CheckCircle, Clock, FileText, Info, Phone, MessageSquare, BookOpen, Shield, ChevronRight, AlertCircle, ArrowLeft } from 'lucide-react';
import About from '../support/About';
import Contact from '../support/Contact';
import FAQ from '../support/FAQ';
import Help from '../support/Help';
import PrivacyPolicy from '../support/PrivacyPolicy';
import { useAuth } from '../../context/AuthContext';
import { backendFetch } from '../../utils/api';

const SUPPORT_TICKETS_KEY = 'lumora_support_tickets';

export default function SupportCenter() {
  const { user } = useAuth();
  const [supportTab, setSupportTab] = useState('tickets');
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [showForm, setShowForm] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Form states
  const [category, setCategory] = useState('Download Assistance');
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 1. Fetch ticket history & support requests
  const fetchTicketHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      // Load local cache first
      const cached = localStorage.getItem(SUPPORT_TICKETS_KEY);
      let list = cached ? JSON.parse(cached) : [
        { id: 'tkt-1', convId: 101, category: 'Download Issue', title: 'Solace Mobile System zip file extraction error', status: 'Resolved', date: '3 days ago', description: 'Encountered unexpected checksum error during extraction.' },
        { id: 'tkt-2', convId: 102, category: 'General Query', title: 'Framer SaaS Master Kit update schedule query', status: 'Pending', date: '1 day ago', description: 'When is the upcoming major v4.0 update planned for release?' }
      ];

      // Try backend conversations to sync support requests
      const backendConvs = await backendFetch('/messages/conversations').catch(() => null);
      if (Array.isArray(backendConvs) && backendConvs.length > 0) {
        const syncedList = backendConvs.map((c, i) => ({
          id: `tkt-backend-${c.id}`,
          convId: c.id,
          category: i % 2 === 0 ? 'Download Assistance' : 'General Query',
          title: `Support Thread #${c.id}`,
          status: c.unread_buyer > 0 ? 'Pending' : 'Resolved',
          date: c.updated_at ? new Date(c.updated_at).toLocaleDateString() : 'Recent',
          description: c.last_message || 'Support conversation active.'
        }));

        // Merge backend with cached tickets
        const existingIds = new Set(list.map(t => String(t.convId || t.id)));
        for (const bTkt of syncedList) {
          if (!existingIds.has(String(bTkt.convId))) {
            list.push(bTkt);
          }
        }
      }

      setTickets(list);
      localStorage.setItem(SUPPORT_TICKETS_KEY, JSON.stringify(list));
    } catch (err) {
      console.warn('[SupportCenter] Ticket history fetch notice:', err);
      setError('Could not sync support tickets with backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicketHistory();
  }, [user]);

  // Load messages for a ticket
  const loadTicketMessages = async (ticket) => {
    setSelectedTicket(ticket);
    setMessages([]);
    if (ticket.convId) {
      try {
        const data = await backendFetch(`/messages/conversations/${ticket.convId}/messages`).catch(() => null);
        if (Array.isArray(data)) {
          setMessages(data);
          return;
        }
      } catch (e) {
        console.warn('Backend messages load notice:', e);
      }
    }

    // Fallback simulated thread
    setMessages([
      { id: 'm1', sender_id: user?.uid || '1', content: ticket.description || ticket.title, created_at: ticket.date },
      { id: 'm2', sender_id: 'support-agent', content: 'Hello! Thank you for reaching out to Lumora Concierge Support. Our technical team is investigating your request.', created_at: 'Just now' }
    ]);
  };

  // Send message reply on support ticket
  const handleSendReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim() || !selectedTicket) return;
    setSendingReply(true);
    try {
      if (selectedTicket.convId) {
        const backendMsg = await backendFetch(`/messages/conversations/${selectedTicket.convId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: replyText })
        }).catch(() => null);
        
        if (backendMsg) {
          setMessages(prev => [...prev, backendMsg]);
          setReplyText('');
          setSendingReply(false);
          return;
        }
      }

      // Local state fallback
      const newMsg = {
        id: `msg-${Date.now()}`,
        sender_id: user?.uid || 'user',
        content: replyText,
        created_at: 'Just now'
      };
      setMessages(prev => [...prev, newMsg]);
      setReplyText('');
    } catch (err) {
      console.error('Error sending support message:', err);
    } finally {
      setSendingReply(false);
    }
  };

  // Submit support request ticket
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !desc.trim()) return;

    setSubmitting(true);
    try {
      let createdConvId = null;
      // Try backend conversation creation
      const backendConv = await backendFetch('/messages/conversations', {
        method: 'POST',
        body: JSON.stringify({ buyer_id: Number(user?.uid || 1), seller_id: 2 })
      }).catch(() => null);

      if (backendConv && backendConv.id) {
        createdConvId = backendConv.id;
        await backendFetch(`/messages/conversations/${createdConvId}/messages`, {
          method: 'POST',
          body: JSON.stringify({ content: `[${category}] ${title}\n\n${desc}` })
        }).catch(() => null);
      }

      const newTkt = {
        id: `tkt-${Date.now()}`,
        convId: createdConvId,
        category,
        title,
        status: 'Open',
        date: 'Just now',
        description: desc
      };

      const updated = [newTkt, ...tickets];
      setTickets(updated);
      localStorage.setItem(SUPPORT_TICKETS_KEY, JSON.stringify(updated));

      setTitle('');
      setDesc('');
      setShowForm(false);
    } catch (err) {
      console.error('Error submitting support ticket:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusColor = (status) => {
    if (status === 'Resolved') return '#10b981';
    if (status === 'Pending') return '#f59e0b';
    return '#7B3FA0';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fade-in 0.8s ease', width: '100%' }}>
      {/* Sub Navigation */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(123, 63, 160, 0.1)', paddingBottom: '16px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {[
          { id: 'tickets', label: 'Tickets', icon: <FileText size={14} /> },
          { id: 'faq', label: 'FAQ', icon: <MessageSquare size={14} /> },
          { id: 'help', label: 'Help Desk', icon: <BookOpen size={14} /> },
          { id: 'contact', label: 'Contact', icon: <Phone size={14} /> },
          { id: 'about', label: 'About', icon: <Info size={14} /> },
          { id: 'privacy', label: 'Privacy', icon: <Shield size={14} /> },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => { setSupportTab(tab.id); setSelectedTicket(null); }}
            style={{
              padding: '8px 16px',
              borderRadius: '20px',
              border: 'none',
              background: supportTab === tab.id ? 'var(--color-espresso)' : 'transparent',
              color: supportTab === tab.id ? '#FFF' : 'var(--color-mocha)',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap'
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {supportTab === 'tickets' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <span style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em' }}>HELP DESK</span>
              <h2 className="text-editorial" style={{ fontSize: '1.8rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>Customer Concierge & Support</h2>
            </div>
            
            {!selectedTicket && (
              <button
                onClick={() => setShowForm(!showForm)}
                className="btn-premium btn-premium-solid"
                style={{ padding: '8px 16px', fontSize: '0.72rem', borderRadius: '30px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
              >
                <Plus size={13} /> {showForm ? 'View Tickets' : 'New Ticket'}
              </button>
            )}
          </div>

          {/* Handle error banner */}
          {error && !loading && (
            <div style={{ padding: '10px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#DC2626', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={14} />
                <span>{error}</span>
              </div>
              <button onClick={fetchTicketHistory} style={{ border: 'none', background: 'none', color: '#DC2626', fontWeight: 700, cursor: 'pointer', fontSize: '0.74rem' }}>Retry</button>
            </div>
          )}

          {/* Ticket Detail / Message Thread View */}
          {selectedTicket ? (
            <div className="glass-card" style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', borderRadius: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(0,0,0,0.06)', paddingBottom: '16px' }}>
                <button onClick={() => setSelectedTicket(null)} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: '#7B3FA0', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                  <ArrowLeft size={16} /> Back to Tickets
                </button>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '4px 12px', borderRadius: '20px', background: `${getStatusColor(selectedTicket.status)}12`, color: getStatusColor(selectedTicket.status), border: `1px solid ${getStatusColor(selectedTicket.status)}30` }}>
                  {selectedTicket.status}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(123, 63, 160, 0.08)', color: '#7B3FA0', fontWeight: 800 }}>{selectedTicket.category}</span>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-espresso)', marginTop: '6px' }}>{selectedTicket.title}</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--color-mocha)', marginTop: '4px' }}>{selectedTicket.description}</p>
              </div>

              {/* Message History Stream */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px', maxHeight: '350px', overflowY: 'auto', paddingRight: '6px' }}>
                {messages.map((m, idx) => {
                  const isMe = String(m.sender_id) === String(user?.uid) || m.sender_id === 1;
                  return (
                    <div key={m.id || idx} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%', background: isMe ? 'linear-gradient(135deg, #7B3FA0, #5A1E7E)' : 'rgba(245,243,255,0.9)', color: isMe ? '#fff' : 'var(--color-espresso)', padding: '12px 16px', borderRadius: '14px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                      <p style={{ fontSize: '0.82rem', lineHeight: '1.4', fontWeight: 500 }}>{m.content}</p>
                      <span style={{ fontSize: '0.62rem', opacity: 0.7, marginTop: '4px', display: 'block', textAlign: isMe ? 'right' : 'left' }}>
                        {m.created_at ? new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Send Reply Form */}
              <form onSubmit={handleSendReply} style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input 
                  type="text" 
                  placeholder="Type a message reply to support concierge..."
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(0,0,0,0.15)', fontSize: '0.82rem', outline: 'none' }}
                />
                <button type="submit" disabled={sendingReply} className="btn-premium btn-premium-solid" style={{ padding: '10px 20px', fontSize: '0.78rem', borderRadius: '10px', cursor: 'pointer' }}>
                  {sendingReply ? <RefreshCw size={14} className="spin" /> : <Send size={14} />}
                </button>
              </form>
            </div>
          ) : showForm ? (
            <form onSubmit={handleSubmit} className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid rgba(123, 63, 160, 0.25)', borderRadius: '20px' }}>
              <div style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--color-espresso)' }}>SUBMIT SUPPORT DISPATCH</div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 150px', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-mocha)' }}>TICKET TITLE / SUBJECT</label>
                  <input
                    type="text"
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g., File download error or pre-sale question"
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(123, 63, 160, 0.2)', background: '#fff', fontSize: '0.8rem', outline: 'none', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
                    required
                  />
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-mocha)' }}>CATEGORY</label>
                  <select
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(123, 63, 160, 0.2)', background: '#fff', fontSize: '0.8rem', outline: 'none', fontFamily: 'var(--font-sans)', fontWeight: 700 }}
                  >
                    <option value="Download Assistance">Downloads</option>
                    <option value="Billing Issue">Billing</option>
                    <option value="Customization Request">Customization</option>
                    <option value="General Query">General Query</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--color-mocha)' }}>DESCRIPTION</label>
                <textarea
                  rows={4}
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Describe the issue in detail, noting any browser version or console warnings..."
                  style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(123, 63, 160, 0.2)', background: '#fff', fontSize: '0.8rem', outline: 'none', resize: 'none', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn-premium btn-premium-solid"
                style={{ alignSelf: 'flex-end', padding: '10px 22px', fontSize: '0.78rem', borderRadius: '8px', cursor: 'pointer' }}
              >
                {submitting ? (
                  <>
                    <RefreshCw size={12} className="spin" style={{ animation: 'spin 2s linear infinite' }} /> Submitting...
                  </>
                ) : (
                  <>
                    <Send size={12} /> Submit Request
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Ticket history list */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {loading ? (
                <div style={{ padding: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', color: '#7B3FA0', fontSize: '0.88rem', fontWeight: 600 }}>
                  <Clock size={16} style={{ animation: 'spin 2s linear infinite' }} />
                  <span>Loading support ticket records...</span>
                </div>
              ) : tickets.length > 0 ? (
                tickets.map(t => (
                  <div 
                    key={t.id} 
                    onClick={() => loadTicketMessages(t)}
                    className="glass-card clickable" 
                    style={{ padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid rgba(196,181,253,0.22)', boxShadow: 'var(--shadow-premium)', borderRadius: '16px', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(123, 63, 160, 0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0' }}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(123, 63, 160, 0.08)', color: '#7B3FA0', fontWeight: 800 }}>{t.category}</span>
                          <span style={{ fontSize: '0.72rem', color: 'var(--color-mocha)' }}>{t.date}</span>
                        </div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-espresso)', marginTop: '4px' }}>{t.title}</h4>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '4px 10px',
                        borderRadius: '20px',
                        background: `${getStatusColor(t.status)}12`,
                        color: getStatusColor(t.status),
                        border: `1px solid ${getStatusColor(t.status)}30`
                      }}>
                        {t.status}
                      </span>
                      <ChevronRight size={16} style={{ color: 'var(--color-mocha)' }} />
                    </div>
                  </div>
                ))
              ) : (
                <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--color-mocha)', borderRadius: '16px' }}>
                  No support tickets created yet.
                </div>
              )}
            </div>
          )}

          {/* Support FAQ cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
            {[
              { q: "What is your refund policy?", a: "Due to the digital nature of design resources, we offer refunds on verified broken file downloads only." },
              { q: "How do I download updates?", a: "Head to the 'Product Updates' tab in your dashboard, select the product, and click 'Download Update'." },
              { q: "Can I use assets for client work?", a: "Yes. All purchases come with a standard commercial license allowing client projects." }
            ].map((faq, i) => (
              <div key={i} className="premium-flat-card" style={{ padding: '20px', borderRadius: '16px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{faq.q}</h4>
                <p style={{ fontSize: '0.74rem', color: 'var(--color-mocha)', marginTop: '8px', lineHeight: '1.4', fontWeight: 500 }}>{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {supportTab === 'about' && <About />}
      {supportTab === 'contact' && <Contact />}
      {supportTab === 'faq' && <FAQ />}
      {supportTab === 'help' && <Help />}
      {supportTab === 'privacy' && <PrivacyPolicy />}

    </div>
  );
}
