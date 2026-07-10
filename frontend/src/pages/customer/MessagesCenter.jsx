import React, { useState, useEffect, useRef } from 'react';
import { Search, Send, Paperclip, MessageSquare, RefreshCw, User, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { getUserConversations, getConversationMessages, sendMessage, markMessagesAsRead } from '../../services/messageService';
import { backendFetch } from '../../utils/api';

export default function MessagesCenter() {
  const { user } = useAuth();
  const { accentTheme } = useApp();
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [typing, setTyping] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const chatEndRef = useRef(null);

  const role = user?.role || 'customer';
  const userId = user?.uid || 'anonymous-user';

  // 1. Load conversations on mount (Backend + Firestore fallback)
  useEffect(() => {
    let isMounted = true;
    const fetchConversations = async () => {
      if (!userId) return;
      try {
        // Connect to existing FastAPI messaging backend
        const backendConvs = await backendFetch('/messages/conversations').catch(() => null);
        if (Array.isArray(backendConvs) && backendConvs.length > 0 && isMounted) {
          setConversations(backendConvs);
          const targetId = sessionStorage.getItem('lumora_active_conversation_id');
          if (targetId) {
            const found = backendConvs.find(c => String(c.id) === String(targetId));
            if (found) {
              setActiveConv(found);
              sessionStorage.removeItem('lumora_active_conversation_id');
              return;
            }
          }
          if (!activeConv) setActiveConv(backendConvs[0]);
          return;
        }
      } catch (e) {
        console.warn('Backend conversations fetch notice:', e);
      }

      // Firestore service fallback
      const data = await getUserConversations(userId);
      if (isMounted) {
        setConversations(data);
        const targetId = sessionStorage.getItem('lumora_active_conversation_id');
        if (targetId) {
          const found = data.find(c => String(c.id) === String(targetId));
          if (found) {
            setActiveConv(found);
            sessionStorage.removeItem('lumora_active_conversation_id');
            return;
          }
        }
        if (data.length > 0 && !activeConv) {
          setActiveConv(data[0]);
        }
      }
    };
    fetchConversations();
    return () => { isMounted = false; };
  }, [userId]);

  // 2. Load & Receive messages loop (Real-time updates & backend sync)
  useEffect(() => {
    if (!activeConv) return;
    let isMounted = true;

    const fetchMessages = async () => {
      try {
        // Connect to existing messaging backend
        const backendMsgs = await backendFetch(`/messages/conversations/${activeConv.id}/messages`).catch(() => null);
        if (Array.isArray(backendMsgs) && isMounted) {
          setMessages(backendMsgs);
          await backendFetch(`/messages/conversations/${activeConv.id}/read`, { method: 'PUT' }).catch(() => null);
          return;
        }
      } catch (e) {
        console.warn('Backend messages fetch notice:', e);
      }

      // Firestore service fallback
      if (isMounted) {
        setLoading(true);
        const data = await getConversationMessages(activeConv.id);
        setMessages(data);
        setLoading(false);
        await markMessagesAsRead(activeConv.id, role);
      }
    };

    fetchMessages();

    // 4. Receive messages (Polling interval for automatic message reception)
    const pollInterval = setInterval(() => {
      fetchMessages();
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(pollInterval);
    };
  }, [activeConv]);

  // Scroll to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  // 3. Send messages
  const handleSend = async (e) => {
    e.preventDefault();
    if (!inputText.trim() && !attachment) return;

    setSending(true);
    const textToSend = inputText;
    const attachToSend = attachment ? attachment.name : null;
    setInputText('');
    setAttachment(null);

    try {
      // Dispatch message to FastAPI backend
      let sentToBackend = false;
      const res = await backendFetch(`/messages/conversations/${activeConv.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({
          content: textToSend,
          attachment_url: attachToSend
        })
      }).then(val => {
        if (val) sentToBackend = true;
        return val;
      }).catch(err => {
        console.warn('Backend send message notice:', err);
        return null;
      });

      // Dispatch to Firestore service
      await sendMessage(activeConv.id, userId, role, textToSend, attachToSend).catch(() => null);

      // Optimistic message update
      const newMsg = {
        id: res?.id || Date.now().toString(),
        sender_id: userId,
        content: textToSend,
        attachment_url: attachToSend,
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, newMsg]);

      // Only simulate creator reply if backend is NOT active (i.e. Firestore fallback mode)
      if (!sentToBackend) {
        setTyping(true);
        setTimeout(async () => {
          setTyping(false);
          const autoText = `Hello! Thanks for reaching out regarding this digital asset. I've received your request and will provide full technical assistance shortly.`;
          const receiverId = role === 'customer' ? (activeConv.seller_id || 'vendor-1') : (activeConv.buyer_id || 'customer-1');
          const receiverRole = role === 'customer' ? 'vendor' : 'customer';
          
          await sendMessage(activeConv.id, receiverId, receiverRole, autoText).catch(() => null);
          
          const autoMsg = {
            id: (Date.now() + 1).toString(),
            sender_id: receiverId,
            content: autoText,
            created_at: new Date().toISOString()
          };
          setMessages(prev => [...prev, autoMsg]);
        }, 2200);
      }

    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      setSending(false);
    }
  };

  const handleQuickReply = (text) => {
    setInputText(text);
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setAttachment(e.target.files[0]);
    }
  };

  const filteredConversations = conversations.filter(c => {
    const targetName = role === 'customer' ? c.seller_name : c.buyer_name;
    return targetName?.toLowerCase().includes(search.toLowerCase());
  });

  const getChatPartnerName = (conv) => {
    if (!conv) return '';
    return role === 'customer' ? conv.seller_name || 'Creator' : conv.buyer_name || 'Customer';
  };

  const quickReplies = [
    "Is this compatible with Framer?",
    "Do you offer commercial licenses?",
    "Can you help with setup?",
    "Thanks for the quick reply!"
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '24px', height: '600px' }} className="chat-container">
      
      {/* LEFT COLUMN: Conversations List */}
      <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px', height: '100%' }}>
        {/* Search */}
        <div className="glass-surface" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '30px' }}>
          <Search size={14} style={{ color: 'var(--color-mocha)' }} />
          <input
            type="text"
            placeholder="Search chats..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ background: 'transparent', border: 'none', outline: 'none', fontFamily: 'var(--font-sans)', fontSize: '0.8rem', color: 'var(--color-espresso)', width: '100%' }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }} className="custom-scrollbar">
          {filteredConversations.length > 0 ? (
            filteredConversations.map(c => {
              const isActive = activeConv?.id === c.id;
              const unread = role === 'customer' ? c.unread_buyer : c.unread_seller;
              const partnerName = getChatPartnerName(c);
              
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveConv(c)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px',
                    borderRadius: '12px',
                    border: isActive ? '1px solid rgba(123, 63, 160, 0.25)' : '1px solid transparent',
                    background: isActive ? 'rgba(123, 63, 160, 0.05)' : 'transparent',
                    color: isActive ? '#7B3FA0' : 'var(--color-espresso)',
                    textAlign: 'left',
                    cursor: 'pointer',
                    outline: 'none',
                    width: '100%',
                    position: 'relative'
                  }}
                  className="clickable"
                >
                  {/* Status Indicator */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #A78BFA, #7B3FA0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>
                      {partnerName.substring(0, 2).toUpperCase()}
                    </div>
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: '#10b981', border: '2px solid #fff' }} />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{partnerName}</span>
                      <span style={{ fontSize: '0.62rem', color: 'var(--color-mocha)', opacity: 0.8 }}>Active</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                      <span style={{ fontSize: '0.74rem', color: 'var(--color-mocha)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '160px' }}>
                        {c.last_message || "Start a conversation..."}
                      </span>
                      {unread > 0 && (
                        <span style={{ fontSize: '0.62rem', padding: '1px 5px', borderRadius: '10px', background: '#7B3FA0', color: '#fff', fontWeight: 800 }}>
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--color-mocha)', fontSize: '0.8rem' }}>
              No chats found.
            </div>
          )}
        </div>
      </div>

      {/* RIGHT COLUMN: Active Chat Feed */}
      <div className="glass-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%' }}>
        {activeConv ? (
          <>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid rgba(45,0,77,0.06)', background: 'rgba(123, 63, 160, 0.02)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg, #A78BFA, #7B3FA0)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.8rem' }}>
                  {getChatPartnerName(activeConv).substring(0, 2).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{getChatPartnerName(activeConv)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} /> Online
                  </div>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div style={{ flex: 1, padding: '24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px' }} className="custom-scrollbar">
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'center', alignSelf: 'center', gap: '8px', color: 'var(--color-mocha)', fontSize: '0.8rem' }}>
                  <RefreshCw size={14} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                  <span>Fetching conversation feed...</span>
                </div>
              ) : messages.length > 0 ? (
                messages.map((msg) => {
                  const isMe = msg.sender_id === userId;
                  return (
                    <div
                      key={msg.id}
                      style={{
                        alignSelf: isMe ? 'flex-end' : 'flex-start',
                        maxWidth: '70%',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: isMe ? 'flex-end' : 'flex-start'
                      }}
                    >
                      <div
                        style={{
                          padding: '12px 16px',
                          borderRadius: '16px',
                          borderTopRightRadius: isMe ? '4px' : '16px',
                          borderTopLeftRadius: isMe ? '16px' : '4px',
                          background: isMe ? 'linear-gradient(135deg, #7B3FA0, #5A1E7E)' : 'rgba(255,255,255,0.9)',
                          color: isMe ? '#fff' : 'var(--color-espresso)',
                          border: isMe ? 'none' : '1px solid rgba(123, 63, 160, 0.18)',
                          fontSize: '0.82rem',
                          fontWeight: 500,
                          lineHeight: '1.4',
                          boxShadow: '0 4px 12px rgba(45,0,96,0.03)'
                        }}
                      >
                        {msg.content}
                        
                        {msg.attachment_url && (
                          <div style={{ marginTop: '8px', padding: '6px 10px', borderRadius: '8px', background: isMe ? 'rgba(255,255,255,0.15)' : 'rgba(123, 63, 160, 0.08)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 600 }}>
                            <Paperclip size={12} />
                            <span>{msg.attachment_url}</span>
                          </div>
                        )}
                      </div>
                      <span style={{ fontSize: '0.62rem', color: 'var(--color-mocha)', opacity: 0.8, marginTop: '4px', padding: '0 4px' }}>
                        {new Date(msg.created_at || Date.now()).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              ) : (
                <div style={{ textAlign: 'center', padding: '80px 40px', color: 'var(--color-mocha)' }}>
                  <MessageSquare size={36} style={{ opacity: 0.15, marginBottom: '12px' }} />
                  <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>No messages yet</div>
                  <p style={{ fontSize: '0.75rem', marginTop: '4px' }}>Ask pre-sale questions or query customization requests.</p>
                </div>
              )}

              {/* Typing indicator */}
              {typing && (
                <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,0.9)', padding: '12px 16px', borderRadius: '16px', borderTopLeftRadius: '4px', border: '1px solid rgba(123, 63, 160, 0.18)' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--color-mocha)', fontWeight: 600 }}>{getChatPartnerName(activeConv)} is typing...</span>
                  <div style={{ display: 'flex', gap: '3px' }}>
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#7B3FA0', animation: 'bounce 1.4s infinite ease-in-out' }} />
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#7B3FA0', animation: 'bounce 1.4s infinite ease-in-out 0.2s' }} />
                    <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#7B3FA0', animation: 'bounce 1.4s infinite ease-in-out 0.4s' }} />
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Quick replies */}
            {role === 'customer' && (
              <div style={{ display: 'flex', gap: '8px', padding: '10px 24px', overflowX: 'auto', background: 'rgba(123, 63, 160, 0.01)', borderTop: '1px solid rgba(45,0,77,0.04)' }} className="scroll-container">
                {quickReplies.map((qr, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickReply(qr)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '30px',
                      border: '1px solid rgba(123, 63, 160, 0.25)',
                      background: '#fff',
                      color: '#7B3FA0',
                      fontSize: '0.72rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                      outline: 'none'
                    }}
                    className="clickable"
                  >
                    {qr}
                  </button>
                ))}
              </div>
            )}

            {/* Message input area */}
            <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '16px 24px', borderTop: '1px solid rgba(45,0,77,0.06)', background: 'rgba(255,255,255,0.7)' }}>
              {attachment && (
                <div style={{ alignSelf: 'flex-start', background: 'rgba(123, 63, 160, 0.08)', border: '1px solid rgba(123, 63, 160, 0.2)', padding: '6px 12px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.72rem', color: 'var(--color-espresso)', fontWeight: 700 }}>
                  <Paperclip size={12} />
                  <span>Ready: {attachment.name}</span>
                  <button type="button" onClick={() => setAttachment(null)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontWeight: 'bold', color: '#ef4444' }}>✕</button>
                </div>
              )}
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(123, 63, 160, 0.08)', border: '1px solid rgba(123, 63, 160, 0.18)', cursor: 'pointer', color: '#7B3FA0' }} className="clickable">
                  <Paperclip size={16} />
                  <input type="file" onChange={handleFileChange} style={{ display: 'none' }} />
                </label>
                
                <input
                  type="text"
                  placeholder="Write message..."
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  style={{ flex: 1, padding: '10px 16px', borderRadius: '10px', border: '1px solid rgba(123, 63, 160, 0.18)', background: '#fff', fontSize: '0.8rem', color: 'var(--color-espresso)', outline: 'none', fontFamily: 'var(--font-sans)', fontWeight: 500 }}
                />
                
                <button
                  type="submit"
                  disabled={sending || (!inputText.trim() && !attachment)}
                  className="btn-premium btn-premium-solid"
                  style={{ padding: '10px 18px', borderRadius: '10px', height: '38px', cursor: 'pointer', opacity: (sending || (!inputText.trim() && !attachment)) ? 0.6 : 1 }}
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, padding: '40px', color: 'var(--color-mocha)', textAlign: 'center' }}>
            <MessageSquare size={44} style={{ opacity: 0.15, marginBottom: '16px' }} />
            <h3 className="text-editorial" style={{ fontSize: '1.6rem', fontWeight: 400, color: 'var(--color-espresso)' }}>Conversations Panel</h3>
            <p style={{ fontSize: '0.8rem', maxWidth: '320px', margin: '6px auto 0 auto', lineHeight: '1.4' }}>Select a chat sequence to begin discussing customization requests, licenses, and revisions.</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1.0); }
        }
      `}</style>

    </div>
  );
}
