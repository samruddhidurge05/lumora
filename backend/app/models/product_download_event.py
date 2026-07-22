from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.models.user import Base
from datetime import datetime

class ProductDownloadEvent(Base):
    __tablename__ = "product_download_events"

    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    order_id      = Column(Integer, ForeignKey("orders.id"), nullable=False, index=True)
    product_id    = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    downloaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    ip_address    = Column(String(64), nullable=True)
    user_agent    = Column(String(512), nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Relationships
    user    = relationship("User")
    order   = relationship("Order")
    product = relationship("Product")
