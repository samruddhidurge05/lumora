from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.models.user import Base

class ProductVersion(Base):
    __tablename__ = "product_versions"

    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(String, ForeignKey("products.id"), nullable=False)
    version_number = Column(String, nullable=False)  # e.g., "v1.1"
    changelog = Column(Text, nullable=True)
    is_major = Column(Boolean, default=False)
    file_url = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Back-reference required by Product.versions (back_populates="product")
    product = relationship("Product", back_populates="versions")
