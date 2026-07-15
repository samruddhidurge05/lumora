import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldCheck, Lock, Eye, FileText, CheckCircle2,
  Database, ShieldAlert, ArrowRight, Sparkles, Check
} from 'lucide-react';

const PrivacyPolicy = ({ role }) => {
  // Checkbox states
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [agreedToTelemetry, setAgreedToTelemetry] = useState(false);
  
  // Consent submission states
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleConsentSubmit = (e) => {
    e.preventDefault();
    if (!agreedToTerms || !agreedToTelemetry) return;

    setIsSubmitting(true);

    // Simulate ledger confirmation write
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
    }, 1800);
  };

  const isFormValid = agreedToTerms && agreedToTelemetry;

  // Stagger entry configurations
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 350, damping: 25 } },
  };

  return (
    <div className="pp-root">
      <div className="pp-canvas">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="pp-wrapper"
        >
          {role === 'affiliate' ? (
            <>
              <motion.section className="pp-hero" variants={itemVariants}>
                <div className="pp-badge">
                  <ShieldCheck size={13} className="pp-badge-icon" />
                  <span>AFFILIATE PRIVACY LEDGER</span>
                </div>
                <h1 className="pp-hero-title">Affiliate Data & Tracking Policy.</h1>
                <p className="pp-hero-subtitle">
                  Learn how we handle referral tracking cookies, commission attribution, and affiliate account data.
                </p>
              </motion.section>

              <motion.section className="pp-content-section" variants={itemVariants}>
                <div className="pp-glass-panel">
                  <div className="pp-policy-grid">
                    
                    <div className="pp-policy-item">
                      <div className="pp-item-header">
                        <div className="pp-icon-box"><Database size={20} /></div>
                        <h3>Information We Collect</h3>
                      </div>
                      <p>
                        To facilitate the Lumora Affiliate Program, we collect essential data required to maintain your account, track referrals, and process payouts. This includes your name, email address, payment details, and web telemetry associated with your unique affiliate links.
                      </p>
                    </div>

                    <div className="pp-policy-item">
                      <div className="pp-item-header">
                        <div className="pp-icon-box"><Eye size={20} /></div>
                        <h3>Referral Tracking</h3>
                      </div>
                      <p>
                        When you share your affiliate referral link, we track the inbound traffic to properly attribute any resulting actions to your profile. We log the timestamp, origin IP (anonymized), and the specific product or page accessed.
                      </p>
                    </div>

                    <div className="pp-policy-item">
                      <div className="pp-item-header">
                        <div className="pp-icon-box"><Sparkles size={20} /></div>
                        <h3>Cookies</h3>
                      </div>
                      <p>
                        We drop a functional tracking cookie on the visitor's browser when they click your link. This cookie has an extended lifespan (typically 30-90 days) and is solely used to attribute subsequent purchases back to your affiliate account. We do not track visitors across other websites or third-party networks.
                      </p>
                    </div>

                    <div className="pp-policy-item">
                      <div className="pp-item-header">
                        <div className="pp-icon-box"><FileText size={20} /></div>
                        <h3>Commission Attribution</h3>
                      </div>
                      <p>
                        We record the timestamp, referral code, order ID, and sale amount for every transaction attributed to your account. This data is strictly used for calculating and validating your commissions. We do not share customer personal identification with affiliates.
                      </p>
                    </div>

                    <div className="pp-policy-item">
                      <div className="pp-item-header">
                        <div className="pp-icon-box"><ShieldAlert size={20} /></div>
                        <h3>Affiliate Account Data</h3>
                      </div>
                      <p>
                        Your payout details, earnings history, and account profile are encrypted. We retain this data as long as your account is active. If you choose to close your account, we may retain certain records for tax compliance and legal obligations.
                      </p>
                    </div>

                    <div className="pp-policy-item">
                      <div className="pp-item-header">
                        <div className="pp-icon-box"><CheckCircle2 size={20} /></div>
                        <h3>Payout Information</h3>
                      </div>
                      <p>
                        Payout requests are processed securely via third-party financial institutions (e.g., Stripe, PayPal, or direct bank transfer). We share only the necessary transactional data required to execute the payout successfully.
                      </p>
                    </div>

                    <div className="pp-policy-item">
                      <div className="pp-item-header">
                        <div className="pp-icon-box"><Lock size={20} /></div>
                        <h3>Data Security</h3>
                      </div>
                      <p>
                        All telemetry and affiliate data is secured behind 256-bit SSL encryption. Access to our tracking databases is strictly limited to authorized engineering personnel for the purposes of maintaining the integrity of the affiliate program.
                      </p>
                    </div>

                    <div className="pp-policy-item">
                      <div className="pp-item-header">
                        <div className="pp-icon-box"><ArrowRight size={20} /></div>
                        <h3>Contact Information</h3>
                      </div>
                      <p>
                        If you have any questions regarding this privacy policy or how we handle your affiliate data, please reach out to us via the Contact section in your Affiliate Support dashboard, or email us at legal@lumora.com.
                      </p>
                    </div>

                  </div>
                </div>
              </motion.section>
            </>
          ) : (
            <>
          <motion.section className="pp-hero" variants={itemVariants}>
            <div className="pp-badge">
              <ShieldCheck size={13} className="pp-badge-icon" />
              <span>SECURE TELEMETRY DECK</span>
            </div>
            <h1 className="pp-hero-title">Privacy & Policy Ledger.</h1>
            <p className="pp-hero-subtitle">
              Learn how we protect user credentials, secure premium digital assets, and process ledger interactions.
            </p>
          </motion.section>

          {/* SECTION 2: EDITORIAL CONTENT */}
          <motion.section className="pp-content-section" variants={itemVariants}>
            <div className="pp-glass-panel">
              <div className="pp-policy-grid">
                
                {/* Policy Point 1 */}
                <div className="pp-policy-item">
                  <div className="pp-item-header">
                    <div className="pp-icon-box"><Lock size={20} /></div>
                    <h3>Data Privacy & Encryption</h3>
                  </div>
                  <p>
                    All customer profiles, login credentials, and transactions on the Lumora Marketplace are protected under 256-bit SSL encryption. We restrict access to personal identifiers, ensuring that download history and vault telemetry remain private. Financial transactions are encrypted and processed directly by Stripe; Lumora does not store full credit card details on its servers.
                  </p>
                </div>

                {/* Policy Point 2 */}
                <div className="pp-policy-item">
                  <div className="pp-item-header">
                    <div className="pp-icon-box"><Eye size={20} /></div>
                    <h3>Cookies & Canvas Telemetry</h3>
                  </div>
                  <p>
                    We deploy functional browser cookies and localized sessions to manage your shopping cart state, identify verified license holders, and persist your digital sandbox profile. Telemetry tracking is collected solely to enhance page performance, audit download speeds, and prevent automated script abuse on creative asset vaults.
                  </p>
                </div>

                {/* Policy Point 3 */}
                <div className="pp-policy-item">
                  <div className="pp-item-header">
                    <div className="pp-icon-box"><Database size={20} /></div>
                    <h3>Digital Vault & License Ledger</h3>
                  </div>
                  <p>
                    Purchasing premium UI kits, Next.js starter templates, or Lightroom presets logs a secure transaction record in our vault ledger. This ledger ensures lifetime product access for buyers. Creators receive aggregated, anonymized payout metrics and download counts, maintaining buyer anonymity unless explicitly shared during support requests.
                  </p>
                </div>

                {/* Policy Point 4 */}
                <div className="pp-policy-item">
                  <div className="pp-item-header">
                    <div className="pp-icon-box"><ShieldAlert size={20} /></div>
                    <h3>User Control & Erasure Rights</h3>
                  </div>
                  <p>
                    You retain full control over your telemetry profile. You have the right to request access to the logs containing your profile activity, request immediate anonymization of download history records, or ask for complete deletion of your support concierges ticket archive. Note that deleting key transaction logs may restrict lifetime access updates.
                  </p>
                </div>

              </div>
            </div>
          </motion.section>

          {/* SECTION 3: CONSENT LEDGER CONSOLE */}
          <motion.section className="pp-consent-section" variants={itemVariants}>
            <div className="pp-consent-card pp-glass-panel">
              <AnimatePresence mode="wait">
                {!isSubmitted ? (
                  <motion.form
                    key="consent-form"
                    initial={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onSubmit={handleConsentSubmit}
                    className="pp-consent-form"
                  >
                    <div className="pp-consent-intro">
                      <span className="pp-pre">CONSENT REGISTRY</span>
                      <h2>Acknowledge Digital Ledger</h2>
                      <p>To access creative assets, download vaults, and communicate with creators, verify your consent parameters below.</p>
                    </div>

                    <div className="pp-checkbox-stack">
                      {/* Checkbox 1 */}
                      <label className={`pp-checkbox-row ${agreedToTerms ? 'pp-checked' : ''}`}>
                        <div className="pp-checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={agreedToTerms}
                            onChange={(e) => setAgreedToTerms(e.target.checked)}
                            className="pp-hidden-checkbox"
                          />
                          <div className="pp-custom-checkbox">
                            {agreedToTerms && <Check size={14} className="pp-check-svg" />}
                          </div>
                        </div>
                        <div className="pp-checkbox-label">
                          <strong>Agree to Terms & Privacy Guidelines</strong>
                          <span>I have read, understood, and agree to the Lumora Brand Privacy Policy and License Agreement terms.</span>
                        </div>
                      </label>

                      {/* Checkbox 2 */}
                      <label className={`pp-checkbox-row ${agreedToTelemetry ? 'pp-checked' : ''}`}>
                        <div className="pp-checkbox-wrapper">
                          <input
                            type="checkbox"
                            checked={agreedToTelemetry}
                            onChange={(e) => setAgreedToTelemetry(e.target.checked)}
                            className="pp-hidden-checkbox"
                          />
                          <div className="pp-custom-checkbox">
                            {agreedToTelemetry && <Check size={14} className="pp-check-svg" />}
                          </div>
                        </div>
                        <div className="pp-checkbox-label">
                          <strong>Consent to Safe Telemetry Processing</strong>
                          <span>I consent to the secure collection, ledger storage, and telemetry processing of my account interactions as outlined in this policy.</span>
                        </div>
                      </label>
                    </div>

                    {/* Submit Consent Button */}
                    <button
                      type="submit"
                      disabled={!isFormValid || isSubmitting}
                      className={`pp-submit-btn ${!isFormValid ? 'pp-disabled' : ''}`}
                    >
                      {isSubmitting ? (
                        <span className="pp-btn-loading">Recording Consent...</span>
                      ) : (
                        <>
                          <span>Register My Acknowledgement</span>
                          <ArrowRight size={15} className="pp-btn-icon" />
                        </>
                      )}
                    </button>
                  </motion.form>
                ) : (
                  <motion.div
                    key="consent-success"
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                    className="pp-success-overlay"
                  >
                    <div className="pp-success-icon-box">
                      <CheckCircle2 size={46} />
                    </div>
                    <h3 className="pp-success-title">Acknowledgement Registered</h3>
                    <p className="pp-success-desc">
                      Thank you. Your consent parameters have been securely stored in our ledger. Your account status is marked as compliant, and you have active download vault access.
                    </p>
                    <div className="pp-success-btn-row">
                      <a href="#" className="pp-success-primary-btn">
                        Go to Cart
                      </a>
                      <button
                        type="button"
                        className="pp-success-secondary-btn"
                        onClick={() => {
                          setAgreedToTerms(false);
                          setAgreedToTelemetry(false);
                          setIsSubmitted(false);
                        }}
                      >
                        Reset Consent Status
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section>
            </>
          )}
        </motion.div>
      </div>

      {/* Embedded CSS Style Section */}
      <style>{`
        .pp-root {
          min-height: 100vh;
          background: transparent;
          color: #381347;
          font-family: 'Outfit', 'Inter', system-ui, -apple-system, sans-serif;
          position: relative;
          overflow: hidden;
          box-sizing: border-box;
        }

        .pp-canvas {
          position: relative;
          z-index: 1;
          max-width: 1240px;
          margin: 0 auto;
          padding: 2rem 2rem 4rem 2rem;
          box-sizing: border-box;
        }

        .pp-wrapper {
          display: flex;
          flex-direction: column;
          gap: 3rem;
        }

        .pp-glass-panel {
          transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* HERO SECTION */
        .pp-hero {
          text-align: center;
          padding: 3rem 0 2rem 0;
          max-width: 800px;
          margin: 0 auto;
        }

        .pp-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(56, 19, 71, 0.05);
          border: 1px solid rgba(56, 19, 71, 0.08);
          padding: 0.45rem 1.1rem;
          border-radius: 50px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.12em;
          color: #743B94;
          margin-bottom: 2rem;
        }

        .pp-badge-icon {
          color: #A174B8;
          animation: ppBadgePulse 2s infinite ease-in-out;
        }

        @keyframes ppBadgePulse {
          0%, 100% { transform: scale(0.85); opacity: 0.7; }
          50% { transform: scale(1.15); opacity: 1; }
        }

        .pp-hero-title {
          font-family: 'Outfit', sans-serif;
          font-size: clamp(2.8rem, 6vw, 3.8rem);
          font-weight: 500;
          color: #381347;
          margin: 0 0 1.5rem 0;
          line-height: 1.15;
          letter-spacing: -0.02em;
        }

        .pp-hero-subtitle {
          font-size: 1.2rem;
          line-height: 1.6;
          color: #743B94;
          margin: 0 auto;
          max-width: 650px;
        }

        /* POLICY GRID SECTION */
        .pp-content-section {
          width: 100%;
        }

        .pp-policy-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 3rem;
          padding: 4rem;
        }

        @media (max-width: 768px) {
          .pp-policy-grid {
            grid-template-columns: 1fr;
            padding: 2rem;
            gap: 2rem;
          }
        }

        .pp-policy-item {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .pp-item-header {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .pp-icon-box {
          width: 44px;
          height: 44px;
          background: rgba(161, 116, 184, 0.08);
          color: #A174B8;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.4s ease;
        }

        .pp-policy-item:hover .pp-icon-box {
          background: #381347;
          color: #FFFDF9;
          transform: scale(1.05);
        }

        .pp-item-header h3 {
          font-family: 'Outfit', sans-serif;
          font-size: 1.35rem;
          font-weight: 500;
          color: #381347;
        }

        .pp-policy-item p {
          font-size: 0.95rem;
          line-height: 1.65;
          color: #743B94;
        }

        /* CONSENT CONSOLE SECTION */
        .pp-consent-section {
          max-width: 800px;
          margin: 0 auto;
          width: 100%;
        }

        .pp-consent-card {
          padding: 4rem;
          position: relative;
          overflow: hidden;
        }

        @media (max-width: 600px) {
          .pp-consent-card {
            padding: 2rem;
          }
        }

        .pp-consent-intro {
          text-align: center;
          margin-bottom: 3rem;
        }

        .pp-pre {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.1em;
          color: #A174B8;
          display: block;
          margin-bottom: 0.5rem;
        }

        .pp-consent-intro h2 {
          font-family: 'Outfit', sans-serif;
          font-size: 2rem;
          font-weight: 500;
          color: #381347;
          margin: 0 0 0.75rem 0;
        }

        .pp-consent-intro p {
          font-size: 0.95rem;
          color: #743B94;
          margin: 0;
          line-height: 1.5;
        }

        .pp-checkbox-stack {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          margin-bottom: 3rem;
        }

        .pp-checkbox-row {
          display: flex;
          align-items: flex-start;
          gap: 1.25rem;
          padding: 1.5rem 1.75rem;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.4);
          border: 1px solid rgba(56, 19, 71, 0.05);
          cursor: pointer;
          transition: all 0.3s ease;
          user-select: none;
        }

        .pp-checkbox-row:hover {
          background: rgba(255, 255, 255, 0.8);
          border-color: rgba(161, 116, 184, 0.2);
        }

        .pp-checkbox-row.pp-checked {
          background: rgba(255, 255, 255, 0.9);
          border-color: rgba(161, 116, 184, 0.45);
          box-shadow: 0 8px 24px -10px rgba(56, 19, 71, 0.08);
        }

        .pp-checkbox-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          margin-top: 3px;
        }

        .pp-hidden-checkbox {
          position: absolute;
          opacity: 0;
          cursor: pointer;
          height: 0;
          width: 0;
        }

        .pp-custom-checkbox {
          width: 20px;
          height: 20px;
          background: rgba(255, 255, 255, 0.9);
          border: 1px solid rgba(56, 19, 71, 0.15);
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.3s ease;
        }

        .pp-checkbox-row:hover .pp-custom-checkbox {
          border-color: #A174B8;
        }

        .pp-checked .pp-custom-checkbox {
          background: #381347;
          border-color: #381347;
        }

        .pp-check-svg {
          color: #FFFDF9;
        }

        .pp-checkbox-label {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
        }

        .pp-checkbox-label strong {
          font-size: 0.95rem;
          color: #381347;
          font-weight: 600;
        }

        .pp-checkbox-label span {
          font-size: 0.85rem;
          line-height: 1.45;
          color: #743B94;
        }

        .pp-submit-btn {
          font-family: 'Outfit', sans-serif;
          font-size: 0.95rem;
          font-weight: 700;
          color: #FFFDF9;
          background: #381347;
          border: 1px solid #381347;
          border-radius: 14px;
          padding: 1rem 2.25rem;
          cursor: pointer;
          width: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.75rem;
          box-shadow: 0 10px 24px -8px rgba(56, 19, 71, 0.35);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .pp-submit-btn:hover:not(.pp-disabled) {
          transform: translateY(-2px);
          box-shadow: 0 15px 30px -8px rgba(56, 19, 71, 0.45);
          background: #501b64;
          border-color: #501b64;
        }

        .pp-submit-btn.pp-disabled {
          background: rgba(56, 19, 71, 0.08);
          border-color: transparent;
          color: rgba(56, 19, 71, 0.3);
          box-shadow: none;
          cursor: not-allowed;
        }

        .pp-btn-icon {
          transition: transform 0.3s ease;
        }

        .pp-submit-btn:hover .pp-btn-icon {
          transform: translateX(4px);
        }

        .pp-btn-loading {
          opacity: 0.8;
        }

        /* SUCCESS STATE STYLES */
        .pp-success-overlay {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
        }

        .pp-success-icon-box {
          width: 74px;
          height: 74px;
          background: rgba(59, 111, 76, 0.08);
          color: #3b6f4c;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 2rem;
          box-shadow: 0 8px 24px rgba(59, 111, 76, 0.06);
        }

        .pp-success-title {
          font-family: 'Outfit', sans-serif;
          font-size: 1.8rem;
          font-weight: 500;
          color: #381347;
          margin-bottom: 1rem;
        }

        .pp-success-desc {
          font-size: 1rem;
          line-height: 1.6;
          color: #743B94;
          max-width: 500px;
          margin-bottom: 3rem;
        }

        .pp-success-btn-row {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          justify-content: center;
          width: 100%;
        }

        .pp-success-primary-btn {
          font-family: 'Outfit', sans-serif;
          font-size: 0.9rem;
          font-weight: 700;
          color: #FFFDF9;
          background: #381347;
          border: 1px solid #381347;
          border-radius: 12px;
          padding: 0.85rem 2rem;
          text-decoration: none;
          box-shadow: 0 8px 20px -8px rgba(56, 19, 71, 0.3);
          transition: all 0.3s ease;
        }

        .pp-success-primary-btn:hover {
          transform: translateY(-2px);
          box-shadow: 0 12px 24px -8px rgba(56, 19, 71, 0.4);
          background: #501b64;
          border-color: #501b64;
        }

        .pp-success-secondary-btn {
          font-family: 'Outfit', sans-serif;
          font-size: 0.9rem;
          font-weight: 600;
          color: #743B94;
          background: transparent;
          border: 1px solid rgba(56, 19, 71, 0.12);
          border-radius: 12px;
          padding: 0.85rem 2rem;
          cursor: pointer;
          transition: all 0.3s ease;
        }

        .pp-success-secondary-btn:hover {
          background: rgba(56, 19, 71, 0.04);
          border-color: rgba(56, 19, 71, 0.25);
        }

        /* FOOTER */
        .pp-footer {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 5rem 0 3rem 0;
          margin-top: 6rem;
          border-top: 1px solid rgba(56, 19, 71, 0.08);
          position: relative;
          z-index: 2;
        }

        .pp-footer-links {
          display: flex;
          align-items: center;
          gap: 0.8rem;
          margin-bottom: 1.25rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .pp-footer-link {
          font-size: 0.85rem;
          font-weight: 600;
          color: #743B94;
          text-decoration: none;
          transition: color 0.3s ease;
        }

        .pp-footer-link:hover, .pp-active-link {
          color: #381347;
        }

        .pp-footer-dot {
          color: rgba(56, 19, 71, 0.2);
          font-size: 0.9rem;
        }

        .pp-footer-copyright {
          font-size: 0.82rem;
          color: #A174B8;
          opacity: 0.8;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export default PrivacyPolicy;
