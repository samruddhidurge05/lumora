import React, { useState, useEffect, useRef } from 'react';
import { motion, useScroll, useTransform, AnimatePresence } from 'framer-motion';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import {
  ArrowRight, Star, Zap, Shield, Download, TrendingUp, Users,
  Sparkles, Check, Layout, BookOpen, Brain, Palette, Smartphone,
  BarChart3, ShoppingBag, Code2, Layers, FileImage, ChevronDown,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useAuth } from '../../context/AuthContext';
import ProductImage from '../../components/product/ProductImage';
import Navbar from '../../components/common/Navbar';
import Footer from '../../components/common/Footer';

gsap.registerPlugin(ScrollTrigger);

/* ── Animated counter ─────────────────────────── */
function Counter({ end, suffix = '' }) {
  const [val, setVal] = useState(0);
  const ref = useRef(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !started.current) {
        started.current = true;
        const n = parseFloat(String(end).replace(/[^0-9.]/g,''));
        const isF = String(end).includes('.');
        const t0 = Date.now();
        const tick = () => {
          const p = Math.min((Date.now()-t0)/2000,1);
          const ease = 1-Math.pow(1-p,4);
          setVal(isF?(n*ease).toFixed(1):Math.floor(n*ease));
          if(p<1) requestAnimationFrame(tick);
          else setVal(isF?parseFloat(n).toFixed(1):Math.floor(n));
        };
        tick();
      }
    },{ threshold:.4 });
    obs.observe(el);
    return () => obs.disconnect();
  },[end]);
  return <span ref={ref}>{val}{suffix}</span>;
}

