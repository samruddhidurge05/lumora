from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime


class WishlistItem(Base):
    __tablename__ = "wishlists"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"),    nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    added_at   = Column(DateTime, default=datetime.utcnow)

    user    = relationship("User",    back_populates="wishlist_items")
    product = relationship("Product", back_populates="wishlist_items")


class CartItem(Base):
    __tablename__ = "cart_items"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"),    nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    added_at   = Column(DateTime, default=datetime.utcnow)

    user    = relationship("User",    foreign_keys=[user_id])
    product = relationship("Product", foreign_keys=[product_id])
