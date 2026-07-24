from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime


class Order(Base):
    __tablename__ = "orders"

    id             = Column(Integer, primary_key=True, index=True)
    user_id        = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    status         = Column(String(30), default="pending")   # pending | paid | cancelled | refunded
    total_amount   = Column(Float, default=0.0)
    currency       = Column(String(10), default="INR")
    promo_code     = Column(String(50), nullable=True)
    discount_amount= Column(Float, default=0.0)
    payment_method = Column(String(30), nullable=True)
    payment_id     = Column(String(120), nullable=True)    # gateway reference
    notes          = Column(Text, nullable=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Permanent Affiliate Attribution Fields
    affiliate_id       = Column(Integer, ForeignKey("affiliate_profiles.id"), nullable=True, index=True)
    referral_link_id   = Column(Integer, ForeignKey("referral_links.id"), nullable=True, index=True)
    referral_code_used = Column(String(50), nullable=True, index=True)
    attribution_source = Column(String(30), default="referral_link", index=True)  # referral_link | coupon_code
    coupon_code_used   = Column(String(50), nullable=True, index=True)

    user  = relationship("User",      back_populates="orders")
    items = relationship("OrderItem", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"

    id          = Column(Integer, primary_key=True, index=True)
    order_id    = Column(Integer, ForeignKey("orders.id"),    nullable=False)
    product_id  = Column(Integer, ForeignKey("products.id"),  nullable=True)
    price_paid  = Column(Float,  nullable=False)
    download_url= Column(String(512), nullable=True)
    downloaded  = Column(Boolean, default=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    order   = relationship("Order",   back_populates="items")
    product = relationship("Product", back_populates="order_items")
