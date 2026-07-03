import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { AlertCircle, CheckCircle, Image, Star, ArrowLeft, Save, FileText, Upload } from 'lucide-react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useVendorProducts } from '../../hooks/useVendorData';
import { backendFetch } from '../../utils/api';
import { uploadFile } from '../../services/storageService';

const CATEGORIES = [
  'UI Kits','Icon Packs','Templates','Fonts','Illustrations','Mockups',
  'Plugins','3D Assets','Photography','Music','Website Templates',
  'Mobile App Designs','Design Assets','E-books','Notion Templates',
  'Productivity Tools','Social Media Kits','AI Tools','React Templates',
];

/* ── Compress and upload preview image to Firebase Storage ───────────────── */
async function uploadImageToFirebase(file, maxPx = 800, quality = 0.80) {
  // 1. Compress client-side
  const compressed = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = ev => {
      const img = new window.Image();
      img.onload = () => {
        let w = img.width, h = img.height;
        if (w > h && w > maxPx) { h = Math.round(h * maxPx / w); w = maxPx; }
        else if (h > maxPx)     { w = Math.round(w * maxPx / h); h = maxPx; }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Compression failed')); return; }
          resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // 2. Upload to Firebase Storage via existing storageService.js
  const uid  = localStorage.getItem('lumora_backend_uid') || 'vendor';
  const path = `product-previews/${uid}/${Date.now()}_${compressed.name}`;
  return await uploadFile(compressed, path);  // returns Firebase download URL
}

function Stars({ rating }) {
  const r = Math.round(Number(rating) || 0);
  return (
    <span style={{ display:'inline-flex', gap:2 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={13} fill={i <= r ? '#f59e0b' : 'none'} stroke="#f59e0b" />
      ))}
    </span>
  );
}

export default function EditProduct() {
  const navigate  = useNavigate();
  const { id }    = useParams();
  const { state } = useLocation();

  const { updateProduct } = useVendorProducts();

  const [product,   setProduct]   = useState(state?.product || null);
  const [loading,   setLoading]   = useState(!state?.product);
  const [saving,    setSaving]    = useState(false);
  const [saved,     setSaved]     = useState(false);
  const [saveError, setSaveError] = useState('');
  const [activeTab, setActiveTab] = useState('details');
  const [reviews,   setReviews]   = useState([]);
  const [uploadingPrev, setUploadingPrev] = useState(false);
  const [previewPct,    setPreviewPct]    = useState(0);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [filePct,        setFilePct]       = useState(0);
  const previewRef = useRef(null);
  const fileRef    = useRef(null);

  const [form, setForm] = useState({
    title:'', category:'', price:'', description:'',
    tags:'', license:'', version:'1.0.0', status:'published',
    featured:false, trending:false, preview:'',
    affiliate_enabled: false,
    commission_type: 'percentage',
    commission_value: '',
    file_url:'',
    fileName:'',
    file_size:'',
  });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  /* ── Load product from backend if not passed via router state ──────── */
  useEffect(() => {
    if (product) {
      populateForm(product);
      setLoading(false);
      loadReviews(product.id);
      return;
    }
    if (!id) { setLoading(false); return; }

    backendFetch(`/products/${id}`)
      .then(p => {
        setProduct(p);
        populateForm(p);
        loadReviews(p.id);
      })
      .catch(err => setSaveError(err.message))
      .finally(() => setLoading(false));
  }, [id]);

  function populateForm(p) {
    setForm({
      title:       p.title || '',
      category:    p.category || '',
      price:       String(p.price ?? ''),
      description: p.description || '',
      tags:        Array.isArray(p.tags) ? p.tags.join(', ') : (p.tags || ''),
      license:     p.license || '',
      version:     p.version || '1.0.0',
      status:      p.status || 'published',
      featured:    p.featured || false,
      trending:    p.trending || false,
      preview:     p.preview || p.thumbnail || '',
      affiliate_enabled: p.affiliate_enabled || false,
      commission_type:   p.commission_type || 'percentage',
      commission_value:  p.commission_value !== undefined ? String(p.commission_value) : '',
      file_url:    p.file_url || '',
      fileName:    p.file_url ? (p.file_url.split('/').pop().replace(/^\d+_/, '') || 'Product File') : '',
      file_size:   p.file_size || '',
    });
  }

  async function loadReviews(productId) {
    try {
      const data = await backendFetch(`/reviews/product/${productId}`);
      if (Array.isArray(data)) setReviews(data);
    } catch {
      // reviews not critical
    }
  }

  /* ── Preview image: compress then upload to Firebase Storage ──────── */
  const handlePreviewChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPrev(true); setPreviewPct(20);
    setSaveError('');
    try {
      const url = await uploadImageToFirebase(file, 800, 0.80);
      setPreviewPct(100);
      set('preview', url);
    } catch (err) {
      setSaveError(`Image upload failed: ${err.message}`);
    } finally {
      setTimeout(() => setUploadingPrev(false), 300);
    }
  };

  /* ── Digital file: upload to backend → store URL in DB ─── */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError('');
    setUploadingFile(true); setFilePct(5);
    try {
      const uid  = localStorage.getItem('lumora_backend_uid') || 'vendor';
      const ts   = Date.now();
      const path = `product-files/${uid}/${ts}_${file.name}`;
      const url = await uploadFile(file, path, (pct) => {
        setFilePct(Math.round(pct));
      });
      setFilePct(100);
      set('file_url', url);
      set('fileName', file.name);
      set('file_size', `${Math.round(file.size / 1024)} KB`);
    } catch (err) {
      setSaveError(`File upload failed: ${err.message}`);
    } finally {
      setTimeout(() => setUploadingFile(false), 300);
    }
  };

  /* ── Save ──────────────────────────────────────────────────────────── */
  const handleSave = async (e) => {
    e?.preventDefault();
    if (!product?.id) return;
    if (!form.title.trim()) { setSaveError('Title is required.'); return; }
    if (form.price !== '' && (isNaN(Number(form.price)) || Number(form.price) < 0)) {
      setSaveError('Price must be a non-negative number.'); return;
    }

    if (form.affiliate_enabled) {
      const commVal = Number(form.commission_value);
      if (form.commission_value === '' || isNaN(commVal)) {
        setSaveError('Please enter a valid commission value.');
        return;
      }
      if (commVal < 0) {
        setSaveError('Commission value cannot be negative.');
        return;
      }
      if (form.commission_type === 'percentage') {
        if (commVal > 100) {
          setSaveError('Commission percentage must be between 0 and 100.');
          return;
        }
      } else if (form.commission_type === 'fixed') {
        const prodPrice = Number(form.price) || 0;
        if (commVal > prodPrice) {
          setSaveError('Fixed commission cannot exceed the product price.');
          return;
        }
      }
    }

    setSaving(true); setSaveError(''); setSaved(false);
    try {
      await updateProduct(product.id, {
        ...form,
        price: Number(form.price) || 0,
        tags:  form.tags.split(',').map(t => t.trim()).filter(Boolean),
        commission_value: form.affiliate_enabled ? (Number(form.commission_value) || 0.0) : 0.0,
      });
      setSaved(true);
      setTimeout(() => navigate('/vendor/products'), 1200);
    } catch (e) {
      setSaveError(e.message || 'Failed to update product.');
    } finally {
      setSaving(false);
    }
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (Number(r.rating) || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  /* ── Loading ─────────────────────────────────────────────────────── */
  if (loading) {
    return (
      <VendorLayout activePage="products" title="Edit Product" subtitle="Loading…">
        <div style={{ textAlign:'center', padding:'60px 24px' }}>
          <div className="v-empty-icon" style={{ fontSize:36 }}>⏳</div>
          <div style={{ color:'var(--v-text3)' }}>Loading product…</div>
        </div>
      </VendorLayout>
    );
  }

  if (!product && !loading) {
    return (
      <VendorLayout activePage="products" title="Product Not Found">
        <div style={{ textAlign:'center', padding:'60px 24px' }}>
          <div className="v-empty-icon" style={{ fontSize:48 }}>😕</div>
          <div style={{ fontFamily:'var(--v-serif)', fontSize:22, color:'var(--v-dark)', marginBottom:16 }}>Product not found</div>
          <button className="v-btn v-btn-secondary" onClick={() => navigate('/vendor/products')} style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
            <ArrowLeft size={14} /> Back to Products
          </button>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout activePage="products"
      title="Edit Product"
      subtitle={product?.title || 'Edit product details'}
      actions={
        <div style={{ display:'flex', gap:10 }}>
          <button className="v-btn v-btn-secondary" onClick={() => navigate('/vendor/products')} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <ArrowLeft size={13} /> Back
          </button>
          <button className="v-btn v-btn-primary" onClick={handleSave} disabled={saving} style={{ display:'flex', alignItems:'center', gap:5 }}>
            <Save size={13} /> {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      }
    >

      {saved && (
        <div style={{ padding:'12px 16px', borderRadius:12, marginBottom:20, background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.22)', color:'#16a34a', fontSize:13, display:'flex', gap:8, alignItems:'center' }}>
          <CheckCircle size={15} /> Product updated! Redirecting…
        </div>
      )}
      {saveError && (
        <div style={{ padding:'12px 16px', borderRadius:12, marginBottom:20, background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.20)', color:'#dc2626', fontSize:13, display:'flex', gap:8, alignItems:'flex-start' }}>
          <AlertCircle size={15} style={{ flexShrink:0, marginTop:1 }} /> {saveError}
        </div>
      )}

      {/* Tabs */}
      <div className="v-tabs" style={{ marginBottom:24 }}>
        {[
          { id:'details', label:'✏️ Edit Details' },
          { id:'reviews', label:`💬 Reviews (${reviews.length})` },
        ].map(t => (
          <button key={t.id} className={`v-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* ── Details tab ─────────────────────────────────────────────── */}
      {activeTab === 'details' && (
        <form onSubmit={handleSave}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:20 }} className="v-edit-grid">
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              <div className="v-card v-card-pad">
                <div className="v-section-title" style={{ marginBottom:20 }}>Product Details</div>
                <div className="v-field">
                  <label className="v-label">Product Title *</label>
                  <input className="v-input" value={form.title} onChange={e => set('title', e.target.value)} required />
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                  <div className="v-field">
                    <label className="v-label">Category</label>
                    <select className="v-select" value={form.category} onChange={e => set('category', e.target.value)}>
                      <option value="">Select category</option>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div className="v-field">
                    <label className="v-label">Price (₹)</label>
                    <input className="v-input" type="number" min="0" step="1"
                      value={form.price} onChange={e => set('price', e.target.value)} />
                  </div>
                </div>
                <div className="v-field">
                  <label className="v-label">Description</label>
                  <textarea className="v-textarea" rows={5}
                    value={form.description} onChange={e => set('description', e.target.value)} />
                </div>
                <div className="v-field">
                  <label className="v-label">Tags (comma-separated)</label>
                  <input className="v-input" placeholder="ui, figma, react"
                    value={form.tags} onChange={e => set('tags', e.target.value)} />
                </div>
              </div>

              {/* Affiliate Settings */}
              <div className="v-card v-card-pad">
                <div className="v-section-title" style={{ marginBottom: 20 }}>Affiliate Settings</div>

                <div className="v-field" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0' }}>
                  <div>
                    <label className="v-label" style={{ marginBottom: 2 }}>Enable Affiliate Marketing</label>
                    <div className="v-field-hint" style={{ marginTop: 0 }}>Allow affiliates to promote this product and earn commission.</div>
                  </div>
                  <label className="v-switch" style={{ position: 'relative', display: 'inline-block', width: 44, height: 24, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.affiliate_enabled}
                      onChange={e => set('affiliate_enabled', e.target.checked)}
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span className="v-slider round" style={{
                      position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: form.affiliate_enabled ? 'var(--v-purple)' : '#ccc',
                      transition: '.2s', borderRadius: 24,
                    }}>
                      <span style={{
                        position: 'absolute', content: '""', height: 18, width: 18, left: 3, bottom: 3,
                        backgroundColor: 'white', transition: '.2s', borderRadius: '50%',
                        transform: form.affiliate_enabled ? 'translateX(20px)' : 'translateX(0)'
                      }} />
                    </span>
                  </label>
                </div>

                {form.affiliate_enabled && (
                  <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <div className="v-field">
                        <label className="v-label">Commission Type</label>
                        <select
                          className="v-select"
                          value={form.commission_type}
                          onChange={e => set('commission_type', e.target.value)}
                        >
                          <option value="percentage">Percentage (%)</option>
                          <option value="fixed">Fixed Amount (₹)</option>
                        </select>
                      </div>
                      <div className="v-field">
                        <label className="v-label">Commission Value</label>
                        <input
                          className="v-input"
                          type="number"
                          placeholder={form.commission_type === 'percentage' ? '10' : '50'}
                          min="0"
                          value={form.commission_value}
                          onChange={e => set('commission_value', e.target.value)}
                        />
                      </div>
                    </div>

                    {/* Calculations Preview */}
                    {form.price && form.commission_value !== '' && !isNaN(Number(form.price)) && !isNaN(Number(form.commission_value)) && (
                      <div style={{
                        padding: '14px', borderRadius: '10px',
                        background: 'rgba(90,30,126,0.04)',
                        border: '1px solid rgba(196,148,230,0.18)',
                        fontSize: '0.78rem', color: 'var(--v-text2)',
                        display: 'flex', flexDirection: 'column', gap: 6
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Product Price:</span>
                          <span style={{ fontWeight: 700, color: 'var(--v-deep)' }}>₹{Number(form.price).toLocaleString()}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>Affiliate Commission:</span>
                          <span style={{ fontWeight: 700, color: 'var(--v-purple)' }}>
                            {form.commission_type === 'percentage'
                              ? `₹${Math.round((Number(form.price) * Number(form.commission_value)) / 100).toLocaleString()} (${form.commission_value}%)`
                              : `₹${Number(form.commission_value).toLocaleString()} (Fixed)`
                            }
                          </span>
                        </div>
                        <div style={{ borderTop: '1px dashed rgba(196,148,230,0.22)', margin: '4px 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', fontWeight: 800 }}>
                          <span style={{ color: 'var(--v-deep)' }}>Estimated Vendor Earnings:</span>
                          <span style={{ color: '#16a34a' }}>
                            ₹{Math.max(0, Math.round(Number(form.price) - (form.commission_type === 'percentage'
                              ? (Number(form.price) * Number(form.commission_value)) / 100
                              : Number(form.commission_value)
                            ))).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Product File */}
              <div className="v-card v-card-pad">
                <div className="v-section-title" style={{ marginBottom:20 }}>Product File</div>

                <div className="v-field">
                  <label className="v-label">Product File (ZIP / PDF / Figma)</label>
                  <input type="file" ref={fileRef} style={{ display:'none' }} onChange={handleFileChange} />
                  {form.file_url ? (
                    <div style={{ padding:'12px 16px', borderRadius:10, background:'rgba(34,197,94,0.08)', border:'1px solid rgba(34,197,94,0.25)', display:'flex', alignItems:'center', gap:10 }}>
                      <FileText size={18} style={{ color:'#16a34a', flexShrink:0 }} />
                      <span style={{ flex:1, fontSize:13, color:'#15803d', fontWeight:600, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                        {form.fileName || 'File uploaded'}
                      </span>
                      <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ color:'#dc2626' }}
                        onClick={() => { set('file_url',''); set('fileName',''); }}>Remove</button>
                    </div>
                  ) : (
                    <div onClick={() => fileRef.current?.click()}
                      style={{ border:'2px dashed rgba(184,134,208,0.40)', borderRadius:12, padding:'28px 20px', textAlign:'center', cursor:'pointer', background:'rgba(255,255,255,0.40)', transition:'border-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.borderColor = '#B886D0'}
                      onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(184,134,208,0.40)'}>
                      {uploadingFile ? (
                        <>
                          <Upload size={24} style={{ color:'var(--v-purple)', margin:'0 auto 8px', display:'block', animation:'bounce 0.6s ease-in-out infinite alternate' }} />
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--v-purple)' }}>Uploading… {filePct}%</div>
                          <div className="v-progress-track" style={{ height:5, maxWidth:200, margin:'10px auto 0' }}>
                            <div className="v-progress-fill" style={{ width:`${filePct}%` }} />
                          </div>
                        </>
                      ) : (
                        <>
                          <Upload size={24} style={{ color:'var(--v-text3)', margin:'0 auto 8px', display:'block' }} />
                          <div style={{ fontSize:13, color:'var(--v-text2)', fontWeight:500 }}>Click to upload your product file</div>
                          <div style={{ fontSize:11, color:'var(--v-text3)', marginTop:4 }}>ZIP, PDF, Figma, Sketch, MP4 — stored in local storage</div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Preview image */}
              <div className="v-card v-card-pad">
                <div className="v-section-title" style={{ marginBottom:16 }}>Preview Image</div>
                <input type="file" accept="image/*" ref={previewRef} style={{ display:'none' }} onChange={handlePreviewChange} />
                {form.preview ? (
                  <div>
                    <div style={{ height:200, borderRadius:12, overflow:'hidden', marginBottom:12, border:'1px solid rgba(196,148,230,0.25)' }}>
                      <img src={form.preview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" className="v-btn v-btn-secondary v-btn-sm" style={{ flex:1 }} onClick={() => previewRef.current?.click()}>
                        <Image size={12} /> Change Image
                      </button>
                      <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ color:'#dc2626' }} onClick={() => set('preview','')}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => !uploadingPrev && previewRef.current?.click()}
                    style={{ border:'2px dashed rgba(184,134,208,0.35)', borderRadius:12, padding:'32px 20px', textAlign:'center', cursor:'pointer', background:'rgba(255,255,255,0.30)' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#B886D0'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(184,134,208,0.35)'}>
                    {uploadingPrev ? (
                      <>
                        <Image size={24} style={{ color:'var(--v-purple)', margin:'0 auto 8px', display:'block' }} />
                        <div style={{ fontSize:13, color:'var(--v-purple)', fontWeight:600 }}>Processing… {previewPct}%</div>
                      </>
                    ) : (
                      <>
                        <Image size={24} style={{ color:'var(--v-text3)', margin:'0 auto 8px', display:'block' }} />
                        <div style={{ fontSize:13, color:'var(--v-text2)' }}>Click to upload a new preview image</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right panel */}
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
              <div className="v-card v-card-pad">
                <div className="v-section-title" style={{ marginBottom:16 }}>Publish Settings</div>

                <div className="v-field">
                  <label className="v-label">Status</label>
                  <select className="v-select" value={form.status} onChange={e => set('status', e.target.value)}>
                    <option value="published">Published (Live)</option>
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                  </select>
                </div>

                <div className="v-field">
                  <label className="v-label">License Type</label>
                  <select className="v-select" value={form.license} onChange={e => set('license', e.target.value)}>
                    <option value="">Select license</option>
                    <option value="Personal Use">Personal Use</option>
                    <option value="Commercial Use">Commercial Use</option>
                    <option value="Extended License">Extended License</option>
                  </select>
                </div>

                <div className="v-field">
                  <label className="v-label">Version</label>
                  <input className="v-input" placeholder="1.0.0"
                    value={form.version} onChange={e => set('version', e.target.value)} />
                </div>

                <div className="v-divider" />

                {[
                  { k:'featured', label:'Featured product', sub:'Show on homepage' },
                  { k:'trending', label:'Mark as trending',  sub:'Show trending badge' },
                ].map(opt => (
                  <label key={opt.k} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', padding:'8px 0' }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:600, color:'var(--v-dark)' }}>{opt.label}</div>
                      <div style={{ fontSize:11, color:'var(--v-text3)' }}>{opt.sub}</div>
                    </div>
                    <input type="checkbox" checked={form[opt.k]} onChange={e => set(opt.k, e.target.checked)}
                      style={{ accentColor:'#B886D0', width:16, height:16 }} />
                  </label>
                ))}

                <div className="v-divider" />
                <button type="submit" className="v-btn v-btn-primary v-btn-lg" style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}
                  disabled={saving}>
                  <Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>

              {/* Product Stats */}
              <div className="v-card v-card-pad">
                <div className="v-section-title" style={{ marginBottom:14 }}>Product Stats</div>
                {[
                  { label:'Downloads',  value: (product?.downloads || 0).toLocaleString() },
                  { label:'Rating',     value: `${Number(product?.rating || 0).toFixed(1)} / 5.0` },
                  { label:'Reviews',    value: String(reviews.length) },
                  { label:'Status',     value: product?.status || '—' },
                  { label:'Product ID', value: `#${product?.id}` },
                ].map(s => (
                  <div key={s.label} style={{ display:'flex', justifyContent:'space-between', padding:'8px 0', borderBottom:'1px solid rgba(78,59,49,0.06)', fontSize:13 }}>
                    <span style={{ color:'var(--v-text3)' }}>{s.label}</span>
                    <span style={{ fontWeight:600, color:'var(--v-dark)' }}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </form>
      )}

      {/* ── Reviews tab ─────────────────────────────────────────────── */}
      {activeTab === 'reviews' && (
        <div>
          <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:20, marginBottom:24 }}>
            <div className="v-card v-card-pad" style={{ textAlign:'center' }}>
              <div style={{ fontFamily:'var(--v-serif)', fontSize:52, color:'var(--v-dark)', lineHeight:1 }}>{avgRating}</div>
              <Stars rating={avgRating} />
              <div style={{ fontSize:12, color:'var(--v-text3)', marginTop:8 }}>{reviews.length} review{reviews.length !== 1 ? 's' : ''}</div>
            </div>
            <div className="v-card v-card-pad">
              <div className="v-section-title" style={{ marginBottom:14 }}>Rating Breakdown</div>
              {[5,4,3,2,1].map(star => {
                const count = reviews.filter(r => Math.round(Number(r.rating)) === star).length;
                const pct   = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                return (
                  <div key={star} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:8 }}>
                    <span style={{ fontSize:12, color:'var(--v-text2)', width:12, textAlign:'right' }}>{star}</span>
                    <Star size={12} fill="#f59e0b" stroke="#f59e0b" />
                    <div className="v-progress-track" style={{ flex:1 }}>
                      <div className="v-progress-fill" style={{ width:`${pct}%`,
                        background: star >= 4 ? 'linear-gradient(90deg,#B886D0,#7B3FA0)' : star === 3 ? 'linear-gradient(90deg,#fbbf24,#d97706)' : 'linear-gradient(90deg,#f87171,#dc2626)' }} />
                    </div>
                    <span style={{ fontSize:12, color:'var(--v-text3)', width:18 }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="v-card">
            <div style={{ padding:'18px 24px', borderBottom:'1px solid var(--v-border)' }}>
              <div className="v-section-title">Customer Reviews</div>
            </div>
            {reviews.length === 0 ? (
              <div className="v-empty">
                <div className="v-empty-icon">💬</div>
                <div className="v-empty-title">No reviews yet</div>
                <div className="v-empty-sub">Reviews will appear here once customers purchase this product.</div>
              </div>
            ) : (
              <div>
                {reviews.map(r => (
                  <div key={r.id} style={{ padding:'18px 24px', borderBottom:'1px solid rgba(184,134,208,0.10)' }}>
                    <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
                      <div className="v-avatar v-avatar-md" style={{ background:'linear-gradient(135deg,#B886D0,#7B3FA0)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, width:36, height:36, borderRadius:'50%', flexShrink:0 }}>
                        {String(r.user_id || 'C')[0].toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                          <span style={{ fontWeight:600, color:'var(--v-dark)', fontSize:13 }}>Customer #{r.user_id}</span>
                          <Stars rating={r.rating} />
                          {r.verified && <span className="v-badge v-badge-green" style={{ fontSize:10 }}>✓ Verified</span>}
                          <span style={{ fontSize:11, color:'var(--v-text3)', marginLeft:'auto' }}>
                            {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                          </span>
                        </div>
                        <p style={{ fontSize:13.5, color:'var(--v-text)', lineHeight:1.55, margin:0 }}>{r.comment || 'No comment.'}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media(max-width:900px){ .v-edit-grid{ grid-template-columns: 1fr !important; } }
      `}</style>
    </VendorLayout>
  );
}
