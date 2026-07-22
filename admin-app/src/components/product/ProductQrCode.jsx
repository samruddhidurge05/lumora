/**
 * ProductQrCode
 * ─────────────
 * Generates a scannable QR code for any product.
 * The QR encodes the product's direct marketplace URL so customers can
 * scan → land on the product page → purchase immediately.
 *
 * Works automatically for every product (existing and newly created)
 * because the URL is derived purely from the product ID — no backend call needed.
 *
 * Usage:
 *   <ProductQrCode product={product} size={200} showDownload showShare />
 *
 * Props:
 *   product      {object}  Required. Must have at minimum { id, title, price }
 *   size         {number}  QR image size in px (default 180)
 *   showDownload {bool}    Show download button (default true)
 *   showShare    {bool}    Show copy-link button (default true)
 *   compact      {bool}    Minimal card style for table rows (default false)
 *   className    {string}
 *   style        {object}
 */
import React, { useState, useCallback } from 'react';
import { Download, Link2, Check, QrCode, X } from 'lucide-react';
import { buildAffiliateReferralLink } from '../../utils/referralUtils';

/* ── Build the product URL ─────────────────────────────────────── */
function buildProductUrl(product) {
  return buildAffiliateReferralLink(product, product?.refCode || product?.referralCode || '');
}

