from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship
from app.models.user import Base

class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Can be anonymous/null
    query = Column(String, nullable=False)
    searched_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User", back_populates="search_history")
