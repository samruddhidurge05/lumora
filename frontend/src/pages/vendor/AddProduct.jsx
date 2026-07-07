import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CheckCircle, Upload, Image, FileText } from 'lucide-react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useVendorProducts } from '../../hooks/useVendorData';
import { uploadFile } from '../../services/storageService';

const CATEGORIES = [
  'UI Kits','Icon Packs','Templates','Fonts','Illustrations','Mockups',
  'Plugins','3D Assets','Photography','Music','Website Templates',
  'Mobile App Designs','Design Assets','E-books','Notion Templates',
  'Productivity Tools','Social Media Kits','AI Tools','React Templates',
];

/* ── Upload a file to Firebase Storage, return a public download URL ─────── */
async function uploadToFirebase(file, folder, onProgress) {
  const uid   = localStorage.getItem('lumora_backend_uid') || 'vendor';
  const ext   = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const ts    = Date.now();
  const path  = `${folder}/${uid}/${ts}_${file.name}`;
  const url   = await uploadFile(file, path, onProgress);
  return {
    url,
    relativeUrl: path,
    filename:    file.name,
    sizeKb:      Math.round(file.size / 1024),
  };
}

/* ── Compress image in-browser before uploading ──────────────────────────── */
function compressImageToBlob(file, maxPx = 800, quality = 0.80) {
  return new Promise((resolve, reject) => {
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
          if (!blob) { reject(new Error('Canvas toBlob returned null')); return; }
          const named = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
          resolve(named);
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
      img.src = ev.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/* ── Completion tracker ──────────────────────────────────────────────────── */
function CompletionScore({ fields }) {
  const total  = Object.keys(fields).length;
  const filled = Object.values(fields).filter(v => v && String(v).trim() !== '').length;
  const pct    = Math.round((filled / total) * 100);
  const cls    = pct < 40 ? 'amber' : pct < 80 ? '' : 'green';
  return (
    <div className="v-card v-card-pad" style={{ marginBottom:24 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
        <div>
          <div style={{ fontWeight:600, color:'var(--v-dark)', fontSize:14 }}>Listing Completion</div>
          <div style={{ fontSize:12, color:'var(--v-text3)' }}>Complete all fields for better discoverability</div>
        </div>
        <div style={{ fontFamily:'var(--v-serif)', fontSize:28, color:'var(--v-deep)' }}>{pct}%</div>
      </div>
      <div className="v-progress-track">
        <div className={`v-progress-fill ${cls}`} style={{ width:`${pct}%` }} />
      </div>
      <div style={{ display:'flex', gap:8, marginTop:10, flexWrap:'wrap' }}>
        {Object.entries(fields).map(([k, v]) => (
          <span key={k} className="v-chip" style={{
            background: v ? 'rgba(34,197,94,0.10)' : 'rgba(184,134,208,0.12)',
            color:       v ? '#16a34a' : 'var(--v-text3)',
            borderColor: v ? 'rgba(34,197,94,0.20)' : 'var(--v-border)',
          }}>
            {v ? '✓' : '○'} {k}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════════════════════ */
export default function AddProduct() {
  const navigate = useNavigate();
  const { createProduct } = useVendorProducts();

  const [form, setForm] = useState({
    title: '', category: '', subcategory: '', price: '', discount: '0', description: '',
    short_desc: '', tags: '', license: '', version: '1.0.0', status: 'published',
    featured: false, trending: false,
    preview: '', previewName: '',
    file_url: '', fileName: '', file_size: '',
    affiliate_enabled: false,
    commission_type: 'percentage',
    commission_value: '',
    preview_images: [],
    preview_video: '',
    seo_title: '',
    seo_description: '',
    visibility: 'public',
  });

  const [features, setFeatures] = useState(['']);
  const [systemRequirements, setSystemRequirements] = useState(['']);
  const [whatYouGet, setWhatYouGet] = useState(['']);

  const [saving,     setSaving]     = useState(false);
  const [saved,      setSaved]      = useState(false);
  const [saveError,  setSaveError]  = useState('');
  const [previewPct, setPreviewPct] = useState(0);
  const [filePct,    setFilePct]    = useState(0);
  const [videoPct,   setVideoPct]   = useState(0);
  const [uploadingPrev, setUploadingPrev] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingAddPrev, setUploadingAddPrev] = useState(false);

  const previewRef = useRef(null);
  const fileRef    = useRef(null);
  const videoRef   = useRef(null);
  const addPrevRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleAddList = (setter) => setter(prev => [...prev, '']);
  const handleRemoveList = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));
  const handleChangeList = (setter, idx, val) => setter(prev => prev.map((item, i) => i === idx ? val : item));

  /* ── Preview image: compress then upload to Firebase Storage ────── */
  const handlePreviewChange = async (e) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setSaveError('');
    setUploadingPrev(true); setPreviewPct(10);
    try {
      const compressed = await compressImageToBlob(raw, 800, 0.80);
      setPreviewPct(30);
      const result = await uploadToFirebase(compressed, 'product-previews', (pct) => {
        setPreviewPct(30 + Math.round(pct * 0.70));
      });
      setPreviewPct(100);
      set('preview',     result.url);
      set('previewName', raw.name);
    } catch (err) {
      setSaveError(`Preview upload failed: ${err.message}`);
    } finally {
      setTimeout(() => setUploadingPrev(false), 300);
    }
  };

  /* ── Additional preview images upload ────────────────────────────── */
  const handleAddPrevChange = async (e) => {
    const raw = e.target.files?.[0];
    if (!raw) return;
    setSaveError('');
    setUploadingAddPrev(true);
    try {
      const compressed = await compressImageToBlob(raw, 800, 0.80);
      const result = await uploadToFirebase(compressed, 'product-previews');
      setForm(f => ({
        ...f,
        preview_images: [...(f.preview_images || []), result.url]
      }));
    } catch (err) {
      setSaveError(`Additional preview upload failed: ${err.message}`);
    } finally {
      setUploadingAddPrev(false);
    }
  };

  /* ── Preview Video upload ────────────────────────────────────────── */
  const handleVideoChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError('');
    setUploadingVideo(true); setVideoPct(10);
    try {
      const result = await uploadToFirebase(file, 'product-videos', (pct) => {
        setVideoPct(10 + Math.round(pct * 0.90));
      });
      setVideoPct(100);
      set('preview_video', result.url);
    } catch (err) {
      setSaveError(`Video upload failed: ${err.message}`);
    } finally {
      setTimeout(() => setUploadingVideo(false), 300);
    }
  };

  /* ── Digital file: upload to Firebase Storage → store URL in DB ─── */
  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaveError('');
    setUploadingFile(true); setFilePct(5);
    try {
      const result = await uploadToFirebase(file, 'product-files', (pct) => {
        setFilePct(Math.round(pct));
      });
      setFilePct(100);
      set('file_url',  result.url);
      set('fileName',  file.name);
      set('file_size', `${result.sizeKb} KB`);
    } catch (err) {
      setSaveError(`File upload failed: ${err.message}`);
    } finally {
      setTimeout(() => setUploadingFile(false), 300);
    }
  };

  /* ── Validate ─────────────────────────────────────────────────────── */
  const validate = () => {
    if (!form.title.trim())  return 'Product title is required.';
    if (!form.category)      return 'Please select a category.';
    if (form.price === '' || isNaN(Number(form.price)) || Number(form.price) < 0)
                             return 'Please enter a valid non-negative price.';
    if (form.discount !== '' && (isNaN(Number(form.discount)) || Number(form.discount) < 0 || Number(form.discount) > 100))
                             return 'Please enter a valid discount percentage (0 - 100).';
    if (!form.license)       return 'Please select a license type.';

    if (form.affiliate_enabled) {
      const commVal = Number(form.commission_value);
      if (form.commission_value === '' || isNaN(commVal)) {
        return 'Please enter a valid commission value.';
      }
      if (commVal < 0) {
        return 'Commission value cannot be negative.';
      }
      if (form.commission_type === 'percentage') {
        if (commVal > 100) {
          return 'Commission percentage must be between 0 and 100.';
        }
      } else if (form.commission_type === 'fixed') {
        const prodPrice = Number(form.price) || 0;
        if (commVal > prodPrice) {
          return 'Fixed commission cannot exceed the product price.';
        }
      }
    }
    return null;
  };

  /* ── Save to backend ──────────────────────────────────────────────── */
  const doSave = async (statusVal) => {
    setSaveError('');
    const err = validate();
    if (err) { setSaveError(err); return false; }
    setSaving(true);
    try {
      await createProduct({
        ...form,
        status: statusVal,
        price: Number(form.price) || 0.0,
        discount: Number(form.discount) || 0.0,
        commission_value: form.affiliate_enabled ? (Number(form.commission_value) || 0.0) : 0.0,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        features: features.map(f => f.trim()).filter(Boolean),
        system_requirements: systemRequirements.map(r => r.trim()).filter(Boolean),
        what_you_get: whatYouGet.map(w => w.trim()).filter(Boolean)
      });
      return true;
    } catch (e) {
      setSaveError(e.message || 'Failed to save product.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async (e) => {
    e.preventDefault();
    const ok = await doSave('published');
    if (ok) { setSaved(true); setTimeout(() => navigate('/vendor/products'), 1200); }
  };

  const handleDraft = async () => {
    const ok = await doSave('draft');
    if (ok) { setSaved(true); setTimeout(() => setSaved(false), 3000); }
  };

  return (
    <VendorLayout activePage="add-product" title="Add Product" subtitle="Create a new digital product listing">

      <CompletionScore fields={{
        Title: form.title, Category: form.category, Price: form.price,
        Description: form.description, Tags: form.tags,
        File: form.file_url, Preview: form.preview, License: form.license,
      }} />

      {/* Success banner */}
      {saved && (
        <div style={{ padding:'12px 16px', borderRadius:12, marginBottom:20, background:'rgba(34,197,94,0.10)', border:'1px solid rgba(34,197,94,0.22)', color:'#16a34a', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
          <CheckCircle size={15} /> Product saved successfully! Redirecting…
        </div>
      )}

      {/* Error banner */}
      {saveError && (
        <div style={{ padding:'12px 16px', borderRadius:12, marginBottom:20, background:'rgba(220,38,38,0.06)', border:'1px solid rgba(220,38,38,0.20)', color:'#dc2626', fontSize:13, display:'flex', alignItems:'flex-start', gap:8 }}>
          <AlertCircle size={15} style={{ flexShrink:0, marginTop:1 }} /> {saveError}
        </div>
      )}

      <form onSubmit={handlePublish}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 340px', gap:20 }} className="v-form-grid">

          {/* ── Left: main fields ─────────────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

            {/* Product Details */}
            <div className="v-card v-card-pad">
              <div className="v-section-title" style={{ marginBottom:20 }}>Product Details</div>

              <div className="v-field">
                <label className="v-label">Product Title *</label>
                <input className="v-input" placeholder="e.g. Premium UI Kit for SaaS"
                  value={form.title} onChange={e => set('title', e.target.value)} />
              </div>

              <div className="v-field">
                <label className="v-label">Short Description</label>
                <input className="v-input" placeholder="A brief, engaging 1-sentence summary of your product."
                  value={form.short_desc} onChange={e => set('short_desc', e.target.value)} />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom: 14 }}>
                <div className="v-field">
                  <label className="v-label">Category *</label>
                  <select className="v-select" value={form.category} onChange={e => set('category', e.target.value)}>
                    <option value="">Select category</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="v-field">
                  <label className="v-label">Subcategory</label>
                  <input className="v-input" placeholder="e.g. Dashboard, Landing Page"
                    value={form.subcategory} onChange={e => set('subcategory', e.target.value)} />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                <div className="v-field">
                  <label className="v-label">Price (₹) *</label>
                  <input className="v-input" type="number" placeholder="499" min="0" step="1"
                    value={form.price} onChange={e => set('price', e.target.value)} />
                </div>
                <div className="v-field">
                  <label className="v-label">Discount (%)</label>
                  <input className="v-input" type="number" placeholder="0" min="0" max="100" step="1"
                    value={form.discount} onChange={e => set('discount', e.target.value)} />
                </div>
              </div>

              <div className="v-field">
                <label className="v-label">Full Description</label>
                <textarea className="v-textarea" rows={5}
                  placeholder="Describe your product — what's included, who it's for, and what makes it special."
                  value={form.description} onChange={e => set('description', e.target.value)} />
              </div>

              <div className="v-field">
                <label className="v-label">Tags</label>
                <input className="v-input" placeholder="ui, design, figma (comma-separated)"
                  value={form.tags} onChange={e => set('tags', e.target.value)} />
                <div className="v-field-hint">Up to 10 tags to improve search visibility</div>
              </div>
            </div>

            {/* Specs & What You Get */}
            <div className="v-card v-card-pad">
              <div className="v-section-title" style={{ marginBottom:20 }}>Features & Specs</div>

              {/* Features (dynamic list) */}
              <div className="v-field" style={{ marginBottom: 18 }}>
                <label className="v-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Key Features</span>
                  <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => handleAddList(setFeatures)}>+ Add Feature</button>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {features.map((feat, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="v-input" placeholder="e.g. 50+ vector icons included" style={{ flex: 1 }}
                        value={feat} onChange={e => handleChangeList(setFeatures, idx, e.target.value)} />
                      {features.length > 1 && (
                        <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ color: '#dc2626', padding: '6px' }} onClick={() => handleRemoveList(setFeatures, idx)}>×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* What You'll Get (dynamic list) */}
              <div className="v-field" style={{ marginBottom: 18 }}>
                <label className="v-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>What You'll Get</span>
                  <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => handleAddList(setWhatYouGet)}>+ Add Item</button>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {whatYouGet.map((item, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="v-input" placeholder="e.g. Sketch, Figma, and Adobe XD source files" style={{ flex: 1 }}
                        value={item} onChange={e => handleChangeList(setWhatYouGet, idx, e.target.value)} />
                      {whatYouGet.length > 1 && (
                        <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ color: '#dc2626', padding: '6px' }} onClick={() => handleRemoveList(setWhatYouGet, idx)}>×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* System Requirements (dynamic list) */}
              <div className="v-field" style={{ marginBottom: 18 }}>
                <label className="v-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>System Requirements</span>
                  <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => handleAddList(setSystemRequirements)}>+ Add Requirement</button>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {systemRequirements.map((req, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <input className="v-input" placeholder="e.g. Figma 2026.1 or later" style={{ flex: 1 }}
                        value={req} onChange={e => handleChangeList(setSystemRequirements, idx, e.target.value)} />
                      {systemRequirements.length > 1 && (
                        <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ color: '#dc2626', padding: '6px' }} onClick={() => handleRemoveList(setSystemRequirements, idx)}>×</button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Installation Guide */}
              <div className="v-field">
                <label className="v-label">Installation Guide (Optional)</label>
                <textarea className="v-textarea" rows={3} placeholder="Step-by-step instructions on how to install and setup this product."
                  value={form.installation_guide} onChange={e => set('installation_guide', e.target.value)} />
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

            {/* Files & Media */}
            <div className="v-card v-card-pad">
              <div className="v-section-title" style={{ marginBottom:20 }}>Files & Media</div>

              {/* Digital file */}
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
                        <div style={{ fontSize:11, color:'var(--v-text3)', marginTop:4 }}>ZIP, PDF, Figma, Sketch, MP4 — stored in Firebase Storage</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Preview image */}
              <div className="v-field">
                <label className="v-label">Preview Image (PNG / JPG)</label>
                <input type="file" accept="image/*" ref={previewRef} style={{ display:'none' }} onChange={handlePreviewChange} />
                {form.preview ? (
                  <div style={{ border:'1px solid rgba(196,148,230,0.30)', borderRadius:12, padding:12, background:'rgba(255,255,255,0.40)' }}>
                    <div style={{ height:200, borderRadius:8, overflow:'hidden', marginBottom:10 }}>
                      <img src={form.preview} alt="Preview" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" className="v-btn v-btn-secondary v-btn-sm" style={{ flex:1 }} onClick={() => previewRef.current?.click()}>
                        <Image size={12} /> Change
                      </button>
                      <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ color:'#dc2626' }} onClick={() => { set('preview',''); set('previewName',''); }}>Remove</button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => !uploadingPrev && previewRef.current?.click()}
                    style={{ border:'2px dashed rgba(184,134,208,0.40)', borderRadius:12, padding:'28px 20px', textAlign:'center', cursor:'pointer', background:'rgba(255,255,255,0.40)', transition:'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#B886D0'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(184,134,208,0.40)'}>
                    {uploadingPrev ? (
                      <>
                        <Image size={24} style={{ color:'var(--v-purple)', margin:'0 auto 8px', display:'block' }} />
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--v-purple)' }}>Processing… {previewPct}%</div>
                        <div className="v-progress-track" style={{ height:5, maxWidth:200, margin:'10px auto 0' }}>
                          <div className="v-progress-fill" style={{ width:`${previewPct}%` }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <Image size={24} style={{ color:'var(--v-text3)', margin:'0 auto 8px', display:'block' }} />
                        <div style={{ fontSize:13, color:'var(--v-text2)' }}>Upload a preview image</div>
                        <div style={{ fontSize:11, color:'var(--v-text3)', marginTop:4 }}>PNG, JPG — auto-compressed to 800px</div>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Additional Previews */}
              <div className="v-field" style={{ marginTop: 16 }}>
                <label className="v-label">Additional Preview Images (Screenshots)</label>
                <input type="file" accept="image/*" ref={addPrevRef} style={{ display:'none' }} onChange={handleAddPrevChange} />
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 10, marginBottom: 10 }}>
                  {(form.preview_images || []).map((imgUrl, index) => (
                    <div key={index} style={{ position: 'relative', height: 60, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--v-border)' }}>
                      <img src={imgUrl} alt={`extra preview ${index}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <button type="button" 
                        onClick={() => setForm(f => ({ ...f, preview_images: f.preview_images.filter((_, idx) => idx !== index) }))}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(220,38,38,0.85)', color: '#fff', border: 'none', borderRadius: '50%', width: 16, height: 16, fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        ×
                      </button>
                    </div>
                  ))}
                  {uploadingAddPrev && (
                    <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.4)', borderRadius: 8, border: '1px dashed var(--v-purple)' }}>
                      <span style={{ fontSize: 10, color: 'var(--v-purple)', fontWeight: 600 }}>Loading…</span>
                    </div>
                  )}
                </div>

                <button type="button" className="v-btn v-btn-secondary v-btn-sm" style={{ width: '100%' }}
                  onClick={() => addPrevRef.current?.click()} disabled={uploadingAddPrev}>
                  📷 Add Screenshot
                </button>
              </div>

              {/* Preview Video */}
              <div className="v-field" style={{ marginTop: 16 }}>
                <label className="v-label">Preview Video (Optional)</label>
                <input type="file" accept="video/*" ref={videoRef} style={{ display:'none' }} onChange={handleVideoChange} />
                
                {form.preview_video ? (
                  <div style={{ border:'1px solid rgba(196,148,230,0.30)', borderRadius:12, padding:12, background:'rgba(255,255,255,0.40)' }}>
                    <div style={{ height:120, borderRadius:8, overflow:'hidden', marginBottom:10 }}>
                      <video src={form.preview_video} controls style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                    </div>
                    <div style={{ display:'flex', gap:8 }}>
                      <button type="button" className="v-btn v-btn-secondary v-btn-sm" style={{ flex:1 }} onClick={() => videoRef.current?.click()}>
                        Change Video
                      </button>
                      <button type="button" className="v-btn v-btn-ghost v-btn-sm" style={{ color:'#dc2626' }} onClick={() => set('preview_video', '')}>
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div onClick={() => !uploadingVideo && videoRef.current?.click()}
                    style={{ border:'2px dashed rgba(184,134,208,0.40)', borderRadius:12, padding:'20px', textAlign:'center', cursor:'pointer', background:'rgba(255,255,255,0.40)', transition:'border-color 0.2s' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = '#B886D0'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(184,134,208,0.40)'}>
                    {uploadingVideo ? (
                      <>
                        <div style={{ fontSize:13, fontWeight:600, color:'var(--v-purple)' }}>Uploading Video… {videoPct}%</div>
                        <div className="v-progress-track" style={{ height:5, maxWidth:200, margin:'10px auto 0' }}>
                          <div className="v-progress-fill" style={{ width:`${videoPct}%` }} />
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize:13, color:'var(--v-text2)' }}>Upload a preview video</div>
                        <div style={{ fontSize:11, color:'var(--v-text3)', marginTop:4 }}>MP4, WebM — stored in Firebase Storage</div>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Right: publish settings ───────────────────────────────── */}
          <div style={{ display:'flex', flexDirection:'column', gap:20 }}>
            <div className="v-card v-card-pad">
              <div className="v-section-title" style={{ marginBottom:16 }}>Publish Settings</div>

              <div className="v-field">
                <label className="v-label">Status</label>
                <select className="v-select" value={form.status} onChange={e => set('status', e.target.value)}>
                  <option value="published">Published (Live)</option>
                  <option value="draft">Draft</option>
                  <option value="paused">Paused</option>
                </select>
              </div>

              <div className="v-field">
                <label className="v-label">License Type *</label>
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

              {/* Feature toggles */}
              {[
                { k:'featured', label:'Featured product',   sub:'Show on homepage featured section' },
                { k:'trending', label:'Mark as trending',   sub:'Show trending badge on listing' },
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

              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <button type="submit" className="v-btn v-btn-primary v-btn-lg"
                  disabled={saving} style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  {saving ? 'Saving…' : '🚀 Publish Product'}
                </button>
                <button type="button" className="v-btn v-btn-secondary"
                  disabled={saving} style={{ width:'100%' }} onClick={handleDraft}>
                  💾 Save as Draft
                </button>
                <button type="button" className="v-btn v-btn-ghost"
                  style={{ width:'100%' }} onClick={() => navigate('/vendor/products')}>
                  Cancel
                </button>
              </div>
            </div>

            {/* SEO & Visibility */}
            <div className="v-card v-card-pad">
              <div className="v-section-title" style={{ marginBottom:16 }}>SEO & Visibility</div>

              <div className="v-field">
                <label className="v-label">Visibility</label>
                <select className="v-select" value={form.visibility} onChange={e => set('visibility', e.target.value)}>
                  <option value="public">Public</option>
                  <option value="unlisted">Unlisted</option>
                  <option value="private">Private</option>
                </select>
                <div className="v-field-hint">Control who can discover this listing.</div>
              </div>

              <div className="v-field">
                <label className="v-label">SEO Title (Optional)</label>
                <input className="v-input" placeholder="e.g. Premium UI Kit for SaaS | Lumora"
                  value={form.seo_title} onChange={e => set('seo_title', e.target.value)} />
              </div>

              <div className="v-field">
                <label className="v-label">SEO Description (Optional)</label>
                <textarea className="v-textarea" rows={3} placeholder="A short description optimized for Google search results."
                  value={form.seo_description} onChange={e => set('seo_description', e.target.value)} />
              </div>
            </div>

            {/* Tips */}
            <div className="v-card v-card-pad" style={{ background:'rgba(216,191,227,0.18)' }}>
              <div style={{ fontSize:13, fontWeight:600, color:'var(--v-deep)', marginBottom:10 }}>💡 Listing Tips</div>
              {[
                'Use a keyword-rich title for SEO',
                'Add a high-quality 16:9 preview image',
                'Write a detailed description (200+ words)',
                'Tag with relevant keywords',
                'Choose the right license type',
              ].map((t, i) => (
                <div key={i} style={{ fontSize:12, color:'var(--v-text2)', marginBottom:6, display:'flex', gap:6 }}>
                  <span style={{ color:'var(--v-soft)' }}>✦</span> {t}
                </div>
              ))}
            </div>
          </div>
        </div>
      </form>

      <style>{`
        @media(max-width:900px){ .v-form-grid{ grid-template-columns: 1fr !important; } }
        @keyframes bounce { from { transform: translateY(0); } to { transform: translateY(-4px); } }
      `}</style>
    </VendorLayout>
  );
}
