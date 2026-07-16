import React, { useState, useEffect } from 'react';
import AdminLayout from './components/AdminLayout';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc 
} from 'firebase/firestore';
import { db } from '../../firebase';
import { 
  Sparkles, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  Users, 
  Gift, 
  TrendingUp, 
  Clock, 
  X, 
  CheckCircle,
  FileText
} from 'lucide-react';

export default function PromotionsManagement() {
  const [promotions, setPromotions] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [transactions, setTransactions] = useState([]);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPromo, setSelectedPromo] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  // Form states for creating a promotion
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetSales, setTargetSales] = useState(5);
  const [rewardValue, setRewardValue] = useState(1000);
  const [submitting, setSubmitting] = useState(false);

  // ─── REAL-TIME LISTENERS ──────────────────────────────────────────────────
  useEffect(() => {
    // 1. Listen to adminPromotions
    const promoQuery = query(collection(db, 'adminPromotions'));
    const unsubPromos = onSnapshot(promoQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
      setPromotions(list);
    }, (err) => {
      console.error('[PromotionsManagement] Promos listener error:', err);
    });

    // 2. Listen to promotionParticipants
    const partQuery = query(collection(db, 'promotionParticipants'));
    const unsubParts = onSnapshot(partQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setParticipants(list);
    }, (err) => {
      console.error('[PromotionsManagement] Participants listener error:', err);
    });

    // 3. Listen to promotionTransactions
    const txQuery = query(collection(db, 'promotionTransactions'));
    const unsubTxs = onSnapshot(txQuery, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => new Date(b.claimedAt || 0) - new Date(a.claimedAt || 0));
      setTransactions(list);
    }, (err) => {
      console.error('[PromotionsManagement] Transactions listener error:', err);
    });

    return () => {
      unsubPromos();
      unsubParts();
      unsubTxs();
    };
  }, []);

  // ─── HANDLERS ─────────────────────────────────────────────────────────────
  const handleCreatePromo = async (e) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    setSubmitting(true);

    try {
      await addDoc(collection(db, 'adminPromotions'), {
        title: title.trim(),
        description: description.trim(),
        targetSales: Number(targetSales),
        rewardValue: Number(rewardValue),
        status: 'active', // default active
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      // Reset form
      setTitle('');
      setDescription('');
      setTargetSales(5);
      setRewardValue(1000);
      setIsModalOpen(false);
    } catch (err) {
      console.error('[Promotions] Error creating promo:', err);
      alert('Failed to create promotion');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (promo) => {
    const nextStatus = promo.status === 'active' ? 'paused' : 'active';
    try {
      await updateDoc(doc(db, 'adminPromotions', promo.id), {
        status: nextStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error('[Promotions] Error toggling status:', err);
    }
  };

  const handleDeletePromo = async (promoId) => {
    if (!window.confirm('Are you sure you want to delete this promotion? This action cannot be undone.')) return;
    try {
      await deleteDoc(doc(db, 'adminPromotions', promoId));
      if (selectedPromo?.id === promoId) {
        setIsDetailDrawerOpen(false);
        setSelectedPromo(null);
      }
    } catch (err) {
      console.error('[Promotions] Error deleting promo:', err);
    }
  };

  // Helper calculation values
  const totalActivePromos = promotions.filter(p => p.status === 'active').length;
  const totalJoinedParticipants = participants.length;
  const claimedTransactions = transactions.filter(t => t.status === 'claimed' || t.status === 'paid' || t.status === 'pending');
  const totalPayoutINR = claimedTransactions.reduce((acc, t) => acc + (t.rewardAmount || 0), 0);

  const getPromoParticipants = (promoId) => {
    return participants.filter(p => p.promotionId === promoId);
  };

  return (
    <AdminLayout activePage="promotions">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', color: '#2D004D' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <span style={{ fontSize: '0.65rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E6AA8' }}>Ecosystem Management</span>
            <h1 className="text-editorial" style={{ fontSize: '2rem', fontWeight: 400, marginTop: '2px', color: 'var(--color-espresso)' }}>
              Promotions Control Center
            </h1>
            <p style={{ color: 'rgba(45,0,77,0.6)', fontSize: '0.82rem', marginTop: '4px' }}>
              Create and manage isolated administrative referral challenges and incentives for affiliates.
            </p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="v-btn v-btn-primary" 
            style={{ borderRadius: '20px', gap: '6px' }}
          >
            <Plus size={16} /> Create Promotion
          </button>
        </div>

        {/* Stats Strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
          <div className="glass-surface" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8E6AA8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Challenges</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-serif)' }}>{promotions.length}</div>
              <span style={{ fontSize: '0.65rem', color: '#22c55e', fontWeight: 600 }}>{totalActivePromos} Currently Active</span>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(123,63,160,0.06)', color: '#7B3FA0', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(123,63,160,0.1)' }}>
              <Sparkles size={18} />
            </div>
          </div>

          <div className="glass-surface" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8E6AA8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Enrolled</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-serif)' }}>{totalJoinedParticipants}</div>
              <span style={{ fontSize: '0.65rem', color: '#8E6AA8', fontWeight: 500 }}>Affiliates Participating</span>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59,130,246,0.06)', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(59,130,246,0.1)' }}>
              <Users size={18} />
            </div>
          </div>

          <div className="glass-surface" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8E6AA8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unresolved Claims</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-serif)' }}>{transactions.filter(t => t.status === 'pending').length}</div>
              <span style={{ fontSize: '0.65rem', color: '#b45309', fontWeight: 600 }}>Awaiting Verification</span>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(245,158,11,0.06)', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(245,158,11,0.1)' }}>
              <Clock size={18} />
            </div>
          </div>

          <div className="glass-surface" style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#8E6AA8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Disbursed Payout</span>
              <div style={{ fontSize: '2rem', fontWeight: 800, marginTop: '4px', fontFamily: 'var(--font-serif)', color: '#16a34a' }}>
                ₹{totalPayoutINR.toLocaleString()}
              </div>
              <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 600 }}>{claimedTransactions.length} Paid Claims</span>
            </div>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(34,197,94,0.06)', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(34,197,94,0.1)' }}>
              <Gift size={18} />
            </div>
          </div>
        </div>

        {/* Challenge Control Table */}
        <div className="glass-surface" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(142, 106, 168, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} style={{ color: '#7B3FA0' }} /> Active Challenges & Payout Rules
            </h3>
          </div>
          {promotions.length === 0 ? (
            <div style={{ padding: '60px 24px', textAlign: 'center', color: '#8E6AA8' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '8px' }}>🏷️</div>
              <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>No promotions configured</div>
              <div style={{ fontSize: '0.8rem', marginTop: '4px' }}>Click "Create Promotion" to set up your first referral challenge.</div>
            </div>
          ) : (
            <div className="v-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="v-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Challenge Details</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Target Referrals</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Cash Reward</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Enrollments</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Status</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {promotions.map(promo => {
                    const enrolledCount = getPromoParticipants(promo.id).length;
                    return (
                      <tr key={promo.id} style={{ borderBottom: '1px solid rgba(142, 106, 168, 0.08)' }}>
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{promo.title}</div>
                          <div style={{ fontSize: '0.75rem', color: 'rgba(45,0,77,0.6)', marginTop: '2px', maxWidth: '320px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {promo.description}
                          </div>
                        </td>
                        <td style={{ padding: '16px 20px', fontWeight: 700 }}>
                          {promo.targetSales} Sales
                        </td>
                        <td style={{ padding: '16px 20px', color: '#7B3FA0', fontWeight: 800 }}>
                          ₹{promo.rewardValue.toLocaleString()}
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <button 
                            onClick={() => { setSelectedPromo(promo); setIsDetailDrawerOpen(true); }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(123,63,160,0.06)', border: 'none', padding: '4px 10px', borderRadius: '12px', fontSize: '0.75rem', color: '#7B3FA0', cursor: 'pointer', fontWeight: 600 }}
                          >
                            <Users size={12} /> {enrolledCount} joined
                          </button>
                        </td>
                        <td style={{ padding: '16px 20px' }}>
                          <span className={`v-badge ${promo.status === 'active' ? 'v-badge-green' : 'v-badge-gray'}`}>
                            {promo.status}
                          </span>
                        </td>
                        <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '8px' }}>
                            <button 
                              onClick={() => handleToggleStatus(promo)}
                              className="v-btn v-btn-ghost v-btn-sm" 
                              style={{ width: '32px', height: '32px', padding: 0 }}
                              title={promo.status === 'active' ? 'Pause Challenge' : 'Activate Challenge'}
                            >
                              {promo.status === 'active' ? <Pause size={14} /> : <Play size={14} />}
                            </button>
                            <button 
                              onClick={() => handleDeletePromo(promo.id)}
                              className="v-btn v-btn-ghost v-btn-sm" 
                              style={{ width: '32px', height: '32px', padding: 0, color: '#dc2626', borderColor: 'rgba(220,38,38,0.15)' }}
                              title="Delete Challenge"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Claim Transactions Log */}
        <div className="glass-surface" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(142, 106, 168, 0.1)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Gift size={16} style={{ color: '#16a34a' }} /> Rewards Claim Ledger
            </h3>
          </div>
          {transactions.length === 0 ? (
            <div style={{ padding: '40px 24px', textAlign: 'center', color: '#8E6AA8', fontSize: '0.8rem' }}>
              No claims processed yet.
            </div>
          ) : (
            <div className="v-table-wrap" style={{ border: 'none', borderRadius: 0 }}>
              <table className="v-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Date Claimed</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Affiliate Details</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Promotion</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Claim Payout</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8' }}>Payout Status</th>
                    <th style={{ padding: '14px 20px', fontSize: '0.75rem', color: '#8E6AA8', textAlign: 'right' }}>Verify Payout</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(tx => (
                    <tr key={tx.id} style={{ borderBottom: '1px solid rgba(142, 106, 168, 0.08)' }}>
                      <td style={{ padding: '16px 20px', fontSize: '0.78rem', color: 'rgba(45,0,77,0.6)' }}>
                        {tx.claimedAt ? new Date(tx.claimedAt).toLocaleString('en-IN') : '—'}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{tx.affiliateName || 'Affiliate'}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Code: {tx.affiliateCode || '—'}</div>
                      </td>
                      <td style={{ padding: '16px 20px', fontSize: '0.82rem', fontWeight: 600 }}>
                        {tx.promotionTitle}
                      </td>
                      <td style={{ padding: '16px 20px', fontWeight: 800, color: '#16a34a' }}>
                        ₹{tx.rewardAmount.toLocaleString()}
                      </td>
                      <td style={{ padding: '16px 20px' }}>
                        <span className={`v-badge ${tx.status === 'paid' ? 'v-badge-green' : 'v-badge-amber'}`}>
                          {tx.status || 'pending'}
                        </span>
                      </td>
                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        {tx.status !== 'paid' ? (
                          <button 
                            onClick={async () => {
                              try {
                                await updateDoc(doc(db, 'promotionTransactions', tx.id), {
                                  status: 'paid',
                                  paidAt: new Date().toISOString()
                                });
                              } catch (err) {
                                console.error('Failed to update transaction status:', err);
                              }
                            }}
                            className="v-btn v-btn-primary v-btn-sm"
                            style={{ padding: '0 10px', fontSize: '0.7rem', height: '26px' }}
                          >
                            Disburse Cash
                          </button>
                        ) : (
                          <span style={{ fontSize: '0.72rem', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <CheckCircle size={12} /> Claim Disbursed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ─── CREATION MODAL ──────────────────────────────────────────────── */}
        {isModalOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,0,77,0.35)', backdropFilter: 'blur(10px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
            <div className="modal" style={{ maxWidth: '460px', width: '100%', padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', border: '1px solid rgba(255,255,255,0.4)', boxShadow: '0 24px 64px rgba(0,0,0,0.18)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={18} style={{ color: '#7B3FA0' }} /> Create Promotion Campaign
                </h3>
                <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreatePromo} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="v-field">
                  <label className="v-label">Promotion Title</label>
                  <input 
                    type="text" 
                    className="v-input" 
                    placeholder="e.g. Summer Sprint Referral Challenge"
                    value={title} 
                    onChange={e => setTitle(e.target.value)}
                    required 
                  />
                </div>

                <div className="v-field">
                  <label className="v-label">Description & Rules</label>
                  <textarea 
                    className="v-textarea" 
                    rows="3" 
                    placeholder="Describe how to qualify and qualifing parameters..."
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    required 
                  />
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="v-field">
                    <label className="v-label">Sales Target</label>
                    <input 
                      type="number" 
                      className="v-input" 
                      min="1"
                      value={targetSales} 
                      onChange={e => setTargetSales(e.target.value)}
                      required 
                    />
                  </div>

                  <div className="v-field">
                    <label className="v-label">Cash Payout (₹)</label>
                    <input 
                      type="number" 
                      className="v-input" 
                      min="100"
                      value={rewardValue} 
                      onChange={e => setRewardValue(e.target.value)}
                      required 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={submitting}
                  className="v-btn v-btn-primary" 
                  style={{ width: '100%', marginTop: '8px' }}
                >
                  {submitting ? 'Creating...' : 'Launch Challenge'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ─── DETAIL DRAWER (Participant Progress List) ───────────────────── */}
        {isDetailDrawerOpen && selectedPromo && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(45,0,77,0.30)', backdropFilter: 'blur(8px)', zIndex: 999, display: 'flex', justifyContent: 'flex-end' }}>
            <div 
              className="drawer"
              style={{ 
                maxWidth: '480px', 
                width: '100%', 
                height: '100%', 
                background: 'rgba(255,255,255,0.75)', 
                backdropFilter: 'blur(30px)',
                borderLeft: '1px solid rgba(255,255,255,0.4)', 
                padding: '32px', 
                boxSizing: 'border-box', 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '24px', 
                overflowY: 'auto' 
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, textTransform: 'uppercase', color: '#8E6AA8', letterSpacing: '0.04em' }}>Challenge Enrollment Registry</span>
                  <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: '2px 0 0 0' }}>{selectedPromo.title}</h3>
                </div>
                <button onClick={() => setIsDetailDrawerOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  <X size={20} />
                </button>
              </div>

              <div style={{ padding: '14px', borderRadius: '12px', background: 'rgba(123,63,160,0.04)', border: '1px solid rgba(196,181,253,0.18)', fontSize: '0.8rem', lineHeight: 1.5 }}>
                <div style={{ fontWeight: 700, color: '#7B3FA0' }}>Qualified Payout: ₹{selectedPromo.rewardValue.toLocaleString()} Cash</div>
                <div style={{ marginTop: '4px', color: 'rgba(45,0,77,0.7)' }}>Requirement: Refer {selectedPromo.targetSales} orders during the active challenge.</div>
              </div>

              <div>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: '#8E6AA8', marginBottom: '14px', letterSpacing: '0.04em' }}>
                  Enrolled Affiliates ({getPromoParticipants(selectedPromo.id).length})
                </h4>

                {getPromoParticipants(selectedPromo.id).length === 0 ? (
                  <p style={{ fontSize: '0.8rem', color: '#8E6AA8', textAlign: 'center', padding: '24px 0' }}>
                    No affiliates have joined this promotion yet.
                  </p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    {getPromoParticipants(selectedPromo.id).map(part => {
                      const ratio = Math.min(1, part.currentSales / part.targetSales);
                      const pct = Math.round(ratio * 100);
                      return (
                        <div key={part.id} className="glass-surface" style={{ padding: '14px', border: '1px solid rgba(196,181,253,0.15)', borderRadius: '14px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.82rem' }}>{part.affiliateName || 'Affiliate'}</div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Code: {part.affiliateCode || '—'}</div>
                            </div>
                            <span className={`v-badge ${part.status === 'claimed' ? 'v-badge-green' : part.status === 'completed' ? 'v-badge-blue' : 'v-badge-purple'}`}>
                              {part.status}
                            </span>
                          </div>
                          
                          {/* Progress bar */}
                          <div style={{ marginTop: '8px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, marginBottom: '4px', color: '#8E6AA8' }}>
                              <span>Conversion Goal Progress</span>
                              <span>{part.currentSales} / {part.targetSales} ({pct}%)</span>
                            </div>
                            <div style={{ width: '100%', height: '6px', background: 'rgba(142,106,168,0.12)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div 
                                style={{ 
                                  height: '100%', 
                                  background: part.status === 'claimed' || part.status === 'completed' 
                                    ? 'linear-gradient(to right, #10B981, #34d399)' 
                                    : 'linear-gradient(to right, #7B3FA0, #B886D0)', 
                                  width: `${pct}%`,
                                  transition: 'width 0.3s'
                                }} 
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
}