/* ── Section reveal wrapper ───────────────────── */
function Reveal({ children, delay = 0, style = {} }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.75, delay, ease: [0.16, 1, 0.3, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

/* ── Product showcase card ────────────────────── */
function PCard({ product, delay = 0 }) {
  const { addToCart, buyNow, navigateTo, formatPrice } = useApp();
  const { user } = useAuth();
  const [hov, setHov] = useState(false);

  const handleBuy = (e) => {
    e.stopPropagation();
    if (!user) { navigateTo('login-selection'); return; }
    buyNow(product);
  };

  const handleCart = (e) => {
    e.stopPropagation();
    if (!user) { navigateTo('login-selection'); return; }
    addToCart(product);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 36 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-50px' }}
      transition={{ duration: .65, delay, ease: [.16,1,.3,1] }}
      onHoverStart={() => setHov(true)}
      onHoverEnd={() => setHov(false)}
      onClick={() => navigateTo('product-detail', product.id)}
      style={{
        background: 'rgba(255,255,255,0.35)',
        backdropFilter: 'blur(36px) saturate(200%)',
        WebkitBackdropFilter: 'blur(36px) saturate(200%)',
        border: `1px solid ${hov ? 'rgba(123,63,160,.32)' : 'rgba(255,255,255,.40)'}`,
        borderTop: '1.5px solid rgba(255,255,255,.55)',
        borderRadius: '22px', overflow: 'hidden',
        boxShadow: hov
          ? '0 28px 64px rgba(90,30,126,.20), inset 0 1px 0 rgba(255,255,255,.75)'
          : '0 8px 32px rgba(90,30,126,.10), inset 0 1px 0 rgba(255,255,255,.60)',
        transform: hov ? 'translateY(-7px) scale(1.015)' : 'translateY(0) scale(1)',
        transition: 'all .32s cubic-bezier(.16,1,.3,1)',
        cursor: 'pointer', display: 'flex', flexDirection: 'column',
      }}
    >
      <div style={{ height:'190px', overflow:'hidden', position:'relative' }}>
        <ProductImage
          product={product}
          style={{ transform:hov?'scale(1.07)':'scale(1)', transition:'transform .5s ease' }}
        />
        <div style={{ position:'absolute', inset:0, background: hov?'rgba(123,63,160,.06)':'transparent', transition:'background .3s', pointerEvents: 'none' }} />
        {product.badge && (
          <span style={{ position:'absolute', top:'10px', left:'10px', fontSize:'.58rem', background:'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color:'#fff', fontWeight:800, padding:'3px 9px', borderRadius:'20px' }}>
            {product.badge}
          </span>
        )}
        {/* Glass sheen */}
        <div style={{ position:'absolute', top:0, left:'10%', right:'10%', height:'1px', background:'linear-gradient(90deg,transparent,rgba(255,255,255,.7),transparent)', pointerEvents:'none' }} />
      </div>
      <div style={{ padding:'17px', flex:1, display:'flex', flexDirection:'column', gap:'8px' }}>
        <span style={{ fontSize:'.58rem', fontWeight:700, color:'#7B3FA0', textTransform:'uppercase', letterSpacing:'.07em', background:'rgba(123,63,160,.08)', padding:'2px 8px', borderRadius:'5px', alignSelf:'flex-start' }}>
          {product.category}
        </span>
        <h3 style={{ fontSize:'.9rem', fontWeight:700, color:'#2D004D', lineHeight:1.35, overflow:'hidden', textOverflow:'ellipsis', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>
          {product.title}
        </h3>
        <div style={{ display:'flex', alignItems:'center', gap:'3px' }}>
          {[...Array(5)].map((_,i)=><Star key={i} size={10} fill={i<Math.round(product.rating||4.8)?'#C7A55A':'none'} stroke="#C7A55A" />)}
          <span style={{ fontSize:'.68rem', color:'#8B6B5B', fontWeight:600, marginLeft:'2px' }}>{product.rating||'4.8'}</span>
        </div>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'auto', paddingTop:'10px', borderTop:'1px solid rgba(220,198,255,.18)' }}>
          <span style={{ fontSize:'1.05rem', fontWeight:800, color:'#2D004D' }}>{formatPrice(product.price)}</span>
          <div style={{ display:'flex', gap:'6px' }}>
            {user ? (
              <>
                <button onClick={handleCart}
                  style={{ width:'30px', height:'30px', borderRadius:'8px', border:'1.5px solid rgba(123,63,160,.25)', background:'rgba(255,255,255,.85)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#5A1E7E', backdropFilter:'blur(8px)' }}>
                  <ShoppingBag size={12} />
                </button>
                <button onClick={handleBuy}
                  style={{ padding:'6px 12px', borderRadius:'8px', border:'none', background:'linear-gradient(135deg,#7B3FA0,#5A1E7E)', color:'#fff', fontSize:'.68rem', fontWeight:700, cursor:'pointer', boxShadow:'0 3px 10px rgba(90,30,126,.28)' }}>
                  Buy
                </button>
              </>
            ) : (
              <button onClick={e=>{e.stopPropagation();navigateTo('login-selection');}}
                style={{ padding:'6px 14px', borderRadius:'8px', border:'1.5px solid rgba(123,63,160,.30)', background:'rgba(255,255,255,.85)', color:'#7B3FA0', fontSize:'.68rem', fontWeight:700, cursor:'pointer', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', gap:'4px' }}>
                Sign in to Buy
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Category data ─────────────────────────────── */
const CATS = [
  { name:'UI Kits',            icon:<Palette size={20}/>,    color:'rgba(220,198,255,0.45)' },
  { name:'React Templates',   icon:<Code2 size={20}/>,       color:'rgba(220,238,255,0.45)' },
  { name:'Design Assets',     icon:<Layers size={20}/>,      color:'rgba(255,214,186,0.45)' },
  { name:'E-books',           icon:<BookOpen size={20}/>,    color:'rgba(207,232,214,0.45)' },
  { name:'AI Tools',          icon:<Brain size={20}/>,       color:'rgba(255,220,229,0.45)' },
  { name:'Notion Templates',  icon:<Layout size={20}/>,      color:'rgba(221,245,229,0.45)' },
  { name:'Mobile App Designs',icon:<Smartphone size={20}/>,  color:'rgba(220,238,255,0.45)' },
  { name:'Social Media Kits', icon:<FileImage size={20}/>,   color:'rgba(255,214,186,0.45)' },
];

const TESTIMONIALS = [
  { name:'Priya Sharma', role:'UI Designer, Bengaluru', text:'The React templates saved me weeks of work. Every component is production-ready and beautifully crafted.', avatar:'P' },
  { name:'Alex Morgan',  role:'Freelance Developer',   text:"I've purchased from 6 marketplaces. Lumora is in a different league. Quality and support are unmatched.", avatar:'A' },
  { name:'Riya Kapoor',  role:'Startup Founder',       text:'Our landing page went from idea to live in 2 days using Lumora templates. Absolutely premium quality.', avatar:'R' },
  { name:'James Liu',    role:'Creative Director',     text:'The design assets are used in our Fortune 500 projects. Worth every rupee.', avatar:'J' },
];

/* ══════════════════════════════════════════════
   MAIN LANDING PAGE COMPONENT
══════════════════════════════════════════════ */
export default function Home() {
  const { navigateTo, products, setActiveCategory } = useApp();
  const { user } = useAuth();
  const [activeTestimonial, setActiveTestimonial] = useState(0);
  const { scrollYProgress } = useScroll();
  const heroY       = useTransform(scrollYProgress, [0, 0.25], [0, -50]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.20], [1, 0.25]);

  // ── Deduplicate by ID (backend + JSON can both emit same product) ──
  const seenIds = new Set();
  const uniqueProducts = products.filter(p => {
    const key = String(p.id);
    if (seenIds.has(key)) return false;
    seenIds.add(key);
    return true;
  });

  // ── Pin the real pCloud products ALWAYS first ────────────────────────────
  // These are the products you assigned pCloud folders to. They must always
  // appear at the top of the Featured section and never be displaced.
  const PINNED_IDS = new Set([108, 109, 111, 112, 115, 116, 117, 118, 119, 120, 121, 122]);
  const pinned = uniqueProducts.filter(p => PINNED_IDS.has(Number(p.id)));
  const rest   = uniqueProducts.filter(p => !PINNED_IDS.has(Number(p.id)));
  const ordered = [...pinned, ...rest]; // pinned always first

  // ── Partition into non-overlapping sections of 8 ──
  // Featured always shows the pinned pCloud products (up to first 8).
  // Trending shows pinned products 9–12 + first others.
  // Latest shows the rest.
  const SECTION_SIZE = 8;
  const featured = ordered.slice(0, SECTION_SIZE);
  const trending  = ordered.slice(SECTION_SIZE, SECTION_SIZE * 2);
  const latest    = ordered.slice(SECTION_SIZE * 2, SECTION_SIZE * 3);

  useEffect(() => {
    const t = setInterval(() => setActiveTestimonial(p => (p+1) % TESTIMONIALS.length), 4500);
    return () => clearInterval(t);
  }, []);

  /* GSAP scroll reveals */
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.utils.toArray('.gsap-reveal').forEach((el, i) => {
        gsap.fromTo(el,
          { opacity:0, y:50 },
          { opacity:1, y:0, duration:.85, delay:(i%4)*.07, ease:'power4.out',
            scrollTrigger:{ trigger:el, start:'top 88%', once:true } }
        );
      });
    });
    return () => ctx.revert();
  }, []);

  /* ── Glass card style shorthand ── */
  const glass = (extra={}) => ({
    background:'rgba(255,255,255,0.30)',
    backdropFilter:'blur(36px) saturate(200%) brightness(1.05)',
    WebkitBackdropFilter:'blur(36px) saturate(200%) brightness(1.05)',
    border:'1px solid rgba(255,255,255,0.40)',
    borderTop:'1.5px solid rgba(255,255,255,0.55)',
    borderRadius:'22px',
    boxShadow:'0 8px 32px rgba(90,30,126,0.10), inset 0 1px 0 rgba(255,255,255,0.60)',
    ...extra,
  });

  return (
    <div style={{ minHeight:'100vh', position:'relative', zIndex:10 }}>
      <Navbar />

      {/* ═══════════ 1. HERO ═══════════ */}
      <motion.div style={{ y:heroY, opacity:heroOpacity }}>
        <section className="lumora-hero-section" style={{ minHeight:'100vh', position:'relative', display:'flex', alignItems:'center', padding:'clamp(6rem,12vw,10rem) clamp(1.5rem,6vw,7rem) 5rem', overflow:'hidden' }}>

          <div style={{ maxWidth:'1280px', margin:'0 auto', width:'100%', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'64px', alignItems:'center', position:'relative', zIndex:2 }} className="hero-grid">            {/* LEFT */}
            <div>
              <motion.div initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{duration:.7,delay:.1}}
                style={{ display:'inline-flex', alignItems:'center', gap:'8px', padding:'6px 16px', borderRadius:'100px', background:'rgba(220,198,255,0.30)', border:'1px solid rgba(220,198,255,0.55)', marginBottom:'28px' }}>
                <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#7B3FA0', boxShadow:'0 0 8px rgba(123,63,160,.6)' }} />
                <span style={{ fontSize:'.75rem', fontWeight:700, color:'#5A1E7E', letterSpacing:'.05em' }}>PREMIUM DIGITAL MARKETPLACE</span>
              </motion.div>

              <motion.h1 initial={{opacity:0,y:44}} animate={{opacity:1,y:0}} transition={{duration:.95,delay:.25,ease:[.16,1,.3,1]}}
                style={{ fontFamily:'var(--font-editorial)', fontSize:'clamp(3rem,5.5vw,5.5rem)', fontWeight:400, lineHeight:1.06, color:'#2D004D', letterSpacing:'-.02em', marginBottom:'24px' }}>
                Discover &amp; Sell<br/>
                <span style={{ background:'linear-gradient(135deg,#7B3FA0,#C084FC)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', fontStyle:'italic' }}>Premium Digital</span><br/>
                Products
              </motion.h1>

              <motion.p initial={{opacity:0,y:28}} animate={{opacity:1,y:0}} transition={{duration:.8,delay:.4}}
                style={{ fontSize:'1.05rem', lineHeight:1.7, color:'#6B4F7A', maxWidth:'460px', marginBottom:'40px' }}>
                The curated marketplace for UI kits, templates, AI tools and digital assets — crafted by world-class creators.
              </motion.p>

              <motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.7,delay:.55}}
                className="home-hero-ctas"
                style={{ display:'flex', gap:'12px', flexWrap:'wrap', marginBottom:'52px' }}>
                {user ? (
                  <>
                    <button onClick={()=>navigateTo('marketplace')} className="btn-premium btn-premium-solid" style={{ padding:'14px 32px', fontSize:'.95rem', borderRadius:'14px', gap:'8px' }}>Browse Products <ArrowRight size={16}/></button>
                    <button onClick={()=>navigateTo('dashboard')}   className="btn-premium" style={{ padding:'14px 32px', fontSize:'.95rem', borderRadius:'14px' }}>My Dashboard</button>
                  </>
                ) : (
                  <>
                    <button onClick={()=>navigateTo('register-selection')} className="btn-premium btn-premium-solid" style={{ padding:'14px 32px', fontSize:'.95rem', borderRadius:'14px', gap:'8px' }}>Get Started <ArrowRight size={16}/></button>
                    <button onClick={()=>navigateTo('login-selection')}        className="btn-premium" style={{ padding:'14px 32px', fontSize:'.95rem', borderRadius:'14px' }}>Sign In</button>
                  </>
                )}
              </motion.div>

              {/* Stats */}
              <motion.div initial={{opacity:0,y:18}} animate={{opacity:1,y:0}} transition={{duration:.7,delay:.7}}
                className="home-hero-stats"
                style={{ display:'flex', gap:'36px', flexWrap:'wrap', paddingTop:'28px', borderTop:'1px solid rgba(220,198,255,.25)' }}>
                {[{v:'103',s:'+',l:'Products'},{v:'45',s:'K+',l:'Customers'},{v:'16',s:'Cr+',l:'Earnings'}].map((s,i)=>(
                  <div key={i}>
                    <div style={{ fontFamily:'var(--font-editorial)', fontSize:'2rem', fontWeight:400, color:'#2D004D', lineHeight:1 }}><Counter end={s.v} suffix={s.s}/></div>
                    <div style={{ fontSize:'.72rem', color:'#8B6B5B', fontWeight:600, marginTop:'4px' }}>{s.l}</div>
                  </div>
                ))}
              </motion.div>
            </div>

            {/* RIGHT — floating glass cards */}
            <div style={{ position:'relative', height:'520px' }} className="hero-cards">
              {[
                { src:'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80', style:{ top:'8%', left:'4%', width:'320px', height:'200px', transform:'rotate(-5deg)' }},
                { src:'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&q=80', style:{ top:'33%', right:'4%', width:'300px', height:'220px', transform:'rotate(4deg)' }},
                { src:'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=600&q=80', style:{ bottom:'4%', left:'14%', width:'260px', height:'180px', transform:'rotate(-2deg)' }},
              ].map((c,i)=>(
                <motion.div key={i} initial={{opacity:0,x:40}} animate={{opacity:1,x:0}} transition={{duration:1,delay:.4+i*.12,ease:[.16,1,.3,1]}}
                  style={{ position:'absolute', ...c.style, borderRadius:'18px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.55)', boxShadow:'0 20px 50px rgba(90,30,126,.14)', ...c.style }}>
                  <img src={c.src} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                </motion.div>
              ))}
              {/* Trend pill */}
              <motion.div initial={{opacity:0,scale:.8}} animate={{opacity:1,scale:1}} transition={{duration:.6,delay:1.0}}
                style={{ position:'absolute', bottom:'14px', right:0, padding:'12px 18px', borderRadius:'16px', ...glass({ padding:'12px 18px', borderRadius:'16px', display:'flex', alignItems:'center', gap:'12px' }) }}>
                <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display:'flex', alignItems:'center', justifyContent:'center' }}><TrendingUp size={16} color="#fff"/></div>
                <div><div style={{ fontSize:'.68rem', fontWeight:700, color:'#8B6B5B' }}>THIS WEEK</div><div style={{ fontSize:'.85rem', fontWeight:700, color:'#2D004D' }}>+2,400 sales</div></div>
              </motion.div>
            </div>
          </div>
        </section>
      </motion.div>

      {/* ═══════════ 2. CATEGORIES ═══════════ */}
      <section style={{ padding:'80px clamp(1.5rem,6vw,7rem)' }}>
        <div style={{ maxWidth:'1280px', margin:'0 auto' }}>
          <div className="gsap-reveal" style={{ textAlign:'center', marginBottom:'52px' }}>
            <p style={{ fontSize:'.65rem', fontWeight:800, color:'#7B3FA0', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'10px' }}>Browse by Category</p>
            <h2 style={{ fontFamily:'var(--font-editorial)', fontSize:'clamp(2rem,4vw,3rem)', fontWeight:400, color:'#2D004D' }}>Everything You Need to Build</h2>
          </div>
          <div className="lumora-cats-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'16px' }}>
            {CATS.map((cat,i)=>(
              <motion.button key={cat.name}
                initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}}
                viewport={{once:true,margin:'-40px'}}
                transition={{duration:.6,delay:i*.06,ease:[.16,1,.3,1]}}
                whileHover={{y:-7,boxShadow:'0 22px 55px rgba(90,30,126,.15)'}}
                onClick={()=>{setActiveCategory(cat.name);navigateTo('marketplace');}}
                style={{ padding:'28px 20px', borderRadius:'20px', border:'1px solid rgba(255,255,255,0.40)', borderTop:'1.5px solid rgba(255,255,255,0.55)', background:'rgba(255,255,255,0.30)', backdropFilter:'blur(32px) saturate(200%)', WebkitBackdropFilter:'blur(32px) saturate(200%)', cursor:'pointer', textAlign:'left', boxShadow:'0 8px 32px rgba(90,30,126,.08), inset 0 1px 0 rgba(255,255,255,.55)', transition:'all .3s', fontFamily:'var(--font-sans)' }}>
                <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:cat.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#5A1E7E', marginBottom:'14px' }}>{cat.icon}</div>
                <div style={{ fontSize:'.88rem', fontWeight:700, color:'#2D004D', marginBottom:'4px' }}>{cat.name}</div>
              </motion.button>
            ))}
            <motion.button initial={{opacity:0,y:30}} whileInView={{opacity:1,y:0}} viewport={{once:true,margin:'-40px'}} transition={{duration:.6,delay:CATS.length*.06}} whileHover={{y:-7}}
              onClick={()=>navigateTo('categories')}
              style={{ padding:'28px 20px', borderRadius:'20px', border:'2px dashed rgba(123,63,160,.28)', background:'transparent', cursor:'pointer', textAlign:'center', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'8px', fontFamily:'var(--font-sans)', transition:'all .3s' }}>
              <span style={{ fontSize:'2rem' }}>✦</span>
              <span style={{ fontSize:'.85rem', fontWeight:700, color:'#7B3FA0' }}>All 16 Categories</span>
            </motion.button>
          </div>
        </div>
      </section>

      {/* ═══════════ 3. FEATURED PRODUCTS ═══════════ */}
      <section style={{ padding:'80px clamp(1.5rem,6vw,7rem)', background:'rgba(220,198,255,0.06)' }}>
        <div style={{ maxWidth:'1280px', margin:'0 auto' }}>
          <div className="gsap-reveal" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'48px', flexWrap:'wrap', gap:'16px' }}>
            <div>
              <p style={{ fontSize:'.65rem', fontWeight:800, color:'#7B3FA0', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'8px' }}>Editor's Pick</p>
              <h2 style={{ fontFamily:'var(--font-editorial)', fontSize:'clamp(2rem,4vw,3rem)', fontWeight:400, color:'#2D004D' }}>Featured Products</h2>
            </div>
            <button onClick={()=>navigateTo('marketplace')} className="btn-premium" style={{ fontSize:'.82rem', gap:'6px', borderRadius:'12px' }}>View all 103 <ArrowRight size={14}/></button>
          </div>
          <div className="home-product-grid lumora-home-products-grid">
            {featured.map((p,i)=><PCard key={p.id} product={p} delay={i*.07}/>)}
          </div>
        </div>
      </section>

      {/* ═══════════ 4. STATS STRIP ═══════════ */}
      <section style={{ padding:'64px clamp(1.5rem,6vw,7rem)' }}>
        <div style={{ maxWidth:'1280px', margin:'0 auto' }}>
          <div className="gsap-reveal lumora-stats-strip" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(180px,1fr))', gap:'1px', background:'rgba(220,198,255,0.15)', borderRadius:'24px', overflow:'hidden', border:'1px solid rgba(255,255,255,0.35)' }}>
            {[
              {icon:<Sparkles size={22}/>,v:'103',s:'+',l:'Products'},
              {icon:<Users size={22}/>,v:'45000',s:'+',l:'Customers'},
              {icon:<Download size={22}/>,v:'500',s:'K+',l:'Downloads'},
              {icon:<Star size={22}/>,v:'4.9',s:'/5',l:'Avg Rating'},
              {icon:<Shield size={22}/>,v:'100',s:'%',l:'Secure'},
            ].map((s,i)=>(
              <div key={i} style={{ padding:'36px 24px', background:'rgba(255,255,255,0.28)', backdropFilter:'blur(32px) saturate(200%)', WebkitBackdropFilter:'blur(32px) saturate(200%)', textAlign:'center' }}>
                <div style={{ width:'48px', height:'48px', borderRadius:'14px', background:'linear-gradient(135deg,rgba(220,198,255,.50),rgba(255,214,186,.40))', display:'flex', alignItems:'center', justifyContent:'center', color:'#5A1E7E', margin:'0 auto 16px' }}>{s.icon}</div>
                <div style={{ fontFamily:'var(--font-editorial)', fontSize:'2.2rem', fontWeight:400, color:'#2D004D', lineHeight:1 }}><Counter end={s.v} suffix={s.s}/></div>
                <div style={{ fontSize:'.72rem', color:'#8B6B5B', fontWeight:600, marginTop:'6px' }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 5. TRENDING ═══════════ */}
      <section style={{ padding:'80px clamp(1.5rem,6vw,7rem)' }}>
        <div style={{ maxWidth:'1280px', margin:'0 auto' }}>
          <div className="gsap-reveal" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'48px', flexWrap:'wrap', gap:'16px' }}>
            <div>
              <p style={{ fontSize:'.65rem', fontWeight:800, color:'#7B3FA0', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'8px' }}>🔥 Hot Right Now</p>
              <h2 style={{ fontFamily:'var(--font-editorial)', fontSize:'clamp(2rem,4vw,3rem)', fontWeight:400, color:'#2D004D' }}>Trending This Week</h2>
            </div>
          </div>
          <div className="home-product-grid lumora-home-products-grid">
            {trending.map((p,i)=><PCard key={p.id} product={p} delay={i*.07}/>)}
          </div>
        </div>
      </section>

      {/* ── LATEST PRODUCTS ── */}
      <section style={{ padding:'80px clamp(1.5rem,6vw,7rem)', background:'rgba(220,198,255,0.06)' }}>
        <div style={{ maxWidth:'1280px', margin:'0 auto' }}>
          <div className="gsap-reveal" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginBottom:'48px', flexWrap:'wrap', gap:'16px' }}>
            <div>
              <p style={{ fontSize:'.65rem', fontWeight:800, color:'#7B3FA0', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'8px' }}>✦ Fresh Off The Press</p>
              <h2 style={{ fontFamily:'var(--font-editorial)', fontSize:'clamp(2rem,4vw,3rem)', fontWeight:400, color:'#2D004D' }}>Latest Products</h2>
            </div>
          </div>
          <div className="home-product-grid lumora-home-products-grid">
            {latest.map((p,i)=><PCard key={p.id} product={p} delay={i*.07}/>)}
          </div>
        </div>
      </section>

      {/* ═══════════ 6. TESTIMONIALS ═══════════ */}
      <section style={{ padding:'80px clamp(1.5rem,6vw,7rem)', background:'rgba(207,232,214,0.10)' }}>
        <div style={{ maxWidth:'900px', margin:'0 auto' }}>
          <div className="gsap-reveal" style={{ textAlign:'center', marginBottom:'52px' }}>
            <p style={{ fontSize:'.65rem', fontWeight:800, color:'#7B3FA0', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'10px' }}>Creator Voices</p>
            <h2 style={{ fontFamily:'var(--font-editorial)', fontSize:'clamp(2rem,4vw,3rem)', fontWeight:400, color:'#2D004D' }}>Loved by Builders Worldwide</h2>
          </div>
          <AnimatePresence mode="wait">
            <motion.div key={activeTestimonial}
              initial={{opacity:0,y:20}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-20}}
              transition={{duration:.45}}
              style={{ ...glass({padding:'44px', marginBottom:'28px'}) }}>
              <div style={{ display:'flex', gap:'3px', marginBottom:'20px' }}>
                {[...Array(5)].map((_,i)=><Star key={i} size={16} fill="#C7A55A" stroke="#C7A55A"/>)}
              </div>
              <p style={{ fontFamily:'var(--font-editorial)', fontSize:'clamp(1.1rem,2.5vw,1.5rem)', fontWeight:400, color:'#2D004D', lineHeight:1.55, marginBottom:'28px', fontStyle:'italic' }}>
                "{TESTIMONIALS[activeTestimonial].text}"
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:'14px' }}>
                <div style={{ width:'46px', height:'46px', borderRadius:'50%', background:'linear-gradient(135deg,#7B3FA0,#5A1E7E)', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:'1.1rem' }}>
                  {TESTIMONIALS[activeTestimonial].avatar}
                </div>
                <div>
                  <div style={{ fontSize:'.9rem', fontWeight:700, color:'#2D004D' }}>{TESTIMONIALS[activeTestimonial].name}</div>
                  <div style={{ fontSize:'.75rem', color:'#8B6B5B', fontWeight:500 }}>{TESTIMONIALS[activeTestimonial].role}</div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
          <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
            {TESTIMONIALS.map((_,i)=>(
              <button key={i} onClick={()=>setActiveTestimonial(i)}
                style={{ width:i===activeTestimonial?'22px':'8px', height:'8px', borderRadius:'4px', border:'none', background:i===activeTestimonial?'#7B3FA0':'rgba(123,63,160,.22)', cursor:'pointer', padding:0, transition:'all .3s' }}/>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 7. WHY LUMORA ═══════════ */}
      <section style={{ padding:'80px clamp(1.5rem,6vw,7rem)' }}>
        <div style={{ maxWidth:'1280px', margin:'0 auto' }}>
          <div className="gsap-reveal" style={{ textAlign:'center', marginBottom:'52px' }}>
            <p style={{ fontSize:'.65rem', fontWeight:800, color:'#7B3FA0', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'10px' }}>Why Lumora</p>
            <h2 style={{ fontFamily:'var(--font-editorial)', fontSize:'clamp(2rem,4vw,3rem)', fontWeight:400, color:'#2D004D' }}>Built for Creators &amp; Builders</h2>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(280px,1fr))', gap:'20px' }}>
            {[
              {icon:<Zap size={22}/>,    color:'rgba(220,198,255,.45)', title:'Instant Download',      desc:'Every purchase gives you immediate access. No waiting — just seamless, secure delivery.'},
              {icon:<Shield size={22}/>, color:'rgba(207,232,214,.45)', title:'Commercial License',    desc:'Use all products in client work, SaaS apps and commercial projects with full transparency.'},
              {icon:<Download size={22}/>,color:'rgba(220,238,255,.45)',title:'Lifetime Access',       desc:'Your purchases live in your secure vault forever. Free updates, for life.'},
              {icon:<Users size={22}/>,  color:'rgba(255,214,186,.45)', title:'50+ Verified Creators', desc:'Expert creators from around the world bringing premium quality digital assets.'},
              {icon:<Sparkles size={22}/>,color:'rgba(255,220,229,.45)',title:'Curated Quality',       desc:'Every product is reviewed by our editorial team. Only the best make it to the store.'},
              {icon:<BarChart3 size={22}/>,color:'rgba(221,245,229,.45)',title:'Creator Analytics',   desc:'Real-time earnings dashboards and growth insights to help creators scale their business.'},
            ].map((f,i)=>(
              <Reveal key={i} delay={i*.06}>
                <div style={{ ...glass({padding:'30px'}), cursor:'default' }}
                  onMouseEnter={e=>{e.currentTarget.style.transform='translateY(-6px)';e.currentTarget.style.boxShadow='0 24px 56px rgba(90,30,126,.18), inset 0 1px 0 rgba(255,255,255,.70)';}}
                  onMouseLeave={e=>{e.currentTarget.style.transform='translateY(0)';e.currentTarget.style.boxShadow='0 8px 32px rgba(90,30,126,.10), inset 0 1px 0 rgba(255,255,255,.60)';}}>
                  <div style={{ width:'46px', height:'46px', borderRadius:'13px', background:f.color, display:'flex', alignItems:'center', justifyContent:'center', color:'#5A1E7E', marginBottom:'16px' }}>{f.icon}</div>
                  <h3 style={{ fontSize:'.98rem', fontWeight:700, color:'#2D004D', marginBottom:'8px' }}>{f.title}</h3>
                  <p style={{ fontSize:'.83rem', color:'#6B4F7A', lineHeight:1.65 }}>{f.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════ 8. CTA ═══════════ */}
      <section style={{ padding:'80px clamp(1.5rem,6vw,7rem) 100px' }}>
        <div style={{ maxWidth:'880px', margin:'0 auto' }}>
          <Reveal>
            <div style={{ ...glass({padding:'clamp(48px,8vw,80px)', textAlign:'center', position:'relative', overflow:'hidden', borderRadius:'32px'}) }}>
              <div style={{ position:'absolute', top:'-30%', left:'-10%', width:'480px', height:'480px', borderRadius:'50%', background:'radial-gradient(circle,rgba(220,198,255,.28) 0%,transparent 65%)', filter:'blur(60px)', pointerEvents:'none' }} />
              <div style={{ position:'absolute', bottom:'-30%', right:'-10%', width:'380px', height:'380px', borderRadius:'50%', background:'radial-gradient(circle,rgba(255,214,186,.22) 0%,transparent 65%)', filter:'blur(60px)', pointerEvents:'none' }} />
              <div style={{ position:'relative', zIndex:1 }}>
                <p style={{ fontSize:'.68rem', fontWeight:800, color:'#7B3FA0', letterSpacing:'.12em', textTransform:'uppercase', marginBottom:'16px' }}>✦ Join Lumora Today</p>
                <h2 style={{ fontFamily:'var(--font-editorial)', fontSize:'clamp(2.5rem,5vw,4rem)', fontWeight:400, color:'#2D004D', lineHeight:1.1, marginBottom:'18px' }}>
                  Build Something<br/>
                  <span style={{ background:'linear-gradient(135deg,#7B3FA0,#C084FC)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text', fontStyle:'italic' }}>Extraordinary</span>
                </h2>
                <p style={{ color:'#6B4F7A', fontSize:'1rem', maxWidth:'480px', margin:'0 auto 36px', lineHeight:1.65 }}>
                  Join 45,000+ creators and builders already using Lumora to ship faster, design better and earn more.
                </p>
                <div style={{ display:'flex', gap:'12px', justifyContent:'center', flexWrap:'wrap' }}>
                  <button onClick={()=>navigateTo('register-selection')} className="btn-premium btn-premium-solid" style={{ padding:'15px 36px', fontSize:'.95rem', borderRadius:'14px', gap:'8px' }}>Get Started Free <ArrowRight size={16}/></button>
                  <button onClick={()=>navigateTo('marketplace')} className="btn-premium" style={{ padding:'15px 36px', fontSize:'.95rem', borderRadius:'14px' }}>Browse Products</button>
                </div>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'20px', marginTop:'24px', flexWrap:'wrap' }}>
                  {['No credit card required','Instant access','Commercial license'].map((t,i)=>(
                    <span key={i} style={{ display:'flex', alignItems:'center', gap:'5px', fontSize:'.76rem', color:'#8B6B5B', fontWeight:600 }}>
                      <Check size={12} style={{ color:'#16a34a' }}/> {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      <Footer />
    </div>
  );
}
