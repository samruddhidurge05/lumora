from sqlalchemy import Column, String, Text, DateTime, Boolean
from app.models.user import Base
from datetime import datetime

from sqlalchemy.orm import Mapped

class Vendor(Base):
    __tablename__ = "vendors"

    id: Mapped[str]         = Column(String(120), primary_key=True, index=True)  # type: ignore[assignment]
    name: Mapped[str]       = Column(String(120), nullable=False)  # type: ignore[assignment]
    avatar: Mapped[str | None] = Column(String(512), nullable=True)  # type: ignore[assignment]
    bio: Mapped[str | None]    = Column(Text, nullable=True)  # type: ignore[assignment]
    banner: Mapped[str | None]  = Column(String(512), nullable=True)  # type: ignore[assignment]
    sales: Mapped[str]      = Column(String(30), default="0")  # type: ignore[assignment]
    rating: Mapped[str]     = Column(String(10), default="5.0 ★")  # type: ignore[assignment]
    status: Mapped[str]     = Column(String(50), default="active")  # type: ignore[assignment]
    
    # Store settings & contact details
    email               = Column(String(255), nullable=True)
    phone               = Column(String(50), nullable=True)
    store_url           = Column(String(255), nullable=True)
    country             = Column(String(100), nullable=True)
    github              = Column(String(255), nullable=True)
    tagline             = Column(String(255), nullable=True)
    instagram           = Column(String(255), nullable=True)
    website             = Column(String(255), nullable=True)
    twitter             = Column(String(255), nullable=True)
    refund_policy       = Column(Text, nullable=True)
    support_email       = Column(String(255), nullable=True)
    response_time       = Column(String(50), default="24 hours")
    announcement        = Column(Text, nullable=True)
    announcement_active = Column(Boolean, default=False)
    vacation_mode       = Column(Boolean, default=False)
    vacation_message    = Column(Text, nullable=True)

    # Payment information - required for onboarding before product creation
    upi_id              = Column(String(255), nullable=True)   # UPI option
    account_holder_name = Column(String(255), nullable=True)   # Bank option
    bank_name           = Column(String(255), nullable=True)
    account_number      = Column(String(100), nullable=True)
    ifsc_code           = Column(String(20),  nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)


# Alias for backward compatibility / schema imports
VendorProfile = Vendor

