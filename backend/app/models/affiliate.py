from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON, UniqueConstraint
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime
import uuid


def gen_code():
    return "AFF" + uuid.uuid4().hex[:6].upper()


class AffiliateProfile(Base):
    """One-to-one extension of User for affiliate-specific data."""
    __tablename__ = "affiliate_profiles"

    id              = Column(Integer, primary_key=True, index=True)
    user_id         = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False, index=True)
    referral_code   = Column(String(20), unique=True, nullable=False, default=gen_code)
    commission_rate = Column(Float, default=20.0)        # percentage
    total_earnings  = Column(Float, default=0.0)
    total_clicks    = Column(Integer, default=0)
    total_sales     = Column(Integer, default=0)
    # Payment info
    upi_id          = Column(String(100), nullable=True)
    bank_name       = Column(String(120), nullable=True)
    account_number  = Column(String(50), nullable=True)
    ifsc_code       = Column(String(20), nullable=True)

    # Phase 1 UI New Fields
    display_name         = Column(String(150), nullable=True)
    short_bio            = Column(Text, nullable=True)
    country              = Column(String(100), nullable=True)
    youtube              = Column(String(255), nullable=True)
    instagram            = Column(String(255), nullable=True)
    linkedin             = Column(String(255), nullable=True)
    preferred_categories = Column(JSON, nullable=True)
    promotion_methods    = Column(JSON, nullable=True)
    primary_audience     = Column(String(100), nullable=True)
    audience_size        = Column(String(50), nullable=True)
    preferred_language   = Column(String(50), nullable=True)
    preferred_currency   = Column(String(10), nullable=True)
    timezone             = Column(String(50), nullable=True)
    email_notifications  = Column(Boolean, default=True)

    # Phase 2: Operations Console — earnings breakdown & engagement metrics
    pending_earnings     = Column(Float, default=0.0)    # commissions not yet approved
    paid_earnings        = Column(Float, default=0.0)    # commissions fully paid out
    rejected_earnings    = Column(Float, default=0.0)    # commissions rejected/reversed
    unique_clicks        = Column(Integer, default=0)    # deduplicated click count
    avg_order_value      = Column(Float, default=0.0)    # average sale amount they generate
    last_active_at       = Column(DateTime, nullable=True) # last click or sale event

    # Status
    is_active       = Column(Boolean, default=True)
    status          = Column(String(50), default="active")
    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user        = relationship("User",                back_populates="affiliate_profile")
    commissions = relationship("AffiliateCommission", back_populates="affiliate", cascade="all, delete-orphan")
    payouts     = relationship("AffiliatePayout",     back_populates="affiliate", cascade="all, delete-orphan")


class ReferralAttribution(Base):
    """
    Immutable accounting ledger record for affiliate referral purchases.
    Identity and event metadata are PERMANENTLY IMMUTABLE once created.
    Only status, fraud_flags, and commission_id may be updated.
    """
    __tablename__ = "referral_attributions"

    id               = Column(Integer, primary_key=True, index=True)
    order_id         = Column(Integer, ForeignKey("orders.id"), nullable=False, unique=True, index=True)
    customer_id      = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    affiliate_id     = Column(Integer, ForeignKey("affiliate_profiles.id"), nullable=False, index=True)
    affiliate_code   = Column(String(50), nullable=False, index=True)
    referral_link_id = Column(Integer, ForeignKey("referral_links.id"), nullable=True, index=True)
    product_id       = Column(Integer, ForeignKey("products.id"), nullable=True, index=True)
    vendor_id        = Column(Integer, nullable=True, index=True)
    click_id         = Column(Integer, ForeignKey("referral_clicks.id"), nullable=True)

    # Mutable linkage & status fields
    commission_id    = Column(Integer, ForeignKey("affiliate_commissions.id", use_alter=True, name="fk_ref_attr_commission_id"), nullable=True)
    status           = Column(String(30), default="attributed", index=True) # attributed | commissioned | pending_review | recovered | flagged
    fraud_flags      = Column(JSON, nullable=True)

    # Immutable metadata fields
    device_type      = Column(String(50), nullable=True)
    browser          = Column(String(100), nullable=True)
    ip_address       = Column(String(45), nullable=True)
    referral_url     = Column(String(500), nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, index=True)

    order        = relationship("Order")
    customer     = relationship("User", foreign_keys=[customer_id])
    affiliate    = relationship("AffiliateProfile")
    referral_link = relationship("ReferralLink")


class AffiliateCommission(Base):
    """A commission earned when a referred user purchases a product."""
    __tablename__ = "affiliate_commissions"
    __table_args__ = (
        UniqueConstraint("order_id", name="uq_affiliate_commission_order_id"),
    )

    id              = Column(Integer, primary_key=True, index=True)
    affiliate_id    = Column(Integer, ForeignKey("affiliate_profiles.id"), nullable=False, index=True)
    order_id        = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)
    product_id      = Column(Integer, nullable=True, index=True)
    product_name    = Column(String(255), nullable=True)
    sale_amount     = Column(Float, nullable=False)      # original sale price
    commission_amt  = Column(Float, nullable=False)      # amount earned
    status          = Column(String(20), default="pending")  # legacy field kept for backward compat

    # Phase 2 & Enterprise Attribution Fields
    referral_attribution_id = Column(Integer, ForeignKey("referral_attributions.id"), nullable=True)
    referral_link_id        = Column(Integer, ForeignKey("referral_links.id"), nullable=True, index=True)
    device_type             = Column(String(50), nullable=True)
    browser                 = Column(String(100), nullable=True)
    ip_address              = Column(String(45), nullable=True)
    referral_url_used       = Column(String(500), nullable=True)

    commission_type     = Column(String(20), default="percentage")  # percentage | fixed
    commission_rate     = Column(Float, default=0.0)                # rate used (% or INR)
    customer_name       = Column(String(255), nullable=True)        # buyer display name
    customer_email      = Column(String(255), nullable=True)        # buyer email (masked in UI)
    cookie_attr_date    = Column(DateTime, nullable=True)           # when referral cookie was first set
    last_click_at       = Column(DateTime, nullable=True)           # last referral click before purchase
    gateway_tx_id       = Column(String(255), nullable=True)        # Razorpay payment_id
    commission_status   = Column(String(30), default="pending", index=True) # pending|approved|ready_for_payout|paid|reversed|rejected|archived
    purchase_status     = Column(String(20), default="completed")   # completed|refunded|cancelled
    refund_status       = Column(String(20), default="none")        # none|partial|full
    admin_notes         = Column(Text, nullable=True)               # admin review notes
    reversed_at         = Column(DateTime, nullable=True)           # timestamp when commission was reversed
    refund_deduction    = Column(Float, default=0.0)                # amount deducted due to refund
    approved_at         = Column(DateTime, nullable=True)
    paid_at             = Column(DateTime, nullable=True)

    created_at      = Column(DateTime, default=datetime.utcnow, index=True)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    affiliate = relationship("AffiliateProfile", back_populates="commissions")


