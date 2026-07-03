import React, { useState } from 'react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import useAuth from '../../hooks/useAuth';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../../config/firebase';
import { saveVendorProfile } from '../services/firestore';

const DOC_STATUS = {
  approved: { label: 'Approved', cls: 'v-badge-green', icon: '✓' },
  pending:  { label: 'Pending',  cls: 'v-badge-amber', icon: '⏳' },
  required: { label: 'Required', cls: 'v-badge-red',   icon: '!' },
};

export default function Verification() {
  const { user, updateProfile } = useAuth();
  const [uploading, setUploading] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState(null);

  const panStatus = user?.verificationDocs?.pan?.status || 'required';
  const aadhaarStatus = user?.verificationDocs?.aadhaar?.status || 'required';
  const bankStatus = user?.verificationDocs?.bank?.status || 'required';
  const gstStatus = user?.verificationDocs?.gst?.status || 'required';
  const addressStatus = user?.verificationDocs?.address?.status || 'required';

  const STEPS = [
    { id: 'email',    label: 'Email Verified',       status: user?.verification?.emailStatus || 'done',    icon: '✉️' },
    { id: 'profile',  label: 'Profile Complete',      status: user?.verification?.profileStatus || 'done',    icon: '👤' },
    { id: 'id',       label: 'Identity Verification', status: (panStatus === 'approved' && aadhaarStatus === 'approved') ? 'done' : (panStatus === 'pending' || aadhaarStatus === 'pending') ? 'pending' : 'required',    icon: '🪪' },
    { id: 'bank',     label: 'Bank Account Linked',   status: bankStatus === 'approved' ? 'done' : bankStatus === 'pending' ? 'pending' : 'required',    icon: '🏦' },
    { id: 'tax',      label: 'Tax Information',        status: gstStatus === 'approved' ? 'done' : gstStatus === 'pending' ? 'pending' : 'required', icon: '📋' },
    { id: 'store',    label: 'Store Review',           status: (panStatus === 'approved' && aadhaarStatus === 'approved' && bankStatus === 'approved' && gstStatus === 'approved' && addressStatus === 'approved') ? 'done' : 'pending', icon: '🏪' },
  ];

  const DOCS = [
    { id: 'pan',      label: 'PAN Card',              status: panStatus, note: user?.verificationDocs?.pan?.note || 'Not yet submitted' },
    { id: 'aadhaar',  label: 'Aadhaar Card',          status: aadhaarStatus, note: user?.verificationDocs?.aadhaar?.note || 'Not yet submitted' },
    { id: 'bank',     label: 'Bank Statement',        status: bankStatus, note: user?.verificationDocs?.bank?.note || 'Not yet submitted' },
    { id: 'gst',      label: 'GST Certificate',       status: gstStatus,  note: user?.verificationDocs?.gst?.note || 'Not yet submitted' },
    { id: 'address',  label: 'Address Proof',         status: addressStatus, note: user?.verificationDocs?.address?.note || 'Not yet submitted' },
  ];

  const done  = STEPS.filter(s => s.status === 'done').length;
  const total = STEPS.length;
  const pct   = Math.round((done / total) * 100);

  const handleUpload = async (docId, file) => {
    if (!file || !user?.uid) return;
    setUploading(docId);
    setUploadProgress(10);

    try {
      const uniqueFileName = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
      const storageRef = ref(storage, `verification/${user.uid}/${docId}/${uniqueFileName}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      await new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
            setUploadProgress(progress);
          },
          (error) => reject(error),
          () => resolve(null)
        );
      });

      const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);

      const currentDocs = user.verificationDocs || {};
      const updatedDocs = {
        ...currentDocs,
        [docId]: {
          status: 'pending',
          url: downloadURL,
          note: `Uploaded — under review (${new Date().toLocaleDateString()})`
        }
      };

      const panSt = updatedDocs.pan?.status || 'required';
      const aadhaarSt = updatedDocs.aadhaar?.status || 'required';
      const bankSt = updatedDocs.bank?.status || 'required';
      const gstSt = updatedDocs.gst?.status || 'required';
      const addressSt = updatedDocs.address?.status || 'required';

      const doneSteps = [
        'done', 'done',
        (panSt === 'approved' && aadhaarSt === 'approved') ? 'done' : 'pending',
        bankSt === 'approved' ? 'done' : 'pending',
        gstSt === 'approved' ? 'done' : 'pending',
        (panSt === 'approved' && aadhaarSt === 'approved' && bankSt === 'approved' && gstSt === 'approved' && addressSt === 'approved') ? 'done' : 'pending'
      ].filter(s => s === 'done').length;

      const newPct = Math.round((doneSteps / 6) * 100);

      await updateProfile({ verificationDocs: updatedDocs, verification: { ...user.verification, pct: newPct } });
      await saveVendorProfile({
        verificationDocs: updatedDocs,
        verification: { ...user.verification, pct: newPct },
        updatedAt: new Date().toISOString(),
      });
      
      setUploadStatus({ type: 'success', message: `${DOCS.find(d => d.id === docId)?.label || 'Document'} uploaded successfully.` });
    } catch (err) {
      console.error("Document upload failed:", err);
      setUploadStatus({ type: 'error', message: `Upload failed: ${err.message}` });
    } finally {
      setUploading(null);
      setUploadProgress(0);
    }
  };

  const triggerFileInput = (docId) => {
    document.getElementById(`file-input-${docId}`).click();
  };

  return (
    <VendorLayout activePage="verification" title="Verification" subtitle="Complete your seller verification to unlock all features">

      {uploadStatus && (
        <div style={{
          marginBottom: 20,
          padding: '12px 16px',
          borderRadius: 12,
          background: uploadStatus.type === 'success' ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
          border: `1px solid ${uploadStatus.type === 'success' ? 'rgba(34,197,94,0.22)' : 'rgba(239,68,68,0.22)'}`,
          color: uploadStatus.type === 'success' ? '#16a34a' : '#dc2626',
          fontSize: 13.5,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <span>{uploadStatus.type === 'success' ? '✓' : '⚠'} {uploadStatus.message}</span>
          <button onClick={() => setUploadStatus(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>✕</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div className="v-card v-card-pad">
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
            <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
              <svg viewBox="0 0 80 80" style={{ width: 80, height: 80, transform: 'rotate(-90deg)' }}>
                <circle cx="40" cy="40" r="34" fill="none" stroke="rgba(184,134,208,0.18)" strokeWidth="8" />
                <circle cx="40" cy="40" r="34" fill="none" stroke="#7B3FA0" strokeWidth="8"
                  strokeDasharray={`${2 * Math.PI * 34}`}
                  strokeDashoffset={`${2 * Math.PI * 34 * (1 - pct / 100)}`}
                  strokeLinecap="round" />
              </svg>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--v-serif)', fontSize: 18, color: 'var(--v-dark)', fontWeight: 600 }}>
                {pct}%
              </div>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--v-serif)', fontSize: 22, color: 'var(--v-dark)', marginBottom: 4 }}>Verification Progress</div>
              <div style={{ fontSize: 13, color: 'var(--v-text3)' }}>{done} of {total} steps completed</div>
              <span className={`v-badge ${pct === 100 ? 'v-badge-green' : 'v-badge-amber'}`} style={{ marginTop: 8, display: 'inline-flex' }}>
                {pct === 100 ? '✓ Fully Verified' : 'In Progress'}
              </span>
            </div>
          </div>
          <div className="v-progress-track" style={{ height: 8 }}>
            <div className="v-progress-fill" style={{ width: `${pct}%` }} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 8 }}>
            Complete all steps to unlock Premium Seller status and higher withdrawal limits.
          </div>
        </div>

        <div className="v-card v-card-pad">
          <div className="v-section-title" style={{ marginBottom: 14 }}>Verification Benefits</div>
          {[
            { icon: '🏆', label: 'Verified Seller Badge',     sub: 'Build trust with customers'         },
            { icon: '💸', label: 'Higher Withdrawal Limits',  sub: 'Up to ₹5L per transaction'          },
            { icon: '📈', label: 'Priority Search Ranking',   sub: 'Appear higher in search results'    },
            { icon: '🎯', label: 'Featured Store Eligibility',sub: 'Get featured on the homepage'       },
          ].map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ fontSize: 20 }}>{b.icon}</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--v-dark)' }}>{b.label}</div>
                <div style={{ fontSize: 11, color: 'var(--v-text3)' }}>{b.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="v-card v-card-pad" style={{ marginBottom: 24 }}>
        <div className="v-section-title" style={{ marginBottom: 20 }}>Verification Steps</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{
              padding: '16px', borderRadius: 14,
              background: s.status === 'done' ? 'rgba(34,197,94,0.08)' : s.status === 'pending' ? 'rgba(245,158,11,0.08)' : 'rgba(239,68,68,0.05)',
              border: `1px solid ${s.status === 'done' ? 'rgba(34,197,94,0.20)' : s.status === 'pending' ? 'rgba(245,158,11,0.22)' : 'rgba(239,68,68,0.12)'}`,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: s.status === 'done' ? 'rgba(34,197,94,0.15)' : s.status === 'pending' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>{s.status === 'done' ? '✅' : s.status === 'pending' ? '⏳' : s.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--v-dark)' }}>{s.label}</div>
                <span className={`v-badge ${s.status === 'done' ? 'v-badge-green' : s.status === 'pending' ? 'v-badge-amber' : 'v-badge-red'}`} style={{ marginTop: 4, display: 'inline-flex' }}>
                  {s.status === 'done' ? 'Complete' : s.status === 'pending' ? 'Pending' : 'Required'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="v-card">
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--v-border)' }}>
          <div className="v-section-title">Document Checklist</div>
          <div style={{ fontSize: 13, color: 'var(--v-text3)', marginTop: 4 }}>
            Upload the required documents to complete your verification.
          </div>
        </div>
        <div style={{ padding: '8px 0' }}>
          {DOCS.map(doc => {
            const st = DOC_STATUS[doc.status] || DOC_STATUS.required;
            return (
              <div key={doc.id} style={{ padding: '16px 24px', borderBottom: '1px solid rgba(184,134,208,0.10)', display: 'flex', alignItems: 'center', gap: 14 }}>
                <input type="file" id={`file-input-${doc.id}`} style={{ display: 'none' }}
                  onChange={(e) => { const file = e.target.files?.[0]; if (file) handleUpload(doc.id, file); }} />
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(216,191,227,0.20)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>📄</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--v-dark)' }}>{doc.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--v-text3)', marginTop: 2 }}>{doc.note}</div>
                </div>
                <span className={`v-badge ${st.cls}`}>
                  <span className="v-badge-dot" />
                  {uploading === doc.id ? `Uploading (${uploadProgress}%)` : st.label}
                </span>
                {doc.status === 'required' && (
                  <button className="v-btn v-btn-primary v-btn-sm"
                    disabled={uploading !== null}
                    onClick={() => triggerFileInput(doc.id)}>
                    Upload
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </VendorLayout>
  );
}
