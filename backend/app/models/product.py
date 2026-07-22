from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, JSON
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime


class Product(Base):
    __tablename__ = "products"

    id           = Column(Integer, primary_key=True, index=True)
    title        = Column(String(255), nullable=False, index=True)
    description  = Column(Text, nullable=True)
    category     = Column(String(100), nullable=True, index=True)
    price        = Column(Float, default=0.0)
    rating       = Column(Float, default=5.0)
    reviews      = Column(Integer, default=0)
    downloads    = Column(Integer, default=0)
    thumbnail    = Column(String(512), nullable=True)
    preview      = Column(String(512), nullable=True)
    file_url     = Column(String(512), nullable=True)
    seller       = Column(String(120), nullable=True)
    vendor_id    = Column(String(120), nullable=True)
    featured     = Column(Boolean, default=False)
    trending     = Column(Boolean, default=False)
    new_arrival  = Column(Boolean, default=False)
    badge        = Column(String(50), nullable=True)
    status       = Column(String(20), default="published")
    tags         = Column(JSON, default=list)       # stored as JSON array
    highlights   = Column(JSON, default=list)       # stored as JSON array
    version      = Column(String(20), default="v1.0.0")
    file_size    = Column(String(30), default="48 MB")
    last_updated = Column(String(50), default="Recently")
    license      = Column(String(50), nullable=True)  # Personal Use / Commercial Use / Extended License
    
    # Affiliate Settings
    affiliate_enabled        = Column(Boolean, default=False, index=True)
    commission_type          = Column(String(20), default="percentage")  # "percentage" or "fixed"
    commission_mode          = Column(String(20), default="percentage")  # alias for commission_type
    commission_value         = Column(Float, default=0.0)
    affiliate_cookie_days    = Column(Integer, default=30)
    affiliate_visibility     = Column(String(20), default="public")
    affiliate_program_status = Column(String(20), default="active")     # "active", "paused", "draft", "archived"

    # Extended Metadata
    short_desc          = Column(String(255), nullable=True)
    features            = Column(JSON, default=list)
    system_requirements = Column(JSON, default=list)
    what_you_get        = Column(JSON, default=list)
    installation_guide  = Column(Text, nullable=True)
    subcategory         = Column(String(100), nullable=True)
    discount            = Column(Float, default=0.0)
    preview_images      = Column(JSON, default=list)
    preview_video       = Column(String(512), nullable=True)
    seo_title           = Column(String(150), nullable=True)
    seo_description     = Column(Text, nullable=True)
    visibility          = Column(String(50), default="public")

    # -- pCloud / External URL Delivery (TEMPORARY - dev/testing only, ~2-3 weeks) --
    # When migrating to Cloudflare R2, AWS S3, or Firebase Storage, only update
    # these stored URLs. No frontend or schema redesign required.
    pcloud_download_link = Column(String(512), nullable=True)  # pCloud public download link
    image_urls           = Column(JSON, default=list)          # pCloud / external image URL list

    # Storage Metadata
    storage_path   = Column(String(512), nullable=True)
    thumbnail_path = Column(String(512), nullable=True)
    preview_path   = Column(String(512), nullable=True)
    content_type   = Column(String(100), nullable=True)
    hash           = Column(String(128), nullable=True)
    
    created_at   = Column(DateTime, default=datetime.utcnow)
    updated_at   = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    order_items     = relationship("OrderItem",     back_populates="product")
    review_items    = relationship("Review",        back_populates="product", cascade="all, delete-orphan")
    wishlist_items  = relationship("WishlistItem",  back_populates="product", cascade="all, delete-orphan")
    versions        = relationship("ProductVersion", back_populates="product", cascade="all, delete-orphan")
    price_alerts    = relationship("PriceAlert",    back_populates="product", cascade="all, delete-orphan")
    recently_viewed = relationship("RecentlyViewed", back_populates="product", cascade="all, delete-orphan")
