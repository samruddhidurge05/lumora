from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(120), nullable=False)
    email         = Column(String(255), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    role          = Column(String(20), default="customer")   # customer | vendor | admin
    avatar_url    = Column(String(512), nullable=True)
    is_active     = Column(Boolean, default=True)
    is_verified   = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=datetime.utcnow)
    updated_at    = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    orders           = relationship("Order",          back_populates="user",   cascade="all, delete-orphan")
    reviews          = relationship("Review",         back_populates="user",   cascade="all, delete-orphan")
    wishlist_items   = relationship("WishlistItem",   back_populates="user",   cascade="all, delete-orphan")
    notifications    = relationship("Notification",   back_populates="user",   cascade="all, delete-orphan")
    price_alerts     = relationship("PriceAlert",     back_populates="user",   cascade="all, delete-orphan")
    recently_viewed  = relationship("RecentlyViewed", back_populates="user",   cascade="all, delete-orphan")
    search_history   = relationship("SearchHistory",  back_populates="user",   cascade="all, delete-orphan")
    user_activities  = relationship("UserActivity",   back_populates="user",   cascade="all, delete-orphan")
    conversations_as_buyer  = relationship("Conversation", foreign_keys="Conversation.buyer_id",  back_populates="buyer")
    conversations_as_seller = relationship("Conversation", foreign_keys="Conversation.seller_id", back_populates="seller")
    affiliate_profile       = relationship("AffiliateProfile", uselist=False, back_populates="user", cascade="all, delete-orphan")
