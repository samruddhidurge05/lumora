from typing import cast
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text
from sqlalchemy.orm import declarative_base, relationship, Mapped
from datetime import datetime

Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id: Mapped[int]                     = Column(Integer, primary_key=True, index=True)  # type: ignore[assignment]
    name: Mapped[str]                   = Column(String(120), nullable=False)  # type: ignore[assignment]
    email: Mapped[str]                  = Column(String(255), unique=True, index=True, nullable=False)  # type: ignore[assignment]
    password_hash: Mapped[str]          = Column(String(255), nullable=False)  # type: ignore[assignment]
    phone: Mapped[str | None]           = Column(String(30), nullable=True)  # type: ignore[assignment]
    role: Mapped[str]                   = Column(String(20), default="customer")  # type: ignore[assignment]  # customer | vendor | admin
    avatar_url: Mapped[str | None]      = Column(String(512), nullable=True)  # type: ignore[assignment]
    is_active: Mapped[bool]             = Column(Boolean, default=True)  # type: ignore[assignment]
    is_verified: Mapped[bool]           = Column(Boolean, default=False)  # type: ignore[assignment]
    firebase_uid: Mapped[str | None]    = Column(String(128), unique=True, index=True, nullable=True)  # type: ignore[assignment]
    created_at: Mapped[datetime]        = Column(DateTime, default=datetime.utcnow)  # type: ignore[assignment]
    updated_at: Mapped[datetime]        = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)  # type: ignore[assignment]
    last_login_at: Mapped[datetime | None] = Column(DateTime, nullable=True)  # type: ignore[assignment]

    @property
    def sqlite_user_id(self) -> int:
        return cast(int, self.id)

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
