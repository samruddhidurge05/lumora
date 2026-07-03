from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey
from app.models.user import Base
from datetime import datetime


class Verification(Base):
    __tablename__ = "verifications"

    id         = Column(Integer, primary_key=True, index=True)
    vendor_id  = Column(String(120), ForeignKey("vendors.id"), nullable=False, unique=True, index=True)
    
    # Document statuses (required | pending | approved)
    pan_status      = Column(String(20), default="required")
    pan_url         = Column(String(512), nullable=True)
    pan_note        = Column(String(255), default="Not yet submitted")
    
    aadhaar_status  = Column(String(20), default="required")
    aadhaar_url     = Column(String(512), nullable=True)
    aadhaar_note    = Column(String(255), default="Not yet submitted")
    
    bank_status     = Column(String(20), default="required")
    bank_url        = Column(String(512), nullable=True)
    bank_note       = Column(String(255), default="Not yet submitted")
    
    gst_status      = Column(String(20), default="required")
    gst_url         = Column(String(512), nullable=True)
    gst_note        = Column(String(255), default="Not yet submitted")
    
    address_status  = Column(String(20), default="required")
    address_url     = Column(String(512), nullable=True)
    address_note    = Column(String(255), default="Not yet submitted")
    
    # Verification checklist status (done | pending | required)
    email_status    = Column(String(20), default="done")
    profile_status  = Column(String(20), default="done")
    progress_pct    = Column(Integer, default=33)  # default start pct with email and profile done
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
