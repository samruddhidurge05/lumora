/**
 * PlatformTreasuryCards.jsx
 * --------------------------
 * Dashboard treasury metrics card — 6 financial KPIs from backend.
 * All figures computed server-side. Frontend only renders, never calculates.
 *
 * Available Balance = Platform Revenue
 *                   − Affiliate Liability
 *                   − Pending Withdrawals
 *                   − Completed Withdrawals
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchTreasurySummary, subscribeToTreasurySummary, formatINR } from '../../../services/treasuryService';
import { useAdminContext } from '../../../context/AdminContext';

// ── Tiny inline icons (no external dep needed) ──────────────────────────────
const Ico = ({ d, size = 16, stroke = 'currentColor', fill = 'none' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill}
    stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

const ICONS = {
  revenue:    'M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
  balance:    'M3 6l3 1m0 0l-3 9a5.002 5.002 0 0 0 6.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 0 0 6.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3',
  liability:  'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  pending:    'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  completed:  'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  net:        'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
};

const CARD_DEFS = [
  {
    key: 'platform_revenue',
    label: 'Platform Revenue',
    icon: ICONS.revenue,
    color: '#a78bfa',
    glow: 'rgba(167,139,250,0.25)',
    subtitle: 'Gross lifetime earnings',
    immutable: true,
  },
  {
    key: 'available_balance',
    label: 'Available Balance',
    icon: ICONS.balance,
    color: '#34d399',
    glow: 'rgba(52,211,153,0.25)',
    subtitle: 'Withdrawable now',
    highlight: true,
  },
  {
    key: 'affiliate_liability',
    label: 'Affiliate Liability',
    icon: ICONS.liability,
    color: '#fb923c',
    glow: 'rgba(251,146,60,0.2)',
    subtitle: 'Approved commissions owed',
  },
  {
    key: 'pending_withdrawals',
    label: 'Pending Withdrawals',
    icon: ICONS.pending,
    color: '#fbbf24',
    glow: 'rgba(251,191,36,0.2)',
    subtitle: 'In-flight transfers',
  },
  {
    key: 'completed_withdrawals',
    label: 'Withdrawn',
    icon: ICONS.completed,
    color: '#60a5fa',
    glow: 'rgba(96,165,250,0.2)',
    subtitle: 'Total transferred out',
  },
  {
    key: 'net_platform_earnings',
    label: 'Net Platform Earnings',
    icon: ICONS.net,
    color: '#c084fc',
    glow: 'rgba(192,132,252,0.2)',
    subtitle: 'Revenue − Affiliate Liability',
  },
];

// ── Metric Card ─────────────────────────────────────────────────────────────
function MetricCard({ def, value, loading, onWithdraw, canWithdraw }) {
  const amount = value ?? 0;
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1px solid rgba(255,255,255,0.1)`,
        borderRadius: '20px',
        padding: '22px 24px',
        backdropFilter: 'blur(16px)',
        boxShadow: `0 0 32px ${def.glow}, 0 2px 12px rgba(0,0,0,0.15)`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'transform 0.2s, box-shadow 0.2s',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = `0 0 48px ${def.glow}, 0 8px 32px rgba(0,0,0,0.2)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = `0 0 32px ${def.glow}, 0 2px 12px rgba(0,0,0,0.15)`;
      }}
    >
      {/* Glow orb */}
      <div style={{
        position: 'absolute', top: '-30px', right: '-30px',
        width: '100px', height: '100px', borderRadius: '50%',
        background: def.glow, filter: 'blur(30px)', pointerEvents: 'none',
      }} />

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '12px',
          background: `linear-gradient(135deg, ${def.color}22, ${def.color}44)`,
          border: `1px solid ${def.color}44`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: def.color, flexShrink: 0,
        }}>
          <Ico d={def.icon} size={18} />
        </div>
        {def.immutable && (
          <span style={{
            fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em',
            color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase',
            background: 'rgba(255,255,255,0.06)', borderRadius: '6px',
            padding: '3px 8px', border: '1px solid rgba(255,255,255,0.1)',
          }}>IMMUTABLE</span>
        )}
      </div>

      {/* Value */}
      <div style={{ marginBottom: '6px' }}>
        {loading ? (
          <div style={{
            height: '32px', width: '120px', borderRadius: '8px',
            background: 'rgba(255,255,255,0.08)', animation: 'pulse 1.5s ease-in-out infinite',
          }} />
        ) : (
          <span style={{
            fontSize: '26px', fontWeight: 700, letterSpacing: '-0.02em',
            color: def.highlight ? def.color : '#fff',
            textShadow: def.highlight ? `0 0 20px ${def.color}88` : 'none',
          }}>
            {formatINR(amount)}
          </span>
        )}
      </div>

      {/* Label + subtitle */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'rgba(255,255,255,0.85)' }}>{def.label}</div>
        <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '2px' }}>{def.subtitle}</div>
      </div>

      {/* Withdraw button on Available Balance card */}
      {def.highlight && onWithdraw && (
        <button
          onClick={onWithdraw}
          disabled={!canWithdraw || amount <= 0}
          style={{
            marginTop: '18px', width: '100%', padding: '10px 0',
            borderRadius: '12px', border: 'none', cursor: canWithdraw && amount > 0 ? 'pointer' : 'not-allowed',
            background: canWithdraw && amount > 0
              ? `linear-gradient(135deg, ${def.color}, #6ee7b7)`
              : 'rgba(255,255,255,0.08)',
            color: canWithdraw && amount > 0 ? '#0f1117' : 'rgba(255,255,255,0.3)',
            fontWeight: 700, fontSize: '13px', letterSpacing: '0.04em',
            transition: 'all 0.2s',
            boxShadow: canWithdraw && amount > 0 ? `0 4px 20px ${def.color}55` : 'none',
          }}
        >
          {canWithdraw ? 'Withdraw Funds' : 'View Only — Finance Page'}
        </button>
      )}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────
