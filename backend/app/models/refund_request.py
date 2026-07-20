from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime

class RefundRequest(Base):
    __tablename__ = "refund_requests"

    id               = Column(Integer, primary_key=True, index=True)
    order_id         = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    user_id          = Column(Integer, ForeignKey("users.id"),  nullable=False, index=True)
    reason_category  = Column(String(50), nullable=False)
    details          = Column(Text, nullable=True)
    status           = Column(String(30), default="PENDING", nullable=False, index=True)
    requested_amount  = Column(Float, nullable=False)
    currency         = Column(String(10), default="INR", nullable=False)
    payment_id       = Column(String(120), nullable=False)
    gateway_refund_id = Column(String(120), nullable=True)
    admin_notes      = Column(Text, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    admin_decision_at = Column(DateTime, nullable=True)
    reviewed_by      = Column(Integer, ForeignKey("users.id"), nullable=True)
    decision_reason  = Column(Text, nullable=True)
    last_updated_by  = Column(Integer, ForeignKey("users.id"), nullable=True)
    last_updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Order Snapshot Columns
    product_name     = Column(String(255), nullable=False)
    order_total      = Column(Float, nullable=False)
    payment_method   = Column(String(50), nullable=False)
    purchase_date    = Column(DateTime, nullable=False)

    # Relationships
    order = relationship("Order")
    user  = relationship("User", foreign_keys=[user_id])
    reviewer = relationship("User", foreign_keys=[reviewed_by])
    updater  = relationship("User", foreign_keys=[last_updated_by])

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Transient (non-DB) diagnostic fields populated by RefundService._enrich_request
        self.is_downloaded:       bool            = False
        self.download_count:      int             = 0
        self.first_download_at                    = None
        self.last_download_at                     = None
        self.ip_address:          object          = None
        self.device_details:      object          = None
        self.previous_refund_count: int           = 0