class AffiliatePayout(Base):
    """
    A withdrawal/payout request from an affiliate.

    Status machine:
        pending → processing → completed
                             ↘ failed
        pending → rejected   (admin rejected without attempting payment)
    """
    __tablename__ = "affiliate_payouts"

    id              = Column(Integer, primary_key=True, index=True)
    affiliate_id    = Column(Integer, ForeignKey("affiliate_profiles.id"), nullable=False, index=True)
    amount          = Column(Float, nullable=False)
    method          = Column(String(30), default="upi")    # upi | bank
    upi_id          = Column(String(100), nullable=True)
    bank_account    = Column(String(50), nullable=True)

    # Status: pending | processing | completed | failed | rejected
    status          = Column(String(20), default="pending", index=True)
    notes           = Column(Text, nullable=True)

    # ── Payout Provider Tracking (production columns — all nullable) ──────────
    # Populated when admin triggers payment; persisted before provider call
    # to prevent duplicate dispatch on retry.
    payout_mode              = Column(String(20), nullable=True)   # "mock" | "razorpay"
    razorpay_payout_id       = Column(String(100), nullable=True, index=True)  # provider ref
    razorpay_fund_account_id = Column(String(100), nullable=True)  # Razorpay fund account
    failure_reason           = Column(Text, nullable=True)         # populated on failure
    processed_at             = Column(DateTime, nullable=True)     # when provider was called
    completed_at             = Column(DateTime, nullable=True)     # when confirmed complete

    created_at      = Column(DateTime, default=datetime.utcnow)
    updated_at      = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    affiliate = relationship("AffiliateProfile", back_populates="payouts")


class ReferralLink(Base):
    """A unique referral link generated by an affiliate for a specific product."""
    __tablename__ = "referral_links"

    id            = Column(Integer, primary_key=True, index=True)
    affiliate_id  = Column(Integer, ForeignKey("affiliate_profiles.id"), nullable=False, index=True)
    product_id    = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    referral_code = Column(String(50), unique=True, nullable=False, index=True)
    name          = Column(String(100), nullable=True)  # campaign or alias name
    clicks_count  = Column(Integer, default=0)
    is_active     = Column(Boolean, default=True)
    created_at    = Column(DateTime, default=datetime.utcnow)

    affiliate = relationship("AffiliateProfile")
    product   = relationship("Product")
    clicks    = relationship("ReferralClick", back_populates="referral_link", cascade="all, delete-orphan")


class ReferralClick(Base):
    """An individual click tracked for a referral link."""
    __tablename__ = "referral_clicks"

    id               = Column(Integer, primary_key=True, index=True)
    referral_link_id = Column(Integer, ForeignKey("referral_links.id"), nullable=True, index=True)
    affiliate_id     = Column(Integer, ForeignKey("affiliate_profiles.id"), nullable=False, index=True)
    ip_address       = Column(String(45), nullable=True)
    user_agent       = Column(Text, nullable=True)
    clicked_at       = Column(DateTime, default=datetime.utcnow)

    referral_link = relationship("ReferralLink", back_populates="clicks")
    affiliate     = relationship("AffiliateProfile")


class AffiliateReferral(Base):
    """
    Persistent referral attribution table tracking the full lifecycle:
    CLICKED -> AUTHENTICATED -> PRODUCT_VIEWED -> ADDED_TO_CART -> PURCHASED
    """
    __tablename__ = "affiliate_referrals"

    id               = Column(Integer, primary_key=True, index=True)
    affiliate_id     = Column(Integer, ForeignKey("affiliate_profiles.id"), nullable=False, index=True)
    referral_code    = Column(String(50), nullable=False, index=True)
    product_id       = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    customer_id      = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    session_id       = Column(String(100), unique=True, nullable=False, index=True)
    order_id         = Column(Integer, ForeignKey("orders.id"), nullable=True, index=True)
    status           = Column(String(30), default="CLICKED", index=True) # CLICKED | AUTHENTICATED | PRODUCT_VIEWED | ADDED_TO_CART | PURCHASED
    ip_address       = Column(String(45), nullable=True)
    user_agent       = Column(Text, nullable=True)
    clicked_at       = Column(DateTime, default=datetime.utcnow)
    authenticated_at = Column(DateTime, nullable=True)
    converted_at     = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    affiliate = relationship("AffiliateProfile")
    product   = relationship("Product")
    customer  = relationship("User", foreign_keys=[customer_id])
    order     = relationship("Order", foreign_keys=[order_id])

