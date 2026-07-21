from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.models.user import Base

class Conversation(Base):
    __tablename__ = "conversations"

    id        = Column(Integer, primary_key=True, index=True)
    buyer_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    seller_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # P3-M5: Support schema migration - new columns
    type        = Column(String(50),  nullable=False, default="vendor_chat", server_default="vendor_chat")
    status      = Column(String(50),  nullable=False, default="open",        server_default="open")
    category    = Column(String(100), nullable=True)
    title       = Column(String(255), nullable=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    resolved_at = Column(DateTime(timezone=True), nullable=True)

    # Back-references required by User.conversations_as_buyer/conversations_as_seller
    buyer    = relationship("User", foreign_keys=[buyer_id],    back_populates="conversations_as_buyer")
    seller   = relationship("User", foreign_keys=[seller_id],   back_populates="conversations_as_seller")
    assignee = relationship("User", foreign_keys=[assigned_to])
