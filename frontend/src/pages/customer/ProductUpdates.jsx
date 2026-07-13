import React, { useState, useEffect } from 'react';
import { RefreshCw, Download, Layers, ShieldCheck, Clock, Check, AlertCircle } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import { getProductVersions } from '../../services/versionService';
import { backendFetch } from '../../utils/api';

export default function ProductUpdates() {
  const { ownedProducts, products } = useApp();
  const { user } = useAuth();
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const ownedItems = products.filter(p => ownedProducts.map(String).includes(String(p.id)));

  useEffect(() => {
    if (ownedItems.length > 0 && !selectedProduct) {
      setSelectedProduct(ownedItems[0]);
    }
  }, [ownedItems, selectedProduct]);

  // 2. Fetch product updates & Connect existing APIs
  const fetchVersions = async () => {
    if (!selectedProduct) return;
    setLoading(true);
    setError(null);
    try {
      // Connect to existing FastAPI backend
      const backendData = await backendFetch(`/versions/${selectedProduct.id}`).catch(err => {
        console.warn('Backend versions fetch notice:', err);
        return null;
      });

      if (Array.isArray(backendData)) {
        setVersions(backendData);
        return;
      }

      // Firestore service fallback
      const data = await getProductVersions(selectedProduct.id);
      setVersions(data || []);
    } catch (err) {
      console.error('Error fetching product versions:', err);
      setError('Could not load version history for this asset.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersions();
  }, [selectedProduct]);

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      // Trigger download link
      const link = document.createElement('a');
      link.href = selectedProduct?.file_url || `/downloads/product-${selectedProduct.id}.zip`;
      link.setAttribute('download', `${selectedProduct.title.toLowerCase().replace(/\s+/g, '-')}-latest.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    }, 1500);
  };

  if (ownedItems.length === 0) {
    return (
      <div className="glass-card" style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', borderRadius: '20px' }}>
        <div style={{ width: '50px', height: '50px', borderRadius: '50%', background: 'rgba(123, 63, 160, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7B3FA0' }}>
          <Layers size={22} />
        </div>
        <div>
          <h3 className="text-sans" style={{ fontWeight: 700, color: 'var(--color-espresso)', fontSize: '1rem' }}>No products owned yet</h3>
          <p style={{ color: 'var(--color-mocha)', fontSize: '0.8rem', marginTop: '4px' }}>Visit the marketplace to buy digital products and view updates.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: '32px', minHeight: '400px' }} className="updates-layout">
      {/* Sidebar - Owned products */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div style={{ fontSize: '0.68rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em', marginBottom: '8px' }}>
          OWNED PRODUCTS
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {ownedItems.map(p => {
            const isSelected = selectedProduct?.id === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedProduct(p)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px',
                  borderRadius: '12px',
                  border: isSelected ? '1px solid rgba(123, 63, 160, 0.25)' : 'none',
                  background: isSelected ? 'rgba(123, 63, 160, 0.05)' : 'transparent',
                  color: isSelected ? '#7B3FA0' : 'var(--color-mocha)',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  outline: 'none',
                  width: '100%'
                }}
              >
                <img src={p.preview || p.thumbnail || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&q=70'} alt="" style={{ width: '28px', height: '28px', borderRadius: '6px', objectFit: 'cover' }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{p.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main panel - Version History */}
      {selectedProduct && (
        <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid rgba(45,0,77,0.06)', paddingBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '0.62rem', padding: '2px 8px', borderRadius: '4px', background: 'rgba(123, 63, 160, 0.08)', color: '#7B3FA0', fontWeight: 700, textTransform: 'uppercase' }}>
                {selectedProduct.category || 'Digital Asset'}
              </span>
              <h2 className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, marginTop: '6px', color: 'var(--color-espresso)' }}>
                {selectedProduct.title}
              </h2>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn-premium btn-premium-solid"
                style={{ padding: '10px 20px', fontSize: '0.75rem', borderRadius: '10px', cursor: 'pointer' }}
              >
                {downloading ? (
                  <>
                    <RefreshCw size={13} className="spin" style={{ animation: 'spin 2s linear infinite' }} /> Decrypting...
                  </>
                ) : (
                  <>
                    <Download size={13} /> Download Latest ({selectedProduct.version || 'v1.0.0'})
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Handle error banner */}
          {error && !loading && (
            <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', color: '#DC2626', fontSize: '0.8rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={15} />
                <span>{error}</span>
              </div>
              <button onClick={fetchVersions} style={{ border: 'none', background: 'none', color: '#DC2626', fontWeight: 700, cursor: 'pointer', fontSize: '0.75rem' }}>Retry</button>
            </div>
          )}

          {/* 3. Display update history & timeline */}
          <div>
            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--color-mocha)', letterSpacing: '0.08em', marginBottom: '16px' }}>
              VERSION HISTORY & CHANGELOGS
            </div>

            {loading ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-mocha)', fontSize: '0.8rem' }}>
                <RefreshCw size={14} className="spin" style={{ animation: 'spin 2s linear infinite' }} />
                <span>Fetching release logs...</span>
              </div>
            ) : versions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {versions.map((ver, idx) => (
                  <div key={ver.id || idx} style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: ver.is_major ? '#7B3FA0' : 'rgba(123, 63, 160, 0.4)', marginTop: '4px' }} />
                      {idx !== versions.length - 1 && <div style={{ width: '1px', height: '60px', background: 'rgba(45,0,96,0.06)', marginTop: '4px' }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--color-espresso)' }}>{ver.version_number || ver.version || 'v1.0.0'}</span>
                        {ver.is_major && (
                          <span style={{ fontSize: '0.55rem', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444', fontWeight: 700, border: '1px solid rgba(239,68,68,0.12)' }}>MAJOR UPDATE</span>
                        )}
                        <span style={{ fontSize: '0.68rem', color: 'var(--color-mocha)', fontWeight: 500 }}>
                          • {ver.created_at ? new Date(ver.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                        </span>
                      </div>
                      <p style={{ fontSize: '0.78rem', color: 'var(--color-mocha)', marginTop: '6px', lineHeight: '1.5', whiteSpace: 'pre-line', fontWeight: 500 }}>
                        {ver.changelog || ver.notes || 'Performance enhancements, security updates, and bug fixes.'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ padding: '24px', border: '1px dashed rgba(123,63,160,0.15)', borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--color-mocha)' }}>
                <AlertCircle size={16} />
                <span style={{ fontSize: '0.78rem', fontWeight: 500 }}>No version history recorded yet. Default baseline v1.0.0 active.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
