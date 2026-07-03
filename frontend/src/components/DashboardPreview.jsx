import React, { useState } from 'react';
import { AreaChart, IndianRupee, Download, Sparkles, TrendingUp, Calendar, ShieldCheck } from 'lucide-react';

export default function DashboardPreview() {
  const [activeTab, setActiveTab] = useState('weekly');

  // Chart data coordinate sets for SVG paths
  const chartData = {
    weekly: {
      linePath: "M 0 100 Q 50 80 100 90 T 200 40 T 300 60 T 400 20 T 500 50 T 600 30 T 700 45 L 700 150 L 0 150 Z",
      strokePath: "M 0 100 Q 50 80 100 90 T 200 40 T 300 60 T 400 20 T 500 50 T 600 30 T 700 45",
      revenue: "₹22,76,000",
      downloads: "1,240 downloads",
      growth: "+14.8%"
    },
    monthly: {
      linePath: "M 0 120 Q 50 110 100 70 T 200 80 T 300 40 T 400 30 T 500 20 T 600 15 T 700 10 L 700 150 L 0 150 Z",
      strokePath: "M 0 120 Q 50 110 100 70 T 200 80 T 300 40 T 400 30 T 500 20 T 600 15 T 700 10",
      revenue: "₹94,56,000",
      downloads: "5,820 downloads",
      growth: "+22.4%"
    }
  };

  return (
    <section 
      id="dashboard" 
      className="section-padding"
      style={{ position: 'relative', zIndex: 10 }}
    >
      {/* Dynamic ambient backdrop */}
      <div 
        className="ambient-glow pulse-ambient" 
        style={{
          background: 'var(--color-lavender)',
          width: '600px',
          height: '600px',
          left: '5%',
          top: '30%',
          opacity: 0.12,
          filter: 'blur(110px)'
        }}
      />

      <div className="container-wide">
        {/* Section Header */}
        <div style={{ textAlign: 'center', marginBottom: '64px' }}>
          <div className="caption-premium" style={{ marginBottom: '12px' }}>EXECUTIVE PANEL</div>
          <h2 className="text-editorial title-medium" style={{ fontWeight: 400 }}>Futuristic Analytics Dashboard</h2>
        </div>

        {/* Dashboard Visual Interface Container */}
        <div 
          className="glass-card dashboard-container"
          style={{
            width: '100%',
            maxWidth: '1100px',
            margin: '0 auto',
            padding: '24px',
            display: 'grid',
            gridTemplateColumns: '240px 1fr',
            gap: '24px',
            boxShadow: '0 40px 80px -25px rgba(216,191,227,0.20)',
            border: '1px solid rgba(255, 255, 255, 0.65)'
          }}
        >
          {/* Dashboard Left Sidebar */}
          <div 
            style={{
              borderRight: '1px solid rgba(216,191,227,0.15)',
              paddingRight: '24px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '100%',
              minHeight: '420px'
            }}
            className="dashboard-sidebar"
          >
            <div>
              {/* Creator Card */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '40px' }}>
                <div 
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color-lilac-glow), var(--color-rose))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 600,
                    fontSize: '0.8rem'
                  }}
                >
                  SV
                </div>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-espresso)' }}>Sophia Vance</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--color-mocha)', fontWeight: 500 }}>PRO CREATOR</div>
                </div>
              </div>

              {/* Navigation Items */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { name: 'Analytics Hub', active: true },
                  { name: 'Artifact Catalog', active: false },
                  { name: 'Transactions', active: false },
                  { name: 'AI Price Engine', active: false, badge: 'PRO' },
                  { name: 'Payout settings', active: false }
                ].map((item, i) => (
                  <button
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '10px 16px',
                      borderRadius: '12px',
                      border: 'none',
                      background: item.active ? 'rgba(45,0,77,0.35)' : 'transparent',
                      color: item.active ? 'var(--color-espresso)' : 'var(--color-mocha)',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      textAlign: 'left',
                      transition: 'all 0.3s',
                      outline: 'none'
                    }}
                    className="clickable"
                  >
                    {item.name}
                    {item.badge && (
                      <span style={{ fontSize: '0.6rem', padding: '2px 6px', borderRadius: '10px', background: 'var(--color-lavender)', color: 'var(--color-espresso)', fontWeight: 800 }}>
                        {item.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Sidebar Footer */}
            <div 
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '0.7rem',
                color: 'var(--color-mocha)',
                fontWeight: 600,
                borderTop: '1px solid rgba(45,0,77,0.35)',
                paddingTop: '16px'
              }}
            >
              <ShieldCheck size={14} style={{ color: 'var(--color-mint)' }} />
              Verifiably Secured
            </div>
          </div>

          {/* Dashboard Main Content Area */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Top Bar: Controls and Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={14} style={{ color: 'var(--color-mocha)' }} />
                <span style={{ fontSize: '0.8rem', color: 'var(--color-mocha)', fontWeight: 600 }}>Period Selector:</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--color-espresso)', fontWeight: 700 }}>2026 Analytics</span>
              </div>

              {/* Tabs Toggle */}
              <div 
                className="glass-surface"
                style={{
                  display: 'flex',
                  padding: '4px',
                  borderRadius: '30px',
                  border: '1px solid rgba(45,0,77,0.35)'
                }}
              >
                <button
                  onClick={() => setActiveTab('weekly')}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    background: activeTab === 'weekly' ? 'var(--color-espresso)' : 'transparent',
                    color: activeTab === 'weekly' ? 'var(--color-warm-white)' : 'var(--color-mocha)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    transition: 'all 0.3s',
                    outline: 'none'
                  }}
                  className="clickable"
                >
                  Weekly View
                </button>
                <button
                  onClick={() => setActiveTab('monthly')}
                  style={{
                    padding: '6px 16px',
                    borderRadius: '20px',
                    border: 'none',
                    background: activeTab === 'monthly' ? 'var(--color-espresso)' : 'transparent',
                    color: activeTab === 'monthly' ? 'var(--color-warm-white)' : 'var(--color-mocha)',
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    transition: 'all 0.3s',
                    outline: 'none'
                  }}
                  className="clickable"
                >
                  Monthly View
                </button>
              </div>
            </div>

            {/* Metrics Overview Cards */}
            <div 
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '16px'
              }}
            >
              {[
                { title: 'CREATOR REVENUE', val: chartData[activeTab].revenue, icon: <IndianRupee size={16} />, detail: 'Gross earnings' },
                { title: 'CLIENT DOWNLOADS', val: chartData[activeTab].downloads, icon: <Download size={16} />, detail: 'Total transactions' },
                { title: 'PERFORMANCE RATE', val: chartData[activeTab].growth, icon: <TrendingUp size={16} />, detail: 'Period vs Last' }
              ].map((stat, i) => (
                <div
                  key={i}
                  className="glass-card"
                  style={{
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    height: '110px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--color-mocha)' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.05em' }}>{stat.title}</span>
                    {stat.icon}
                  </div>
                  <div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-espresso)' }}>{stat.val}</div>
                    <div style={{ fontSize: '0.65rem', color: 'var(--color-mocha)', opacity: 0.8 }}>{stat.detail}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Main Graph (Interactive SVG Area Chart) */}
            <div 
              className="glass-card"
              style={{
                padding: '24px',
                height: '260px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="text-sans" style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--color-espresso)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Sparkles size={14} style={{ color: 'var(--color-lilac-glow)' }} />
                  Earnings Flow Chart
                </span>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '10px', background: 'var(--color-mint-glow)', color: 'var(--color-espresso)', fontWeight: 700 }}>
                  Realtime updates
                </span>
              </div>

              {/* Chart Plot Area */}
              <div style={{ width: '100%', height: '160px', position: 'relative', marginTop: '16px' }}>
                <svg
                  viewBox="0 0 700 150"
                  width="100%"
                  height="100%"
                  preserveAspectRatio="none"
                  style={{ overflow: 'visible' }}
                >
                  <defs>
                    <linearGradient id="chartGlow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-lilac-glow)" stopOpacity="0.4" />
                      <stop offset="100%" stopColor="rgba(255,255,255,0)" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  
                  {/* Fill Area */}
                  <path
                    d={chartData[activeTab].linePath}
                    fill="url(#chartGlow)"
                    style={{ transition: 'd 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />

                  {/* Stroke Line */}
                  <path
                    d={chartData[activeTab].strokePath}
                    fill="none"
                    stroke="var(--color-mocha)"
                    strokeWidth="2.5"
                    style={{ transition: 'd 0.8s cubic-bezier(0.16, 1, 0.3, 1)' }}
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{`
        @media (max-width: 900px) {
          .dashboard-container {
            grid-template-columns: 1fr !important;
          }
          .dashboard-sidebar {
            border-right: none !important;
            border-bottom: 1px solid rgba(216,191,227,0.15) !important;
            padding-right: 0 !important;
            padding-bottom: 24px !important;
            min-height: auto !important;
          }
        }
      `}</style>
    </section>
  );
}
