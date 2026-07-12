from sqlalchemy import Column, String, Text, DateTime, Boolean
from app.models.user import Base
from datetime import datetime

class Vendor(Base):
    __tablename__ = "vendors"

    id         = Column(String(120), primary_key=True, index=True)
    name       = Column(String(120), nullable=False)
    avatar     = Column(String(512), nullable=True)
    bio        = Column(Text, nullable=True)
    banner     = Column(String(512), nullable=True)
    sales      = Column(String(30), default="0")
    rating     = Column(String(10), default="5.0 ★")
    status     = Column(String(50), default="active")
    
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

    # Payment information — required for onboarding before product creation
    upi_id              = Column(String(255), nullable=True)   # UPI option
    account_holder_name = Column(String(255), nullable=True)   # Bank option
    bank_name           = Column(String(255), nullable=True)
    account_number      = Column(String(100), nullable=True)
    ifsc_code           = Column(String(20),  nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow)
