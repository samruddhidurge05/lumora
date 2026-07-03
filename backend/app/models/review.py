from sqlalchemy import Column, Integer, Float, String, Text, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime


class Review(Base):
    __tablename__ = "reviews"

    id         = Column(Integer, primary_key=True, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"),    nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    rating     = Column(Float,   nullable=False)
    comment    = Column(Text,    nullable=True)
    reply      = Column(Text,    nullable=True)
    verified   = Column(Boolean, default=False)   # verified purchase
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user    = relationship("User",    back_populates="reviews")
    product = relationship("Product", back_populates="review_items")
