from sqlalchemy import Column, Integer, BigInteger, String, DateTime, Index
from app.models.user import Base
from datetime import datetime


class StorageMetadata(Base):
    __tablename__ = "storage_metadata"

    id                  = Column(Integer, primary_key=True, index=True)
    storage_path        = Column(String(512), unique=True, nullable=False, index=True)
    etag                = Column(String(128), nullable=True)
    size_bytes          = Column(BigInteger, default=0)
    checksum_sha256     = Column(String(64), nullable=True)
    provider            = Column(String(20), default="b2")
    verification_status = Column(String(20), default="verified")  # "verified", "unverified", "failed"
    verified_at         = Column(DateTime, default=datetime.utcnow)
    version             = Column(Integer, default=1)
    created_at          = Column(DateTime, default=datetime.utcnow)
    updated_at          = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_storage_path_ver", "storage_path", "verification_status"),
    )
