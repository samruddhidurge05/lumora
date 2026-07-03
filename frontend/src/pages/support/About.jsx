import React, { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useSpring } from 'framer-motion';
import {
  Sparkles, Cpu, RefreshCw, CreditCard, ShoppingBag, ShieldCheck,
  Award, Zap, Users, Eye, Target, Globe, Activity, HardDrive,
  LineChart, BookOpen, ArrowUpRight, Clock, Star, CheckCircle, TrendingUp
} from 'lucide-react';



/* ─── ANIMATED COUNTER ──────────────────────────────────────────── */
function AnimatedCounter({ target, suffix = '', duration = 2200 }) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        const numeric = parseFloat(target.replace(/[^0-9.]/g, ''));
        const isFloat = target.includes('.');
        const start = Date.now();
        const tick = () => {
          const elapsed = Date.now() - start;
          const progress = Math.min(elapsed / duration, 1);
          const ease = 1 - Math.pow(1 - progress, 4);
          const val = numeric * ease;
          setCount(isFloat ? val.toFixed(1) : Math.floor(val));
          if (progress < 1) requestAnimationFrame(tick);
          else setCount(isFloat ? numeric.toFixed(1) : Math.floor(numeric));
        };
        tick();
      }
    }, { threshold: 0.4 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return <span ref={ref}>{count}{suffix}</span>;
}

