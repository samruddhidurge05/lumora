import React, { useState } from 'react';
import { db, auth } from '../firebase';
import products from '../data/products.json';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Database, Zap, RefreshCw, AlertCircle, CheckCircle, HelpCircle } from 'lucide-react';

export default function SeederAdmin() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, running, completed, error
  const [logs, setLogs] = useState([]);
  const [uploaded, setUploaded] = useState(0);
  const [skipped, setSkipped] = useState(0);
  const [failed, setFailed] = useState(0);
  const [errorMessage, setErrorMessage] = useState('');

  const triggerSeed = async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      setStatus('error');
      setErrorMessage('You must be signed in to seed the database. Please sign up or log in first.');
      setLogs(['[Error] Unauthenticated. Seeding requires a signed-in user session.']);
      return;
    }

    setStatus('running');
    setUploaded(0);
    setSkipped(0);
    setFailed(0);
    setErrorMessage('');
    const newLogs = [`[Info] Authenticated as: ${currentUser.email}`, 'Starting Firestore seeder...'];
    setLogs(newLogs);

    try {
      for (let i = 0; i < products.length; i++) {
        const product = products[i];
        const percentage = Math.round(((i + 1) / products.length) * 100);

        if (!product.id) {
          setSkipped(prev => prev + 1);
          setLogs(prev => [...prev, `[Skip] Product at index ${i} is missing ID.`]);
          continue;
        }

        try {
          // Always overwrite to apply upgraded visual data
          const docRef = doc(db, 'products', product.id);

          // Map user requested schemas + frontend expected visualization structures
          const docData = {
            id: product.id,
            title: product.title,
            description: product.description || '',
            category: product.category || 'General',
            price: Number(product.price) || 0,
            rating: Number(product.rating) || 5.0,
            reviews: Number(product.reviews) || 0,
            badge: product.badge || '',
            compatibility: product.compatibility || (
              product.category === 'UI Kits' ? ["Figma", "Sketch"] :
              product.category === 'React Templates' ? ["React", "Tailwind CSS", "Vite"] :
              product.category === 'Next.js Templates' ? ["Next.js", "React", "Tailwind CSS"] :
              product.category === 'Canva Templates' ? ["Canva"] :
              product.category === 'Notion Templates' ? ["Notion"] :
              ["Web", "Figma"]
            ),
            version: product.version || 'v1.0.0',
            fileSize: product.fileSize || '38.4 MB',
            downloads: product.downloads || Math.floor(Math.random() * 150) + 12,
            file_url: product.file_url || 'https://firebasestorage.googleapis.com/v0/b/lumora-e6ddc.firebasestorage.app/o/products%2Fplaceholder.zip?alt=media',
            thumbnail: product.preview || product.thumbnail || '',
            preview: product.preview || product.thumbnail || '', // compatibility field
            featured: !!product.featured,
            trending: !!product.trending,
            newArrival: !!product.newArrival,
            tags: product.tags || [],
            highlights: product.highlights || [
              "Premium high-fidelity design source files",
              "Fully customizable layers and component variants",
              "Lifetime access license with free future revisions",
              "Comprehensive documentation and setup instructions"
            ],
            seller: {
              id: product.creatorId || product.vendor_id || 'sophia-vance',
              name: product.creatorName || product.seller || 'Sophia Vance'
            },
            creator: {
              id: product.creatorId || product.vendor_id || 'sophia-vance',
              name: product.creatorName || product.seller || 'Sophia Vance',
              avatar: (product.creatorId === 'marcus-kane' || product.vendor_id === 'marcus-kane' || product.seller === 'marcus-kane')
                ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80'
                : 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80',
              bio: 'Elite UI/UX designer and software architect producing digital assets.',
              banner: 'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?auto=format&fit=crop&w=1200&q=80',
              sales: product.downloads ? `${Math.round(product.downloads * 1.25)}+` : '450+',
              rating: `${product.rating || 4.8} ★`
            },
            createdAt: product.createdAt || new Date().toISOString()
          };

          await setDoc(docRef, docData);
          setUploaded(prev => prev + 1);
          setLogs(prev => [...prev, `[Success] [${percentage}%] Seeded "${product.title}"`]);
        } catch (itemErr) {
          console.error(itemErr);
          setFailed(prev => prev + 1);
          setLogs(prev => [...prev, `[Error] "${product.title}": ${itemErr.message}`]);
          if (itemErr.code === 'permission-denied') {
            setErrorMessage('Permission Denied: Please check your Firestore security rules.');
          }
        }
      }
      setStatus('completed');
    } catch (globalErr) {
      console.error(globalErr);
      setStatus('error');
      setErrorMessage(globalErr.message);
      setLogs(prev => [...prev, `[Fatal] ${globalErr.message}`]);
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'fixed', bottom: '20px', right: '20px', zIndex: 99999,
          background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
          color: '#fff', border: 'none', borderRadius: '50%',
          width: '50px', height: '50px', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(90,30,126,0.40)', cursor: 'pointer'
        }}
        title="Open Database Seeder"
      >
        <Database size={20} />
      </button>
    );
  }

  return (
    <div
      style={{
        position: 'fixed', bottom: '20px', right: '20px', zIndex: 99999,
        width: '320px', maxHeight: '480px', borderRadius: '20px',
        background: 'rgba(255, 255, 255, 0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        border: '1px solid rgba(123, 63, 160, 0.35)',
        boxShadow: '0 12px 40px rgba(90, 30, 126, 0.25)',
        padding: '20px', fontFamily: 'var(--font-sans)',
        display: 'flex', flexDirection: 'column', gap: '14px',
        color: '#3b0764'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(123, 63, 160, 0.15)', paddingBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: '#5A1E7E' }}>
          <Database size={16} />
          <span>Firestore Seeder Panel</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          style={{ background: 'none', border: 'none', fontSize: '0.8rem', cursor: 'pointer', color: '#7c3aed', fontWeight: 'bold' }}
        >
          ✕
        </button>
      </div>

      <div style={{ fontSize: '0.72rem', color: '#6b21a8', lineHeight: '1.4' }}>
        Seed products from <code>products.json</code>. Seeding requires an active authenticated session to pass firestore write security rules.
      </div>

      {status === 'running' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#7B3FA0', fontWeight: 'bold' }}>
          <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
          <span>Seeding in progress...</span>
        </div>
      )}

      {status === 'completed' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#10b981', fontWeight: 'bold' }}>
          <CheckCircle size={14} />
          <span>Seeding Completed!</span>
        </div>
      )}

      {errorMessage && (
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.20)', borderRadius: '10px', padding: '8px 12px', display: 'flex', gap: '8px', alignItems: 'flex-start', color: '#ef4444', fontSize: '0.7rem' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
          <div>{errorMessage}</div>
        </div>
      )}

      {/* Counters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', textAlign: 'center' }}>
        <div style={{ background: 'rgba(16, 185, 129, 0.08)', border: '1px solid rgba(16, 185, 129, 0.15)', borderRadius: '10px', padding: '6px' }}>
          <div style={{ fontSize: '0.55rem', color: '#059669', fontWeight: 700 }}>SEEDED</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#10b981' }}>{uploaded}</div>
        </div>
        <div style={{ background: 'rgba(107, 114, 128, 0.08)', border: '1px solid rgba(107, 114, 128, 0.15)', borderRadius: '10px', padding: '6px' }}>
          <div style={{ fontSize: '0.55rem', color: '#4b5563', fontWeight: 700 }}>SKIPPED</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#6b7280' }}>{skipped}</div>
        </div>
        <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.15)', borderRadius: '10px', padding: '6px' }}>
          <div style={{ fontSize: '0.55rem', color: '#dc2626', fontWeight: 700 }}>FAILED</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#ef4444' }}>{failed}</div>
        </div>
      </div>

      {/* Logs Window */}
      <div style={{
        background: '#1e1e24', color: '#c084fc',
        fontFamily: 'monospace', fontSize: '0.65rem',
        padding: '10px', borderRadius: '10px',
        height: '110px', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: '4px',
        border: '1px solid rgba(123, 63, 160, 0.20)'
      }}>
        {logs.length === 0 ? (
          <span style={{ color: '#6b7280' }}>Waiting to run...</span>
        ) : (
          logs.map((log, i) => <div key={i}>{log}</div>)
        )}
      </div>

      <button
        onClick={triggerSeed}
        disabled={status === 'running'}
        style={{
          background: 'linear-gradient(135deg, #7B3FA0, #5A1E7E)',
          color: '#fff', border: 'none', borderRadius: '12px',
          padding: '10px', fontWeight: 700, fontSize: '0.8rem',
          cursor: status === 'running' ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 14px rgba(90, 30, 126, 0.30)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          outline: 'none', transition: 'all 0.2s'
        }}
      >
        <Zap size={14} fill="currentColor" />
        {status === 'running' ? 'Uploading...' : 'Seed Firestore Database'}
      </button>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