/* ── Build QR image URL via free public API (no key needed) ──── */
function buildQrImageUrl(data, size = 180) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&margin=8&color=2D004D&bgcolor=ffffff`;
}

/* ── Format price in INR ────────────────────────────────────────── */
function formatPrice(price) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 0,
  }).format(Math.round(price || 0));
}

/* ══════════════════════════════════════════════════════════════════
   COMPACT INLINE VARIANT  — used in table rows
══════════════════════════════════════════════════════════════════ */
function CompactQr({ product }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const url = buildProductUrl(product);
  const qrSrc = buildQrImageUrl(url, 200);

  const handleCopy = useCallback((e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [url]);

  const handleDownload = useCallback(async (e) => {
    e.stopPropagation();
    try {
      const res = await fetch(buildQrImageUrl(url, 400));
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qr-${product.id}-${(product.title || 'product').replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(buildQrImageUrl(url, 400), '_blank');
    }
  }, [url, product]);

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        title="View product QR code"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: '4px',
          padding: '5px 10px', borderRadius: '8px', cursor: 'pointer',
          border: '1px solid rgba(123,63,160,0.25)',
          background: 'rgba(123,63,160,0.06)',
          color: '#7B3FA0', fontSize: '0.72rem', fontWeight: 700,
          transition: 'all 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.14)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(123,63,160,0.06)'; }}
      >
        <QrCode size={12} /> QR
      </button>

      {/* Modal */}
      {open && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(45,0,77,0.55)',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: '20px',
          }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#FFFDF9',
              borderRadius: '24px',
              padding: '32px 28px',
              maxWidth: '340px', width: '100%',
              boxShadow: '0 24px 64px rgba(45,0,77,0.28)',
              border: '1px solid rgba(220,198,255,0.40)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px',
              position: 'relative',
            }}
          >
            {/* Close */}
            <button
              onClick={() => setOpen(false)}
              style={{
                position: 'absolute', top: '14px', right: '14px',
                background: 'rgba(0,0,0,0.06)', border: 'none', borderRadius: '50%',
                width: '28px', height: '28px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6B5A7A',
              }}
            >
              <X size={14} />
            </button>

            {/* Header */}
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: '0.65rem', fontWeight: 800, letterSpacing: '0.1em', color: '#7B3FA0', textTransform: 'uppercase', marginBottom: '4px' }}>
                Product QR Code
              </p>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: '#2D004D', lineHeight: 1.3, maxWidth: '260px' }}>
                {product.title}
              </h3>
              <p style={{ fontSize: '0.8rem', color: '#7B3FA0', fontWeight: 700, marginTop: '4px' }}>
                {formatPrice(product.price)}
              </p>
            </div>

            {/* QR Image */}
            <div style={{
              padding: '12px', background: '#fff', borderRadius: '16px',
              border: '2px solid rgba(123,63,160,0.15)',
              boxShadow: '0 4px 20px rgba(45,0,77,0.08)',
            }}>
              <img
                src={qrSrc}
                alt={`QR code for ${product.title}`}
                style={{ width: '200px', height: '200px', display: 'block', borderRadius: '8px' }}
                loading="eager"
              />
            </div>

            {/* Scan instruction */}
            <p style={{ fontSize: '0.75rem', color: '#8B6B5B', textAlign: 'center', lineHeight: 1.5 }}>
              Scan to open product page &amp; purchase
            </p>

            {/* URL chip */}
            <div style={{
              width: '100%', padding: '8px 12px',
              background: 'rgba(123,63,160,0.04)',
              border: '1px dashed rgba(123,63,160,0.25)',
              borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '8px',
            }}>
              <span style={{ flex: 1, fontSize: '0.65rem', color: '#6B5A7A', wordBreak: 'break-all', lineHeight: 1.4 }}>
                {url}
              </span>
              <button
                onClick={handleCopy}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7B3FA0', flexShrink: 0 }}
                title="Copy link"
              >
                {copied ? <Check size={14} color="#16a34a" /> : <Link2 size={14} />}
              </button>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button
                onClick={handleDownload}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px', borderRadius: '10px',
                  background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 700,
                  boxShadow: '0 4px 14px rgba(90,30,126,0.30)',
                }}
              >
                <Download size={14} /> Download PNG
              </button>
              <button
                onClick={handleCopy}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '10px', borderRadius: '10px',
                  border: '1.5px solid rgba(123,63,160,0.30)',
                  background: 'rgba(255,255,255,0.80)',
                  color: '#7B3FA0', cursor: 'pointer',
                  fontSize: '0.8rem', fontWeight: 700,
                }}
              >
                {copied ? <><Check size={14} color="#16a34a" /> Copied!</> : <><Link2 size={14} /> Copy Link</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   FULL CARD VARIANT  — used on product detail pages
══════════════════════════════════════════════════════════════════ */
function FullQrCard({ product, size, showDownload, showShare, style, className }) {
  const [copied, setCopied] = useState(false);

  const url = buildProductUrl(product);
  const qrSrc = buildQrImageUrl(url, size);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }, [url]);

  const handleDownload = useCallback(async () => {
    try {
      const res = await fetch(buildQrImageUrl(url, 400));
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `qr-${product.id}-${(product.title || 'product').replace(/\s+/g, '-').toLowerCase()}.png`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(buildQrImageUrl(url, 400), '_blank');
    }
  }, [url, product]);

  return (
    <div
      className={className}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px',
        padding: '24px 20px',
        background: 'rgba(255,255,255,0.60)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(220,198,255,0.35)',
        borderRadius: '20px',
        boxShadow: '0 4px 24px rgba(45,0,77,0.06)',
        ...style,
      }}
    >
      {/* Title */}
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: '0.6rem', fontWeight: 800, letterSpacing: '0.1em', color: '#7B3FA0', textTransform: 'uppercase', marginBottom: '2px' }}>
          Share this Product
        </p>
        <p style={{ fontSize: '0.72rem', color: '#6B5A7A', fontWeight: 500 }}>
          Scan QR to open &amp; purchase
        </p>
      </div>

      {/* QR image */}
      <div style={{
        padding: '10px', background: '#fff', borderRadius: '14px',
        border: '1.5px solid rgba(123,63,160,0.12)',
        boxShadow: '0 2px 12px rgba(45,0,77,0.06)',
      }}>
        <img
          src={qrSrc}
          alt={`QR code — ${product.title}`}
          style={{ width: size, height: size, display: 'block', borderRadius: '6px' }}
          loading="lazy"
        />
      </div>

      {/* Price badge */}
      <div style={{
        padding: '4px 14px', borderRadius: '20px',
        background: 'linear-gradient(135deg,rgba(123,63,160,0.10),rgba(90,30,126,0.06))',
        border: '1px solid rgba(123,63,160,0.18)',
      }}>
        <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#5A1E7E' }}>
          {formatPrice(product.price)}
        </span>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', width: '100%' }}>
        {showDownload && (
          <button
            onClick={handleDownload}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              padding: '8px 12px', borderRadius: '10px',
              background: 'linear-gradient(135deg,#7B3FA0,#5A1E7E)',
              color: '#fff', border: 'none', cursor: 'pointer',
              fontSize: '0.72rem', fontWeight: 700,
              boxShadow: '0 3px 10px rgba(90,30,126,0.28)',
            }}
          >
            <Download size={12} /> Save QR
          </button>
        )}
        {showShare && (
          <button
            onClick={handleCopy}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
              padding: '8px 12px', borderRadius: '10px',
              border: '1.5px solid rgba(123,63,160,0.28)',
              background: 'rgba(255,255,255,0.80)',
              color: '#7B3FA0', cursor: 'pointer',
              fontSize: '0.72rem', fontWeight: 700,
            }}
          >
            {copied ? <><Check size={12} color="#16a34a" /> Copied!</> : <><Link2 size={12} /> Copy Link</>}
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   EXPORTED COMPONENT — auto-selects variant
══════════════════════════════════════════════════════════════════ */
export default function ProductQrCode({
  product,
  size = 180,
  showDownload = true,
  showShare = true,
  compact = false,
  className,
  style,
}) {
  if (!product?.id) return null;

  if (compact) {
    return <CompactQr product={product} />;
  }

  return (
    <FullQrCard
      product={product}
      size={size}
      showDownload={showDownload}
      showShare={showShare}
      className={className}
      style={style}
    />
  );
}

/* Named export for direct use in table rows */
export { CompactQr as ProductQrButton };
