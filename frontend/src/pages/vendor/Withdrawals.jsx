import React, { useState, useEffect } from 'react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useWithdrawals, useOrders } from '../../hooks/useVendorData';
import { 
  DollarSign, 
  Clock, 
  ArrowUpRight, 
  AlertCircle, 
  CheckCircle2, 
  RefreshCw, 
  HelpCircle,
  CreditCard,
  Send
} from 'lucide-react';

const STATUS_MAP = {
  completed: { label: 'Completed', cls: 'v-badge-green' },
  pending:   { label: 'Pending',   cls: 'v-badge-amber' },
  failed:    { label: 'Failed',    cls: 'v-badge-red'   },
  cancelled: { label: 'Cancelled', cls: 'v-badge-red'   },
};


export default function Withdrawals() {
  const { history: liveHistory, loading: withdrawalsLoading, submitting, error: withdrawalsError, submit, refresh: refreshWithdrawals } = useWithdrawals();
  const { orders: liveOrders, loading: ordersLoading, error: ordersError, refresh: refreshOrders } = useOrders();

  const [amount, setAmount]       = useState('');
  const [method, setMethod]       = useState('upi');
  const [upiId, setUpiId]         = useState('');
  const [bankAccount, setBankAccount] = useState('');
  const [success, setSuccess]     = useState(false);
  const [formError, setFormError] = useState('');
  const [available, setAvailable] = useState(0);

  const loading = withdrawalsLoading || ordersLoading;
  const backendError = withdrawalsError || ordersError;

  const refreshAll = () => {
    refreshWithdrawals();
    refreshOrders();
  };

  const history = liveHistory || [];

  useEffect(() => {
    const FEE_PCT = 0.15;
    const grossRevenue = (liveOrders || []).reduce((s, o) => s + (o.amount || 0), 0);

    const netRevenue = grossRevenue * (1 - FEE_PCT);

    const totalWithdrawn = (liveHistory || [])
      .filter(w => w.status === 'completed')
      .reduce((s, w) => s + (w.amount || 0), 0);

    const pendingWithdrawn = (liveHistory || [])
      .filter(w => w.status === 'pending')
      .reduce((s, w) => s + (w.amount || 0), 0);

    setAvailable(Math.max(0, Math.round(netRevenue - totalWithdrawn - pendingWithdrawn)));
  }, [liveOrders, liveHistory]);

  // Check if a pending withdrawal already exists to block duplicates
  const hasPending = history.some(w => w.status === 'pending');

  const handleWithdraw = async (e) => {
    e.preventDefault();
    setFormError('');
    setSuccess(false);

    if (hasPending) {
      setFormError('You already have a pending withdrawal request. Please wait for it to be processed.');
      return;
    }

    const numAmount = Number(amount);
    if (!amount || numAmount < 500) {
      setFormError('Minimum withdrawal amount is ₹500.');
      return;
    }

    if (numAmount > available) {
      setFormError('Amount exceeds your available balance.');
      return;
    }

    if (method === 'upi' && !upiId.trim()) {
      setFormError('Please enter your UPI ID.');
      return;
    }

    if (method === 'bank' && !bankAccount.trim()) {
      setFormError('Please enter your Bank Account Number.');
      return;
    }

    try {
      await submit({
        amount: numAmount,
        method,
        upiId: method === 'upi' ? upiId : null,
        bankAccount: method === 'bank' ? bankAccount : null,
      });
      
      setSuccess(true);
      setAmount('');
      setUpiId('');
      setBankAccount('');
      refreshAll();
    } catch (err) {
      console.error(err);
      setFormError(err.message || 'Withdrawal request failed. Please try again.');
    }
  };

  const totalWithdrawnAmount = history
    .filter(h => h.status === 'completed')
    .reduce((s, h) => s + (h.amount || 0), 0);

  const totalPendingAmount = history
    .filter(h => h.status === 'pending')
    .reduce((s, h) => s + (h.amount || 0), 0);

  return (
    <VendorLayout activePage="withdrawals" title="Withdrawals" subtitle="Manage your payout requests">

      {backendError && (
        <div style={{
          padding: '14px 20px',
          borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.08)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#DC2626',
          fontSize: '13.5px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          backdropFilter: 'blur(8px)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            <span>{backendError}</span>
          </div>
          <button 
            className="v-btn v-btn-sm" 
            style={{ 
              background: 'rgba(239, 68, 68, 0.12)', 
              color: '#DC2626', 
              border: 'none',
              padding: '6px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}
            onClick={refreshAll}
          >
            <RefreshCw size={12} />
            Retry
          </button>
        </div>
      )}

      {/* Cards Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Available Balance', value: `₹${available.toLocaleString()}`, sub: 'Ready to withdraw', icon: <DollarSign size={22} style={{ color: '#7B3FA0' }} />, highlight: true  },
          { label: 'Total Withdrawn',   value: `₹${totalWithdrawnAmount.toLocaleString()}`, sub: 'All-time payouts', icon: <CheckCircle2 size={22} style={{ color: '#16a34a' }} />, highlight: false },
          { label: 'Pending Payouts',   value: `₹${totalPendingAmount.toLocaleString()}`, sub: 'Processing request', icon: <Clock size={22} style={{ color: '#d97706' }} />, highlight: false },
        ].map(c => (
          <div key={c.label} className="v-card v-card-pad" style={{
            background: c.highlight ? 'linear-gradient(135deg,rgba(123,63,160,0.12),rgba(184,134,208,0.10))' : undefined,
            border: c.highlight ? '1px solid rgba(184,134,208,0.35)' : undefined,
            flex: 1
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(123,63,160,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {c.icon}
              </div>
              <div>
                <div style={{ fontFamily: 'var(--v-serif)', fontSize: 24, color: 'var(--v-dark)', fontWeight: 600, lineHeight: 1 }}>{loading ? '…' : c.value}</div>
                <div style={{ fontSize: 11, color: 'var(--v-text3)', marginTop: 4 }}>{c.sub}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--v-text2)', fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 20 }}>

        {/* Withdrawal History */}
        <div className="v-card">
          <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--v-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="v-section-title">Withdrawal History</div>
            <button className="v-btn v-btn-ghost v-btn-sm" style={{ display: 'flex', alignItems: 'center', gap: 4 }} onClick={refreshAll} disabled={loading}>
              <RefreshCw size={12} className={loading ? 'spin-icon' : ''} style={{ animation: loading ? 'spin 1.5s linear infinite' : 'none' }} />
              Refresh
            </button>
          </div>
          {loading ? (
            <div className="v-card v-card-pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', gap: 12 }}>
              <RefreshCw size={28} className="text-purple" style={{ animation: 'spin 2s linear infinite', color: 'var(--v-purple)' }} />
              <div style={{ color: 'var(--v-text3)', fontSize: 13, fontWeight: 500 }}>Loading withdrawal history...</div>
            </div>
          ) : (
            <div className="v-table-wrap">
              <table className="v-table">
                <thead>
                  <tr><th>ID</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>ETA</th></tr>
                </thead>
                <tbody>
                  {history.map((w, idx) => {
                    const st = STATUS_MAP[w.status] || STATUS_MAP.pending;
                    const dateStr = w.date || (w.createdAt
                      ? new Date(w.createdAt).toLocaleDateString() : '—');
                    return (
                      <tr key={w.id || idx}>
                        <td style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--v-mid)', fontWeight: 600 }}>{w.id || `WD-TEMP-${idx}`}</td>
                        <td style={{ fontWeight: 600, color: 'var(--v-dark)' }}>₹{(w.amount || 0).toLocaleString()}</td>
                        <td style={{ fontSize: 13, textTransform: 'capitalize' }}>{w.method}</td>
                        <td><span className={`v-badge ${st.cls}`}><span className="v-badge-dot" />{st.label}</span></td>
                        <td style={{ fontSize: 12, color: 'var(--v-text3)' }}>{dateStr}</td>
                        <td style={{ fontSize: 12, color: 'var(--v-text3)' }}>{w.eta || 'Instant'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {!loading && history.length === 0 && (
            <div className="v-empty">
              <div className="v-empty-icon">📤</div>
              <div className="v-empty-title">No withdrawals yet</div>
              <div className="v-empty-sub">Your payout history will appear here</div>
            </div>
          )}
        </div>

        {/* Withdrawal Form */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="v-card v-card-pad">
            <div className="v-section-title" style={{ marginBottom: 20 }}>Request Withdrawal</div>

            {success ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
                <div style={{ fontWeight: 600, color: 'var(--v-dark)', marginBottom: 6 }}>Withdrawal Requested</div>
                <div style={{ fontSize: 13, color: 'var(--v-text3)', marginBottom: 20 }}>
                  Your payout will be processed within the estimated time.
                </div>
                <button className="v-btn v-btn-secondary" style={{ width: '100%' }} onClick={() => setSuccess(false)}>
                  New Withdrawal
                </button>
              </div>
            ) : (
              <form onSubmit={handleWithdraw}>
                {formError && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                    background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.20)',
                    color: '#dc2626', fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <AlertCircle size={14} />
                    <span>{formError}</span>
                  </div>
                )}
                
                {hasPending && (
                  <div style={{ padding: '10px 14px', borderRadius: 10, marginBottom: 16,
                    background: 'rgba(217,119,6,0.07)', border: '1px solid rgba(217,119,6,0.20)',
                    color: '#d97706', fontSize: 12.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <Clock size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                    <span><strong>Payout Pending:</strong> You already have a pending withdrawal request in progress. To prevent duplicate requests, further submissions are locked.</span>
                  </div>
                )}

                <div className="v-field">
                  <label className="v-label">Amount (₹)</label>
                  <input className="v-input" type="number" placeholder="Enter amount"
                    min="500" max={available} value={amount}
                    disabled={hasPending || submitting}
                    onChange={e => setAmount(e.target.value)} />
                  <div className="v-field-hint">Available: ₹{available.toLocaleString()} · Min: ₹500</div>
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  {[5000, 10000, 25000].map(q => (
                    <button key={q} type="button" className="v-btn v-btn-secondary v-btn-sm"
                      disabled={hasPending || submitting || q > available}
                      onClick={() => setAmount(String(Math.min(q, available)))}>
                      ₹{(q / 1000).toFixed(0)}K
                    </button>
                  ))}
                  <button type="button" className="v-btn v-btn-secondary v-btn-sm"
                    disabled={hasPending || submitting || available < 500}
                    onClick={() => setAmount(String(available))}>Max</button>
                </div>
                <div className="v-field">
                  <label className="v-label">Payout Method</label>
                  <select className="v-select" value={method} disabled={hasPending || submitting} onChange={e => setMethod(e.target.value)}>
                    <option value="upi">UPI (Instant)</option>
                    <option value="bank">Bank Transfer (2-3 days)</option>
                  </select>
                </div>
                
                {method === 'upi' ? (
                  <div className="v-field">
                    <label className="v-label">UPI ID</label>
                    <input className="v-input" placeholder="yourname@upi"
                      disabled={hasPending || submitting}
                      value={upiId} onChange={e => setUpiId(e.target.value)} />
                  </div>
                ) : (
                  <div className="v-field">
                    <label className="v-label">Bank Account Details</label>
                    <input className="v-input" placeholder="Enter account number / IFSC"
                      disabled={hasPending || submitting}
                      value={bankAccount} onChange={e => setBankAccount(e.target.value)} />
                  </div>
                )}

                {amount && Number(amount) >= 500 && Number(amount) <= available && (
                  <div style={{ padding: '16px', borderRadius: '12px', background: 'rgba(168,85,247,0.04)',
                    border: '1px solid rgba(168,85,247,0.12)', marginBottom: '16px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--v-text3)', marginBottom: 8 }}>
                      <span>Amount requested</span><span>₹{Number(amount).toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--v-text3)', marginBottom: 8 }}>
                      <span>Platform fee</span><span>₹0</span>
                    </div>
                    <div style={{ height: '1px', background: 'var(--v-border)', marginBottom: 8 }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13.5px', fontWeight: 600, color: 'var(--v-deep)' }}>
                      <span>Net payout</span><span>₹{Number(amount).toLocaleString()}</span>
                    </div>
                  </div>
                )}
                
                <button type="submit" className="v-btn v-btn-primary v-btn-lg"
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }} 
                  disabled={hasPending || submitting || !amount || Number(amount) < 500}>
                  {submitting ? (
                    <>
                      <RefreshCw size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      <span>Withdraw{amount ? ` ₹${Number(amount).toLocaleString()}` : ''}</span>
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

          <div className="v-card v-card-pad" style={{ background: 'rgba(216,191,227,0.12)' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--v-deep)', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <HelpCircle size={14} />
              <span>Payout Information</span>
            </div>
            {[
              'UPI withdrawals are processed instantly',
              'Bank transfers take 2-3 business days',
              'Minimum withdrawal amount is ₹500',
              'No withdrawal fees on Lumora',
            ].map((t, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--v-text2)', marginBottom: 6, display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--v-soft)' }}>✦</span> {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </VendorLayout>
  );
}
