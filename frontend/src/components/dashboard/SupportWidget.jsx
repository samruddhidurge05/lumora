import React, { useState } from 'react';
import { MessageCircle, X, Send, User, Bot } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function SupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { id: 1, sender: 'bot', text: 'Hi there! 👋 How can we help you today?' }
  ]);
  const [input, setInput] = useState('');
  const { accentTheme } = useApp();

  const getThemeAccentColor = () => {
    switch (accentTheme) {
      case 'Violet': return '#7B3FA0';
      case 'Lavender': return 'var(--accent-violet)';
      case 'Deep': return 'var(--purple-700)';
      default: return '#7B3FA0';
    }
  };

  const handleSend = (e) => {
    e.preventDefault();
    if (!input.trim()) return;
    
    const userMsg = { id: Date.now(), sender: 'user', text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    
    // Simulate bot response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { id: Date.now(), sender: 'bot', text: 'Thanks for reaching out! Our team will get back to you shortly.' }
      ]);
    }, 1000);
  };

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 1000 }}>
      {isOpen ? (
        <div 
          style={{ 
            width: '320px', 
            height: '420px', 
            background: 'rgba(255, 255, 255, 0.65)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            borderRadius: '20px',
            border: '1px solid rgba(255, 255, 255, 0.45)',
            boxShadow: '0 12px 40px rgba(90, 30, 126, 0.10)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            animation: 'slideUp 0.3s ease-out'
          }}
        >
          {/* Header */}
          <div style={{ 
            padding: '16px', 
            background: `linear-gradient(135deg, ${getThemeAccentColor()}, #5A1E7E)`,
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Bot size={20} />
              <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Lumora Support</span>
            </div>
            <button 
              onClick={() => setIsOpen(false)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={18} />
            </button>
          </div>
          
          {/* Messages */}
          <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                style={{ 
                  alignSelf: msg.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '8px'
                }}
              >
                {msg.sender === 'bot' && <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(123, 63, 160, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: getThemeAccentColor() }}><Bot size={14} /></div>}
                <div style={{ 
                  padding: '10px 14px', 
                  borderRadius: '16px', 
                  borderBottomLeftRadius: msg.sender === 'bot' ? '4px' : '16px',
                  borderBottomRightRadius: msg.sender === 'user' ? '4px' : '16px',
                  background: msg.sender === 'user' ? getThemeAccentColor() : '#f3f4f6',
                  color: msg.sender === 'user' ? '#fff' : '#1f2937',
                  fontSize: '0.85rem',
                  lineHeight: '1.4'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
          
          {/* Input */}
          <form onSubmit={handleSend} style={{ padding: '12px', borderTop: '1px solid rgba(123, 63, 160, 0.12)', display: 'flex', gap: '8px', background: 'rgba(255, 255, 255, 0.45)' }}>
            <input 
              type="text" 
              placeholder="Type a message..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{ 
                flex: 1, 
                padding: '10px 14px', 
                borderRadius: '20px', 
                border: '1px solid rgba(123, 63, 160, 0.20)',
                background: 'rgba(255, 255, 255, 0.50)',
                outline: 'none',
                fontSize: '0.85rem'
              }} 
            />
            <button 
              type="submit"
              style={{ 
                width: '40px', 
                height: '40px', 
                borderRadius: '50%', 
                background: getThemeAccentColor(), 
                color: '#fff',
                border: 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      ) : (
        <button 
          onClick={() => setIsOpen(true)}
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${getThemeAccentColor()}, #5A1E7E)`,
            color: '#fff',
            border: 'none',
            boxShadow: '0 8px 24px rgba(123, 63, 160, 0.4)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'transform 0.2s',
            animation: 'bounce 2s infinite'
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          <MessageCircle size={28} />
        </button>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
