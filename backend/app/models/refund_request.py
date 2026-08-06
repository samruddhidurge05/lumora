from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship, Mapped
from app.models.user import Base
from datetime import datetime
from typing import Optional, Any

class RefundRequest(Base):
    __tablename__ = "refund_requests"

    id: Mapped[int] = Column(Integer, primary_key=True, index=True)  # type: ignore[assignment]
    order_id: Mapped[int] = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)  # type: ignore[assignment]
    user_id: Mapped[int] = Column(Integer, ForeignKey("users.id"),  nullable=False, index=True)  # type: ignore[assignment]
    reason_category: Mapped[str] = Column(String(50), nullable=False)  # type: ignore[assignment]
    details: Mapped[Optional[str]] = Column(Text, nullable=True)  # type: ignore[assignment]
    status: Mapped[str] = Column(String(30), default="PENDING", nullable=False, index=True)  # type: ignore[assignment]
    requested_amount: Mapped[float] = Column(Float, nullable=False)  # type: ignore[assignment]
    currency: Mapped[str] = Column(String(10), default="INR", nullable=False)  # type: ignore[assignment]
    payment_id: Mapped[str] = Column(String(120), nullable=False)  # type: ignore[assignment]
    gateway_refund_id: Mapped[Optional[str]] = Column(String(120), nullable=True)  # type: ignore[assignment]
    admin_notes: Mapped[Optional[str]] = Column(Text, nullable=True)  # type: ignore[assignment]
    created_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, nullable=False)  # type: ignore[assignment]
    updated_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)  # type: ignore[assignment]
    admin_decision_at: Mapped[Optional[datetime]] = Column(DateTime, nullable=True)  # type: ignore[assignment]
    reviewed_by: Mapped[Optional[int]] = Column(Integer, ForeignKey("users.id"), nullable=True)  # type: ignore[assignment]
    decision_reason: Mapped[Optional[str]] = Column(Text, nullable=True)  # type: ignore[assignment]
    last_updated_by: Mapped[Optional[int]] = Column(Integer, ForeignKey("users.id"), nullable=True)  # type: ignore[assignment]
    last_updated_at: Mapped[datetime] = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)  # type: ignore[assignment]

    # Order Snapshot Columns
    product_name: Mapped[str] = Column(String(255), nullable=False)  # type: ignore[assignment]
    order_total: Mapped[float] = Column(Float, nullable=False)  # type: ignore[assignment]
    payment_method: Mapped[str] = Column(String(50), nullable=False)  # type: ignore[assignment]
    purchase_date: Mapped[datetime] = Column(DateTime, nullable=False)  # type: ignore[assignment]

    # Relationships
    order = relationship("Order")
    user  = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    updater  = relationship("User", foreign_keys=[last_updated_by])

    def __init__(self, **kwargs: Any):
        super().__init__(**kwargs)
        # Transient (non-DB) diagnostic fields populated by RefundService._enrich_request
        self.is_downloaded:       bool            = False
        self.download_count:      int             = 0
        self.first_download_at:   Optional[datetime] = None
        self.last_download_at:    Optional[datetime] = None
        self.ip_address:          Optional[str]   = None
        self.device_details:      Optional[str]   = None
        self.previous_refund_count: int           = 0
        self.customer_name:       Optional[str]   = None
        self.customer_email:      Optional[str]   = None


