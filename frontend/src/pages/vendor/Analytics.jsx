import React, { useState, useEffect } from 'react';
import VendorLayout from './VendorLayout';
import '../styles/vendor.css';
import { useOrders, useVendorProducts, useReviews } from '../../hooks/useVendorData';
import { useVendorChartData } from '../../hooks/useVendorChartData';
import VendorChartControls from '../../components/vendor/VendorChartControls';
import VendorBarChart from '../../components/vendor/VendorBarChart';
import {
  DollarSign, Package, Target, CreditCard,
  TrendingUp, Star, Eye, Users,
  RefreshCw, AlertCircle, BarChart2
} from 'lucide-react';

function useIsMobile(bp = 768) {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.innerWidth < bp);
  useEffect(() => {
    const h = () => setM(window.innerWidth < bp);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, [bp]);
  return m;
}

export default function Analytics() {
  const [period, setPeriod] = useState('12m');
  const [selectedMonth, setSelectedMonth] = useState(null);
  const isMobile = useIsMobile();

  const { orders: allOrders, loading: ordersLoading, error: ordersError, refresh: refreshOrders } = useOrders();
  const { products: allProducts, loading: productsLoading, error: productsError, refresh: refreshProducts } = useVendorProducts({ limit: 1000 });
  const { reviews: allReviews, loading: reviewsLoading, error: reviewsError, refresh: refreshReviews } = useReviews();

  const loading = ordersLoading || productsLoading || reviewsLoading;
  const backendError = ordersError || productsError || reviewsError;
  const refreshAll = () => { refreshOrders(); refreshProducts(); refreshReviews(); };

  const { series, filteredOrders } = useVendorChartData(allOrders, period, selectedMonth);

  const orders = filteredOrders;
  const reviews = allReviews || [];

  const totalRevenue = orders.reduce((s, o) => s + (o.amount || 0), 0);
  const totalOrders = orders.length;
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

  // Revenue-only and orders-only series for the two separate charts
  const revenueSeries = series.map(s => ({ ...s }));
  const ordersSeries  = series.map(s => ({ ...s, revenue: s.orders, net: null }));

  // Top Products
  const productPerformance = {};
  orders.forEach(o => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach(item => {
        const pId = item.productId || 'unknown';
        if (!productPerformance[pId]) productPerformance[pId] = { name: item.productName || 'Product', revenue: 0, sales: 0 };
        productPerformance[pId].revenue += item.pricePaid || item.price || 0;
        productPerformance[pId].sales += 1;
      });
    } else {
      const pId = o.productId || 'unknown';
      if (!productPerformance[pId]) productPerformance[pId] = { name: o.productName || o.product || 'Product', revenue: 0, sales: 0 };
      productPerformance[pId].revenue += o.amount || 0;
      productPerformance[pId].sales += 1;
    }
  });
  const topProductsList = Object.values(productPerformance).sort((a, b) => b.revenue - a.revenue).slice(0, 4).map(p => ({ ...p, growth: p.sales > 5 ? 15 : 5 }));

  // Customer retention
  const allOrdersArr = allOrders || [];
  const buyerCounts = {};
  orders.forEach(o => {
    const key = o.customerEmail || o.email || o.customerName || o.customerId;
    if (key) buyerCounts[key] = (buyerCounts[key] || 0) + 1;
  });
  const totalBuyers = Object.keys(buyerCounts).length;
  const repeatBuyers = Object.values(buyerCounts).filter(c => c > 1).length;
  const repeatRate = totalBuyers > 0 ? Math.round((repeatBuyers / totalBuyers) * 100) : 0;

  const customerFirstOrder = {};
  allOrdersArr.forEach(o => {
    const key = o.customerEmail || o.email || o.customerName || o.customerId;
    if (key) {
      const d = new Date(o.createdAt || o.date);
      if (!customerFirstOrder[key] || d < customerFirstOrder[key]) customerFirstOrder[key] = d;
    }
  });
  const startDate = new Date(); startDate.setMonth(startDate.getMonth() - 1);
  const newCustomersCount = Object.values(customerFirstOrder).filter(d => d >= startDate).length;

  const avgReviewScore = reviews.length > 0
    ? (reviews.reduce((s, r) => s + (r.rating || 0), 0) / reviews.length).toFixed(1)
    : '0.0';

  const formatRevenue = v => v >= 100000 ? `₹${(v / 100000).toFixed(2)}L` : `₹${v.toLocaleString()}`;

  const SkeletonCard = () => (
    <div className="v-card v-stat-card" style={{ height: 110, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'skeleton-shimmer 1.5s infinite' }} />
    </div>
  );
  const SkeletonBlock = ({ h }) => (
    <div className="v-card" style={{ height: h, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation: 'skeleton-shimmer 1.5s infinite' }} />
    </div>
  );

  return (
    <VendorLayout activePage="analytics" title="Analytics" subtitle="Business intelligence and performance metrics">
      {backendError && (
        <div style={{ padding:'14px 20px', borderRadius:16, background:'rgba(239,68,68,0.08)', border:'1px solid rgba(239,68,68,0.2)', color:'#DC2626', fontSize:13.5, display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20, backdropFilter:'blur(8px)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}><AlertCircle size={16} /><span>{backendError}</span></div>
          <button className="v-btn v-btn-sm" style={{ background:'rgba(239,68,68,0.12)', color:'#DC2626', border:'none', padding:'6px 12px', borderRadius:8, cursor:'pointer', fontWeight:600, display:'flex', alignItems:'center', gap:4 }} onClick={refreshAll}>
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}

      {/* ── Filter controls ── */}
      <div style={{ display:'flex', justifyContent: isMobile ? 'flex-start' : 'flex-end', marginBottom:20 }}>
        <VendorChartControls
          period={period} onPeriod={p => { setPeriod(p); setSelectedMonth(null); }}
          month={selectedMonth} onMonth={setSelectedMonth}
          isMobile={isMobile}
        />
      </div>

      {/* ── Stat cards ── */}
      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:16, marginBottom:24 }}>
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="v-stat-grid" style={{ marginBottom:24 }}>
          {[
            { label:'Total Revenue',   value: formatRevenue(totalRevenue), delta:'+18.4%', up:true,  icon:<DollarSign size={18} style={{ color:'#7B3FA0' }} /> },
            { label:'Total Orders',    value: totalOrders,                 delta:'+12.1%', up:true,  icon:<Package size={18} style={{ color:'#7B3FA0' }} /> },
            { label:'Avg Conversion',  value: '—',                         delta:'+0.8pp', up:true,  icon:<Target size={18} style={{ color:'#7B3FA0' }} /> },
            { label:'Avg Order Value', value: `₹${avgOrderValue.toLocaleString()}`, delta:'+5.2%', up:true, icon:<CreditCard size={18} style={{ color:'#7B3FA0' }} /> },
          ].map((s, i) => (
            <div key={i} className="v-card v-stat-card">
              <div className="v-stat-header">
                <div className="v-stat-icon" style={{ background:'rgba(184,134,208,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>{s.icon}</div>
                <span className={`v-stat-badge ${s.up ? 'up' : 'down'}`}>{s.delta}</span>
              </div>
              <div className="v-stat-value">{s.value}</div>
              <div className="v-stat-label">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── Revenue & Orders charts ── */}
      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:20, marginBottom:24 }}>
          <SkeletonBlock h={220} /><SkeletonBlock h={220} />
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:20, marginBottom:24 }}>
          <div className="v-card v-card-pad">
            <div className="v-section-header">
              <div>
                <div className="v-section-title" style={{ display:'flex', alignItems:'center', gap:6 }}><BarChart2 size={16} /><span>Revenue Trend</span></div>
                <div className="v-section-sub">Earnings over time (₹)</div>
              </div>
              {totalRevenue > 0 && <span className="v-kpi-delta up">+18.4%</span>}
            </div>
            <VendorBarChart series={revenueSeries} height={140} showOrders isMobile={isMobile} />
          </div>
          <div className="v-card v-card-pad">
            <div className="v-section-header">
              <div>
                <div className="v-section-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Package size={16} /><span>Order Volume</span></div>
                <div className="v-section-sub">Orders per period</div>
              </div>
              {totalOrders > 0 && <span className="v-kpi-delta up">+12.1%</span>}
            </div>
            <VendorBarChart
              series={ordersSeries}
              height={140}
              color="#D8BFE3"
              isMobile={isMobile}
            />
          </div>
        </div>
      )}

      {/* ── Conversion & Top Products ── */}
      {loading ? (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:20, marginBottom:24 }}>
          <SkeletonBlock h={240} /><SkeletonBlock h={240} />
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:20, marginBottom:24 }}>
          <div className="v-card v-card-pad">
            <div className="v-section-header">
              <div>
                <div className="v-section-title" style={{ display:'flex', alignItems:'center', gap:6 }}><Target size={16} /><span>Conversion Rate</span></div>
                <div className="v-section-sub">Estimated visitor conversion (%)</div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:120, color:'var(--v-text3)', gap:6 }}>
              <Target size={32} style={{ opacity:0.3 }} />
              <span style={{ fontSize:12.5 }}>Conversion tracking coming soon</span>
            </div>
            <div style={{ display:'flex', justifyContent:'space-around', marginTop:12 }}>
              {['Average','Peak','Lowest'].map(l => (
                <div key={l} style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:'var(--v-serif)', fontSize:20, color:'var(--v-dark)', fontWeight:600 }}>—</div>
                  <div style={{ fontSize:11, color:'var(--v-text3)' }}>{l}</div>
                </div>
              ))}
            </div>
          </div>
          <div className="v-card v-card-pad">
            <div className="v-section-title" style={{ marginBottom:16, display:'flex', alignItems:'center', gap:6 }}><TrendingUp size={16} /><span>Top Products by Revenue</span></div>
            {topProductsList.length > 0 ? topProductsList.map((p, i) => (
              <div key={p.name} style={{ display:'flex', alignItems:'center', gap:12, marginBottom:14 }}>
                <div style={{ width:28, height:28, borderRadius:8, flexShrink:0, background:'linear-gradient(135deg,#D8BFE3,#B886D0)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'#fff' }}>{i+1}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:500, color:'var(--v-dark)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                  <div style={{ fontSize:11, color:'var(--v-text3)' }}>{p.sales} sales</div>
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'var(--v-deep)' }}>₹{p.revenue >= 1000 ? `${(p.revenue/1000).toFixed(0)}K` : p.revenue.toLocaleString()}</div>
                  <span className={`v-kpi-delta ${p.growth >= 0 ? 'up' : 'down'}`} style={{ fontSize:10 }}>{p.growth >= 0 ? '+' : ''}{p.growth}%</span>
                </div>
              </div>
            )) : (
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100%', minHeight:180, color:'var(--v-text3)' }}>
                <BarChart2 size={32} style={{ opacity:0.3, marginBottom:6 }} />
                <span style={{ fontSize:12.5 }}>No product sales recorded</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Customer Metrics ── */}
      {loading ? (
        <div className="v-card" style={{ height:160, position:'relative', overflow:'hidden' }}>
          <div style={{ position:'absolute', inset:0, background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent)', animation:'skeleton-shimmer 1.5s infinite' }} />
        </div>
      ) : (
        <div className="v-card v-card-pad">
          <div className="v-section-title" style={{ marginBottom:20, display:'flex', alignItems:'center', gap:6 }}><Users size={16} /><span>Growth & Customer Metrics</span></div>
          <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:20 }}>
            {[
              { label:'New Customers',    value: newCustomersCount, delta:'+22%', sub:'this period',    icon:<Users size={16} style={{ color:'#7B3FA0' }} /> },
              { label:'Repeat Buyers',    value: `${repeatRate}%`,  delta:'+4pp', sub:'retention rate', icon:<Target size={16} style={{ color:'#16a34a' }} /> },
              { label:'Avg Review Score', value: avgReviewScore,    delta:'+0.2', sub:'out of 5 stars', icon:<Star size={16} style={{ color:'#eab308' }} /> },
              { label:'Estimated Views',  value: '—',               delta:'+31%', sub:'Not yet tracked',icon:<Eye size={16} style={{ color:'#9ca3af' }} /> },
            ].map(m => (
              <div key={m.label} style={{ textAlign:'center', padding:16, borderRadius:12, background:'rgba(216,191,227,0.12)', border:'1px solid rgba(184,134,208,0.15)' }}>
                <div style={{ display:'flex', justifyContent:'center', marginBottom:8 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(255,255,255,0.8)', display:'flex', alignItems:'center', justifyContent:'center' }}>{m.icon}</div>
                </div>
                <div style={{ fontFamily:'var(--v-serif)', fontSize:26, color:'var(--v-dark)', fontWeight:600, marginBottom:4 }}>{m.value}</div>
                <span className="v-kpi-delta up" style={{ fontSize:11 }}>{m.delta}</span>
                <div style={{ fontSize:11, color:'var(--v-text3)', marginTop:6, fontWeight:500 }}>{m.label}</div>
                <div style={{ fontSize:10, color:'var(--v-text3)' }}>{m.sub}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </VendorLayout>
  );
}