export default function PlatformTreasuryCards() {
  const navigate = useNavigate();
  const { adminProfile } = useAdminContext();

  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  // Only super_admin can initiate withdrawals (Phase 2)
  const roleLevel = adminProfile?.role_level || 'admin';
  const canWithdraw = roleLevel === 'super_admin';

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTreasurySummary();
      if (data) setSummary(data);
      setError(null);
    } catch (err) {
      setError('Treasury data unavailable');
      console.warn('[PlatformTreasuryCards] fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Firestore realtime updates
    const unsub = subscribeToTreasurySummary((firestoreData) => {
      setSummary(prev => ({ ...prev, ...firestoreData }));
    });
    return unsub;
  }, [load]);

  const handleWithdraw = () => navigate('/admin/finance');

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#fff', margin: 0 }}>
            Platform Treasury
          </h3>
          <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', margin: '4px 0 0' }}>
            Available Balance = Revenue − Affiliate Liability − Withdrawals
          </p>
        </div>
        <button
          onClick={() => navigate('/admin/finance')}
          style={{
            padding: '8px 16px', borderRadius: '10px',
            background: 'rgba(167,139,250,0.15)', border: '1px solid rgba(167,139,250,0.3)',
            color: '#a78bfa', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
            letterSpacing: '0.04em', transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(167,139,250,0.25)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(167,139,250,0.15)'}
        >
          Finance & Treasury →
        </button>
      </div>

      {error && (
        <div style={{
          padding: '12px 16px', borderRadius: '12px', marginBottom: '16px',
          background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
          color: '#fca5a5', fontSize: '13px',
        }}>
          ⚠ {error} — <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={load}>Retry</span>
        </div>
      )}

      {/* 6 cards grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '16px',
      }}>
        {CARD_DEFS.map(def => (
          <MetricCard
            key={def.key}
            def={def}
            value={summary?.[def.key]}
            loading={loading}
            onWithdraw={def.highlight ? handleWithdraw : null}
            canWithdraw={canWithdraw}
          />
        ))}
      </div>

      {/* Today / Month footer strip */}
      {summary && (
        <div style={{
          marginTop: '16px', padding: '14px 20px', borderRadius: '14px',
          background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
          display: 'flex', flexWrap: 'wrap', gap: '24px', alignItems: 'center',
        }}>
          {[
            { label: "Today's Revenue", value: summary.today_revenue },
            { label: 'This Month Withdrawn', value: summary.current_month_withdrawn },
            { label: 'Net Withdrawable', value: summary.net_withdrawable },
            { label: 'Reserve (Min)', value: summary.minimum_reserve },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)', fontWeight: 500 }}>{label}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: 'rgba(255,255,255,0.85)' }}>{formatINR(value)}</span>
            </div>
          ))}
          {summary.last_withdrawal && (
            <div style={{ marginLeft: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', textAlign: 'right' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.35)' }}>Last Withdrawal</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: '#a78bfa' }}>
                {formatINR(summary.last_withdrawal.amount)}
              </span>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>
                {summary.last_withdrawal.withdrawal_number}
              </span>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  );
}