/* ─── MAIN COMPONENT ────────────────────────────────────────────── */
const About = () => {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.15], [0, -60]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0.3]);

  /* ─── Data ─── */
  const differentials = [
    { icon: <Sparkles size={20} />, title: 'Curated Marketplace', desc: 'Every asset passes a strict editorial board. Quality is never compromised for volume.' },
    { icon: <Cpu size={20} />, title: 'Creator First', desc: 'Transparent splits, industry-leading payouts, and tools designed for digital artists to thrive.' },
    { icon: <RefreshCw size={20} />, title: 'Lifetime Access', desc: 'Your purchases live in a permanent secure vault — retrieve and update them anytime, forever.' },
    { icon: <CreditCard size={20} />, title: 'Secure Payments', desc: 'Stripe-powered, fully encrypted transactions with zero hidden fees or surprise charges.' },
    { icon: <ShoppingBag size={20} />, title: 'Premium Assets', desc: 'UI kits, Tailwind systems, Lightroom presets, and production-grade code boilerplates.' },
    { icon: <ShieldCheck size={20} />, title: 'Verified Quality', desc: 'Every file is audited for clean code, zero bugs, and a flawless developer experience.' },
  ];

  const stats = [
    { value: '10000', suffix: '+', label: 'Assets Curated', glow: 'rgba(220,198,255,0.6)' },
    { value: '500', suffix: '+', label: 'Verified Creators', glow: 'rgba(255,214,186,0.6)' },
    { value: '50000', suffix: '+', label: 'Total Downloads', glow: 'rgba(220,238,255,0.6)' },
    { value: '99.9', suffix: '%', label: 'Secure Transactions', glow: 'rgba(255,220,229,0.6)' },
  ];

  const coreValues = [
    { icon: <Award size={22} />, title: 'Quality', desc: 'Detail-first curation over volume. Every file delivers immense project value.', accent: '#DCC6FF' },
    { icon: <ShieldCheck size={22} />, title: 'Trust', desc: 'Absolute security and licensing clarity between sellers and builders.', accent: '#FFD6BA' },
    { icon: <Zap size={22} />, title: 'Innovation', desc: 'Constantly updated vaults representing cutting-edge design and code patterns.', accent: '#DCEEFF' },
    { icon: <Users size={22} />, title: 'Community', desc: 'A digital sanctuary where creators showcase and builders discover.', accent: '#CFE8D6' },
    { icon: <Eye size={22} />, title: 'Transparency', desc: 'Clear licensing, no hidden fees, and direct creator communication.', accent: '#FFDCE5' },
    { icon: <Target size={22} />, title: 'Excellence', desc: 'Stellar aesthetics and robust engineering across the entire marketplace.', accent: '#DDF5E5' },
  ];

  const pillars = [
    { icon: <Users size={20} />, title: 'Creators', desc: 'Digital designers, framework developers, and visual artists pushing boundaries.' },
    { icon: <Globe size={20} />, title: 'Buyers', desc: 'Startups, agencies, and freelancers looking to build faster and smarter.' },
    { icon: <Activity size={20} />, title: 'Tools', desc: 'Streamlined vault access, API keys, and update distribution infrastructure.' },
    { icon: <HardDrive size={20} />, title: 'Resources', desc: 'Figma systems, Lightroom cinematic presets, Next.js boilers, Tailwind layouts.' },
    { icon: <LineChart size={20} />, title: 'Growth', desc: 'Increasing creator revenues while saving builders hundreds of hours.' },
    { icon: <BookOpen size={20} />, title: 'Support', desc: 'Highly responsive help, documentation vaults, and interactive problem solving.' },
  ];

  const testimonials = [
    { quote: 'The Figma design system we sourced on Lumora saved our agency over 120 hours of configuration. The curation is absolutely elite.', author: 'Alexander V.', role: 'Creative Director, Studio Aura', stars: 5 },
    { quote: 'Selling on Lumora is a breeze. Transparent payouts, clean tooling, and buyers who genuinely appreciate premium craftsmanship.', author: 'Elena Rostova', role: 'Fullstack Architect & Creator', stars: 5 },
    { quote: 'Finally a marketplace that understands what premium means. Every download has been clean, documented, and production-ready.', author: 'Maddox Chen', role: 'Startup Founder, Orbit Labs', stars: 5 },
  ];

  /* ─── Animation variants ─── */
  const fadeUp = {
    hidden: { opacity: 0, y: 32 },
    show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.9, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] } }),
  };
  const stagger = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.09 } },
  };

  return (
    <div className="ab-root">
      {/* ════════════════ SECTION 1 · HERO ════════════════ */}
      <motion.section className="ab-hero" style={{ y: heroY, opacity: heroOpacity }}>
        <motion.div
          initial={{ opacity: 0, y: 45 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          className="ab-hero-inner"
        >
          <div className="ab-badge">
            <span className="ab-badge-dot" />
            THE LUMORA MANIFESTO
          </div>

          <h1 className="ab-hero-h1">
            Built for creators<br />
            <em>who think bigger.</em>
          </h1>

          <p className="ab-hero-sub">
            Lumora is a premium marketplace designed to help creators discover, sell,
            and grow through exceptional digital products.
          </p>

          <div className="ab-trust-row">
            {[
              { icon: <Sparkles size={14} />, label: 'Curated Assets Only' },
              { icon: <Cpu size={14} />, label: 'Creator-First Yields' },
              { icon: <Clock size={14} />, label: 'Lifetime Vault Access' },
              { icon: <ShieldCheck size={14} />, label: '99.9% Secure' },
            ].map((b, i) => (
              <motion.div
                key={i}
                className="ab-trust-badge"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + i * 0.1, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
              >
                {b.icon}
                <span>{b.label}</span>
              </motion.div>
            ))}
          </div>

          <motion.div
            className="ab-hero-scroll"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.6 }}
          >
            <div className="ab-scroll-line" />
            <span>Scroll to explore</span>
          </motion.div>
        </motion.div>
      </motion.section>

      {/* ════════════════ SECTION 2 · OUR STORY ════════════════ */}
      <section className="ab-section">
        <motion.div className="ab-section-head" variants={fadeUp} custom={0} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          <span className="ab-label">NARRATIVE LEDGER</span>
          <h2 className="ab-section-h2">Why Lumora Exists</h2>
        </motion.div>

        <motion.div className="ab-story-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          {[
            { num: '01', title: 'The Creator Dilemma', body: 'Traditional marketplaces commoditize premium work. Creators deserve a venue that respects and elevates high-fidelity craftsmanship — not buries it.' },
            { num: '02', title: 'Quality Over Volume', body: "Lumora isn't a catalog of millions. It's an elite, concierge-monitored gallery. Every file is audited to represent the absolute peak of utility and design." },
            { num: '03', title: 'Cinematic Philosophy', body: 'Digital assets should evoke emotion, not just function. We combine premium aesthetics, glassmorphism, and micro-animations to build the future of the creator economy.' },
          ].map((card, i) => (
            <motion.div
              key={i}
              className="ab-story-card ab-glass"
              variants={fadeUp}
              custom={i}
              whileHover={{ y: -8, scale: 1.015 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <div className="ab-story-num">{card.num}</div>
              <h3 className="ab-story-title">{card.title}</h3>
              <p className="ab-story-body">{card.body}</p>
              <div className="ab-story-line" />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ════════════════ SECTION 3 · DIFFERENTIALS ════════════════ */}
      <section className="ab-section">
        <motion.div className="ab-section-head ab-center" variants={fadeUp} custom={0} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          <span className="ab-label">CORE DIFFERENTIALS</span>
          <h2 className="ab-section-h2">What Makes Us Different</h2>
        </motion.div>

        <motion.div className="ab-diff-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          {differentials.map((d, i) => (
            <motion.div
              key={i}
              className="ab-diff-card ab-glass"
              variants={fadeUp}
              custom={i}
              whileHover={{ y: -10, scale: 1.02, boxShadow: '0 28px 60px -20px rgba(56, 19, 71,0.14)' }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            >
              <div className="ab-diff-icon">{d.icon}</div>
              <h3 className="ab-diff-title">{d.title}</h3>
              <p className="ab-diff-desc">{d.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ════════════════ SECTION 4 · BY THE NUMBERS ════════════════ */}
      <section className="ab-section">
        <motion.div
          className="ab-stats-strip ab-glass"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
        >
          {stats.map((s, i) => (
            <div key={i} className="ab-stat-block">
              <div className="ab-stat-glow" style={{ background: s.glow }} />
              <div className="ab-stat-val">
                <AnimatedCounter target={s.value} suffix={s.suffix} />
              </div>
              <div className="ab-stat-label">{s.label}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ════════════════ SECTION 5 · VISION ════════════════ */}
      <section className="ab-section ab-vision-section">
        <motion.div
          className="ab-vision-card ab-glass"
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="ab-vision-glow-1" />
          <div className="ab-vision-glow-2" />
          <span className="ab-label" style={{ textAlign: 'center', display: 'block' }}>THE FUTURE METRIC</span>
          <h2 className="ab-vision-h2">The future<br /><em>of digital products.</em></h2>
          <p className="ab-vision-body">
            We envision a digital economy where creators are paid their true worth — and builders
            are empowered with assets that bypass the first 80% of repetitive work. Lumora is building
            the infrastructure to make this premium exchange seamless, secure, and beautiful.
          </p>
          <div className="ab-vision-pillars">
            {['Creator Empowerment', 'Premium Curation', 'Secure Commerce', 'Lifetime Value'].map((p, i) => (
              <div key={i} className="ab-vision-pill">
                <CheckCircle size={13} />
                {p}
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* ════════════════ SECTION 6 · CORE VALUES ════════════════ */}
      <section className="ab-section">
        <motion.div className="ab-section-head" variants={fadeUp} custom={0} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          <span className="ab-label">GUIDING LIGHTS</span>
          <h2 className="ab-section-h2">Our Core Values</h2>
        </motion.div>

        <motion.div className="ab-values-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          {coreValues.map((v, i) => (
            <motion.div
              key={i}
              className="ab-value-card ab-glass"
              variants={fadeUp}
              custom={i}
              whileHover={{ y: -8, scale: 1.015 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              style={{ '--accent': v.accent }}
            >
              <div className="ab-value-glow" />
              <div className="ab-value-icon">{v.icon}</div>
              <h3 className="ab-value-title">{v.title}</h3>
              <p className="ab-value-desc">{v.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ════════════════ SECTION 7 · PLATFORM PILLARS ════════════════ */}
      <section className="ab-section">
        <motion.div className="ab-section-head ab-center" variants={fadeUp} custom={0} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          <span className="ab-label">SYSTEM PILLARS</span>
          <h2 className="ab-section-h2">Meet the Platform</h2>
        </motion.div>

        <motion.div className="ab-pillars-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          {pillars.map((p, i) => (
            <motion.div
              key={i}
              className="ab-pillar-card ab-glass"
              variants={fadeUp}
              custom={i}
              whileHover={{ y: -6, backgroundColor: 'rgba(255,253,249,0.80)' }}
              transition={{ type: 'spring', stiffness: 320, damping: 24 }}
            >
              <div className="ab-pillar-icon">{p.icon}</div>
              <div>
                <h3 className="ab-pillar-title">{p.title}</h3>
                <p className="ab-pillar-desc">{p.desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ════════════════ SECTION 8 · TESTIMONIALS ════════════════ */}
      <section className="ab-section">
        <motion.div className="ab-section-head ab-center" variants={fadeUp} custom={0} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          <span className="ab-label">CLIENT VOICE</span>
          <h2 className="ab-section-h2">Why People Choose Lumora</h2>
        </motion.div>

        <motion.div className="ab-testimonials-grid" variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: '-80px' }}>
          {testimonials.map((t, i) => (
            <motion.div
              key={i}
              className="ab-tcard ab-glass"
              variants={fadeUp}
              custom={i}
              whileHover={{ y: -8, scale: 1.015 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
            >
              <div className="ab-tcard-stars">
                {Array.from({ length: t.stars }).map((_, s) => (
                  <Star key={s} size={13} fill="#A174B8" color="#A174B8" />
                ))}
              </div>
              <div className="ab-quote-mark">"</div>
              <p className="ab-tcard-quote">{t.quote}</p>
              <div className="ab-tcard-author">
                <div className="ab-author-avatar">{t.author.charAt(0)}</div>
                <div>
                  <div className="ab-author-name">{t.author}</div>
                  <div className="ab-author-role">{t.role}</div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ════════════════ SECTION 9 · FINAL CTA ════════════════ */}
      <section className="ab-section ab-cta-section">
        <motion.div
          className="ab-cta-card ab-glass"
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <div className="ab-cta-glow-1" />
          <div className="ab-cta-glow-2" />
          <span className="ab-label" style={{ textAlign: 'center', display: 'block' }}>JOIN LUMORA</span>
          <h2 className="ab-cta-h2">Ready to build something<br /><em>extraordinary?</em></h2>
          <p className="ab-cta-sub">Join thousands of creators and builders already working on the premium edge of digital commerce.</p>
          <div className="ab-cta-btns">
            <motion.a
              href="#"
              className="ab-btn-primary"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            >
              <TrendingUp size={16} />
              Explore Marketplace
            </motion.a>
            <motion.button
              type="button"
              className="ab-btn-secondary"
              whileHover={{ scale: 1.04, y: -2 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 20 }}
              onClick={() => alert('Apply via Dashboard › Creator Sandbox')}
            >
              Become a Creator
              <ArrowUpRight size={16} />
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* ═══════════════════ STYLES ═══════════════════ */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;0,700;1,400;1,500&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        /* ── Root ── */
        .ab-root {
          min-height: 100vh;
          background: linear-gradient(135deg, #FFFDF9 0%, #FAF7F2 30%, #FFF5EB 60%, #F5E9DD 100%);
          color: #381347;
          font-family: 'Outfit', 'Inter', system-ui, sans-serif;
          position: relative;
          overflow-x: hidden;
        }

        /* ── Three.js Canvas ── */
        .ab-canvas {
          position: fixed;
          inset: 0;
          width: 100%;
          height: 100%;
          z-index: 0;
          pointer-events: none;
        }

        /* ── Ambient CSS blobs over canvas ── */
        .ab-blob {
          position: fixed;
          border-radius: 50%;
          filter: blur(90px);
          pointer-events: none;
          z-index: 1;
          animation: abBlobFloat 28s infinite ease-in-out alternate;
        }
        .ab-blob-1 {
          width: 600px; height: 600px;
          top: -120px; left: -120px;
          background: radial-gradient(circle, rgba(220,198,255,0.28) 0%, transparent 70%);
          animation-duration: 30s;
        }
        .ab-blob-2 {
          width: 700px; height: 700px;
          bottom: -180px; right: -100px;
          background: radial-gradient(circle, rgba(255,214,186,0.25) 0%, transparent 70%);
          animation-duration: 36s; animation-delay: -8s;
        }
        .ab-blob-3 {
          width: 500px; height: 500px;
          top: 45%; left: 55%;
          background: radial-gradient(circle, rgba(220,238,255,0.22) 0%, transparent 70%);
          animation-duration: 24s; animation-delay: -14s;
        }
        @keyframes abBlobFloat {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(60px, 50px) scale(1.1); }
          100% { transform: translate(-40px, 80px) scale(0.9); }
        }

        /* ── Glass panel ── */
        .ab-glass {
          background: rgba(255, 253, 249, 0.52);
          backdrop-filter: blur(28px) saturate(150%) brightness(1.04);
          -webkit-backdrop-filter: blur(28px) saturate(150%) brightness(1.04);
          border: 1px solid rgba(255, 255, 255, 0.55);
          border-radius: 28px;
          box-shadow: 0 8px 32px rgba(56, 19, 71,0.07), inset 0 1px 0 rgba(255,255,255,0.8);
          transition: background 0.5s ease, border-color 0.4s ease, box-shadow 0.5s ease;
        }
        .ab-glass:hover {
          background: rgba(255, 253, 249, 0.70);
          border-color: rgba(161, 116, 184, 0.14);
        }

        /* ── Layout ── */
        .ab-section {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 2rem 6rem;
        }

        .ab-section-head { margin-bottom: 3.5rem; }
        .ab-center { text-align: center; }

        .ab-label {
          display: block;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.16em;
          color: #A174B8;
          margin-bottom: 0.85rem;
          text-transform: uppercase;
        }

        .ab-section-h2 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(2rem, 4vw, 2.6rem);
          font-weight: 500;
          color: #381347;
          line-height: 1.2;
        }

        /* ════ SECTION 1: HERO ════ */
        .ab-hero {
          position: relative;
          z-index: 2;
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: 8rem 2rem 4rem;
        }
        .ab-hero-inner { max-width: 820px; }

        .ab-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.55rem;
          background: rgba(56, 19, 71, 0.05);
          border: 1px solid rgba(56, 19, 71, 0.09);
          padding: 0.45rem 1.1rem;
          border-radius: 50px;
          font-size: 0.7rem;
          font-weight: 700;
          letter-spacing: 0.14em;
          color: #743B94;
          margin-bottom: 2.2rem;
        }
        .ab-badge-dot {
          width: 7px; height: 7px;
          background: #A174B8;
          border-radius: 50%;
          animation: abDotPulse 2s infinite ease-in-out;
        }
        @keyframes abDotPulse {
          0%, 100% { transform: scale(0.8); opacity: 0.6; }
          50%       { transform: scale(1.3); opacity: 1; }
        }

        .ab-hero-h1 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(3rem, 7vw, 5.2rem);
          font-weight: 500;
          color: #381347;
          line-height: 1.12;
          letter-spacing: -0.025em;
          margin-bottom: 1.75rem;
        }
        .ab-hero-h1 em {
          font-style: italic;
          background: linear-gradient(135deg, #A174B8, #743B94);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .ab-hero-sub {
          font-size: clamp(1rem, 2vw, 1.22rem);
          line-height: 1.65;
          color: #743B94;
          max-width: 600px;
          margin: 0 auto 3rem;
        }

        .ab-trust-row {
          display: flex;
          flex-wrap: wrap;
          gap: 1rem;
          justify-content: center;
          margin-bottom: 4rem;
        }
        .ab-trust-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.85rem;
          font-weight: 600;
          color: #381347;
          background: rgba(255,253,249,0.72);
          border: 1px solid rgba(56, 19, 71,0.08);
          padding: 0.55rem 1.15rem;
          border-radius: 14px;
          backdrop-filter: blur(12px);
          box-shadow: 0 4px 18px -6px rgba(56, 19, 71,0.06);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .ab-trust-badge:hover {
          transform: translateY(-3px);
          box-shadow: 0 10px 28px -8px rgba(56, 19, 71,0.1);
        }

        .ab-hero-scroll {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.75rem;
          letter-spacing: 0.06em;
          color: #A174B8;
          opacity: 0.7;
        }
        .ab-scroll-line {
          width: 1px;
          height: 44px;
          background: linear-gradient(to bottom, transparent, #A174B8, transparent);
          animation: abScrollLine 2.2s infinite ease-in-out;
        }
        @keyframes abScrollLine {
          0%, 100% { opacity: 0.3; transform: scaleY(0.6); }
          50%       { opacity: 1;   transform: scaleY(1);   }
        }

        /* ════ SECTION 2: STORY ════ */
        .ab-story-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        .ab-story-card {
          padding: 3rem 2.5rem;
          cursor: default;
          position: relative;
          overflow: hidden;
        }
        .ab-story-num {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 2.8rem;
          font-weight: 700;
          color: rgba(161, 116, 184,0.18);
          line-height: 1;
          margin-bottom: 1.5rem;
        }
        .ab-story-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.4rem;
          font-weight: 500;
          color: #381347;
          margin-bottom: 1rem;
        }
        .ab-story-body {
          font-size: 0.93rem;
          line-height: 1.68;
          color: #743B94;
        }
        .ab-story-line {
          position: absolute;
          bottom: 0; left: 2.5rem;
          width: 40px; height: 2px;
          background: linear-gradient(90deg, #A174B8, transparent);
          border-radius: 2px;
          margin-bottom: 2rem;
        }

        /* ════ SECTION 3: DIFFERENTIALS ════ */
        .ab-diff-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        .ab-diff-card {
          padding: 2.75rem 2.25rem;
          cursor: default;
        }
        .ab-diff-icon {
          color: #A174B8;
          margin-bottom: 1.5rem;
          width: 44px; height: 44px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(161, 116, 184,0.08);
          border-radius: 12px;
          transition: background 0.3s ease;
        }
        .ab-diff-card:hover .ab-diff-icon {
          background: rgba(161, 116, 184,0.15);
        }
        .ab-diff-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.3rem;
          font-weight: 500;
          color: #381347;
          margin-bottom: 0.75rem;
        }
        .ab-diff-desc {
          font-size: 0.91rem;
          line-height: 1.65;
          color: #743B94;
        }

        /* ════ SECTION 4: STATS ════ */
        .ab-stats-strip {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          padding: 3.5rem 2rem;
          gap: 1.5rem;
          text-align: center;
        }
        .ab-stat-block { position: relative; }
        .ab-stat-glow {
          position: absolute;
          width: 90px; height: 90px;
          border-radius: 50%;
          filter: blur(28px);
          opacity: 0.22;
          top: -20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 0;
        }
        .ab-stat-val {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(2.2rem, 4vw, 3.2rem);
          font-weight: 700;
          color: #381347;
          line-height: 1;
          margin-bottom: 0.5rem;
          position: relative; z-index: 1;
        }
        .ab-stat-label {
          font-size: 0.82rem;
          font-weight: 700;
          color: #A174B8;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          position: relative; z-index: 1;
        }

        /* ════ SECTION 5: VISION ════ */
        .ab-vision-section { padding-bottom: 6rem; }
        .ab-vision-card {
          padding: clamp(3rem, 6vw, 6rem);
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .ab-vision-glow-1, .ab-vision-glow-2 {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          pointer-events: none;
        }
        .ab-vision-glow-1 {
          width: 380px; height: 380px;
          top: -100px; left: -80px;
          background: rgba(220,198,255,0.22);
        }
        .ab-vision-glow-2 {
          width: 320px; height: 320px;
          bottom: -80px; right: -60px;
          background: rgba(255,214,186,0.20);
        }
        .ab-vision-h2 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(2.4rem, 5.5vw, 4.2rem);
          font-weight: 500;
          color: #381347;
          line-height: 1.15;
          margin: 1.25rem 0 2rem;
          position: relative; z-index: 1;
        }
        .ab-vision-h2 em {
          font-style: italic;
          background: linear-gradient(135deg, #A174B8, #743B94);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ab-vision-body {
          font-size: clamp(1rem, 2vw, 1.2rem);
          line-height: 1.72;
          color: #743B94;
          max-width: 680px;
          margin: 0 auto 2.5rem;
          position: relative; z-index: 1;
        }
        .ab-vision-pillars {
          display: flex;
          flex-wrap: wrap;
          gap: 0.8rem;
          justify-content: center;
          position: relative; z-index: 1;
        }
        .ab-vision-pill {
          display: inline-flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.84rem;
          font-weight: 600;
          color: #381347;
          background: rgba(56, 19, 71,0.05);
          border: 1px solid rgba(56, 19, 71,0.07);
          padding: 0.45rem 1rem;
          border-radius: 50px;
        }

        /* ════ SECTION 6: VALUES ════ */
        .ab-values-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        .ab-value-card {
          padding: 2.75rem 2.25rem;
          position: relative;
          overflow: hidden;
          cursor: default;
        }
        .ab-value-glow {
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at 0% 0%, var(--accent, rgba(220,198,255,0.4)) 0%, transparent 60%);
          opacity: 0;
          transition: opacity 0.5s ease;
          pointer-events: none;
        }
        .ab-value-card:hover .ab-value-glow { opacity: 0.35; }
        .ab-value-icon {
          color: #A174B8;
          margin-bottom: 1.5rem;
          width: 46px; height: 46px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(161, 116, 184,0.08);
          border-radius: 13px;
          position: relative; z-index: 1;
          transition: background 0.3s ease;
        }
        .ab-value-card:hover .ab-value-icon { background: rgba(161, 116, 184,0.16); }
        .ab-value-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.3rem;
          font-weight: 500;
          color: #381347;
          margin-bottom: 0.7rem;
          position: relative; z-index: 1;
        }
        .ab-value-desc {
          font-size: 0.91rem;
          line-height: 1.65;
          color: #743B94;
          position: relative; z-index: 1;
        }

        /* ════ SECTION 7: PILLARS ════ */
        .ab-pillars-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1.5rem;
        }
        .ab-pillar-card {
          display: flex;
          align-items: flex-start;
          gap: 1.5rem;
          padding: 2rem 2.25rem;
          cursor: default;
        }
        .ab-pillar-icon {
          flex-shrink: 0;
          color: #A174B8;
          width: 44px; height: 44px;
          display: flex; align-items: center; justify-content: center;
          background: rgba(161, 116, 184,0.08);
          border-radius: 12px;
          transition: background 0.3s ease;
        }
        .ab-pillar-card:hover .ab-pillar-icon { background: rgba(161, 116, 184,0.16); }
        .ab-pillar-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1.2rem;
          font-weight: 500;
          color: #381347;
          margin-bottom: 0.45rem;
        }
        .ab-pillar-desc {
          font-size: 0.89rem;
          line-height: 1.6;
          color: #743B94;
        }

        /* ════ SECTION 8: TESTIMONIALS ════ */
        .ab-testimonials-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 2rem;
        }
        .ab-tcard {
          padding: 2.5rem 2.25rem;
          cursor: default;
        }
        .ab-tcard-stars {
          display: flex;
          gap: 3px;
          margin-bottom: 1.2rem;
        }
        .ab-quote-mark {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 3.5rem;
          line-height: 0.8;
          color: rgba(161, 116, 184,0.25);
          margin-bottom: 0.75rem;
        }
        .ab-tcard-quote {
          font-size: 0.92rem;
          line-height: 1.7;
          color: #743B94;
          margin-bottom: 2rem;
          flex: 1;
        }
        .ab-tcard-author {
          display: flex;
          align-items: center;
          gap: 0.9rem;
        }
        .ab-author-avatar {
          width: 40px; height: 40px;
          border-radius: 50%;
          background: linear-gradient(135deg, #DCC6FF, #FFD6BA);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 1rem;
          font-weight: 700;
          color: #381347;
          flex-shrink: 0;
        }
        .ab-author-name {
          font-size: 0.9rem;
          font-weight: 700;
          color: #381347;
        }
        .ab-author-role {
          font-size: 0.78rem;
          color: #A174B8;
          margin-top: 0.1rem;
        }

        /* ════ SECTION 9: CTA ════ */
        .ab-cta-section { padding-bottom: 8rem; }
        .ab-cta-card {
          padding: clamp(3.5rem, 7vw, 6rem);
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .ab-cta-glow-1, .ab-cta-glow-2 {
          position: absolute;
          border-radius: 50%;
          filter: blur(70px);
          pointer-events: none;
        }
        .ab-cta-glow-1 {
          width: 340px; height: 340px;
          top: -80px; left: -60px;
          background: rgba(220,198,255,0.25);
        }
        .ab-cta-glow-2 {
          width: 300px; height: 300px;
          bottom: -80px; right: -60px;
          background: rgba(255,214,186,0.22);
        }
        .ab-cta-h2 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: clamp(2.2rem, 5vw, 3.8rem);
          font-weight: 500;
          color: #381347;
          line-height: 1.2;
          margin: 1.25rem 0 1.25rem;
          position: relative; z-index: 1;
        }
        .ab-cta-h2 em {
          font-style: italic;
          background: linear-gradient(135deg, #A174B8, #743B94);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .ab-cta-sub {
          font-size: 1.05rem;
          color: #743B94;
          max-width: 520px;
          margin: 0 auto 3rem;
          line-height: 1.65;
          position: relative; z-index: 1;
        }
        .ab-cta-btns {
          display: flex;
          gap: 1.2rem;
          justify-content: center;
          flex-wrap: wrap;
          position: relative; z-index: 1;
        }
        .ab-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          background: #381347;
          color: #FFFDF9;
          padding: 1rem 2.2rem;
          border-radius: 16px;
          font-size: 0.95rem;
          font-weight: 600;
          text-decoration: none;
          letter-spacing: 0.01em;
          transition: background 0.3s ease, box-shadow 0.3s ease;
          box-shadow: 0 8px 28px -8px rgba(56, 19, 71,0.3);
        }
        .ab-btn-primary:hover {
          background: #3a2b22;
          box-shadow: 0 14px 40px -10px rgba(56, 19, 71,0.4);
        }
        .ab-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          background: transparent;
          color: #381347;
          padding: 1rem 2.2rem;
          border-radius: 16px;
          font-size: 0.95rem;
          font-weight: 600;
          border: 1.5px solid rgba(56, 19, 71,0.18);
          cursor: pointer;
          letter-spacing: 0.01em;
          transition: background 0.3s ease, border-color 0.3s ease;
        }
        .ab-btn-secondary:hover {
          background: rgba(56, 19, 71,0.05);
          border-color: rgba(56, 19, 71,0.3);
        }

        /* ── Footer ── */
        .ab-footer {
          position: relative; z-index: 2;
          text-align: center;
          padding: 3rem 2rem;
          border-top: 1px solid rgba(56, 19, 71,0.06);
        }
        .ab-footer-links {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-bottom: 0.85rem;
          flex-wrap: wrap;
        }
        .ab-footer-link {
          font-size: 0.85rem;
          font-weight: 600;
          color: #743B94;
          text-decoration: none;
          transition: color 0.2s;
        }
        .ab-footer-link:hover { color: #381347; }
        .ab-footer-dot { color: rgba(56, 19, 71,0.2); font-size: 0.9rem; }
        .ab-footer-copy {
          font-size: 0.8rem;
          color: rgba(56, 19, 71,0.4);
        }

        /* ═══ RESPONSIVE ═══ */
        @media (max-width: 900px) {
          .ab-story-grid,
          .ab-diff-grid,
          .ab-values-grid { grid-template-columns: 1fr; }
          .ab-testimonials-grid { grid-template-columns: 1fr; }
          .ab-stats-strip { grid-template-columns: repeat(2, 1fr); }
          .ab-pillars-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
          .ab-stats-strip { grid-template-columns: 1fr 1fr; }
          .ab-hero-h1 { font-size: 2.6rem; }
          .ab-trust-row { gap: 0.7rem; }
        }
      `}</style>
    </div>
  );
};

export default About;
