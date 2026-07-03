import React, { useRef, useState } from 'react';
import { Upload, X, CheckCircle } from 'lucide-react';

export default function FileUploader({ onUpload, accept = '*', label = 'Drop files here or click to upload' }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  const handleFile = (f) => {
    setFile(f);
    setDone(false);
    let p = 0;
    const interval = setInterval(() => {
      p += 10;
      setProgress(p);
      if (p >= 100) { clearInterval(interval); setDone(true); onUpload && onUpload(f); }
    }, 80);
  };

  const handleDrop = (e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); };

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={e => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        style={{ border: '2px dashed rgba(196,181,253,0.4)', borderRadius: '14px', padding: '40px', textAlign: 'center', cursor: 'none', background: 'rgba(123,63,160,0.02)', transition: 'border-color 0.2s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(123,63,160,0.5)'}
        onMouseLeave={e => e.currentTarget.style.borderColor = 'rgba(196,181,253,0.4)'}
      >
        {done ? <CheckCircle size={32} style={{ color: '#16a34a', margin: '0 auto 8px' }} /> : <Upload size={32} style={{ color: '#7B3FA0', margin: '0 auto 8px' }} />}
        <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-espresso)' }}>{file ? file.name : label}</p>
        {!done && <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>Supported: {accept}</p>}
        <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); }} />
      </div>
      {file && !done && (
        <div style={{ marginTop: '12px' }}>
          <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(196,181,253,0.2)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'linear-gradient(90deg,#7B3FA0,#5A1E7E)', transition: 'width 0.1s', borderRadius: '4px' }} />
          </div>
          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>Uploading… {progress}%</p>
        </div>
      )}
    </div>
  );
}
