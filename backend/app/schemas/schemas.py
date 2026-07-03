from pydantic import BaseModel
from datetime import datetime
from typing import Optional

# Product Schemas
class ProductCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float = 0.0
    thumbnail: Optional[str] = None
    preview: Optional[str] = None
    file_url: Optional[str] = None
    seller: Optional[str] = None
    vendor_id: Optional[str] = None
    featured: bool = False
    trending: bool = False
    new_arrival: bool = False
    badge: Optional[str] = None
    status: str = "published"
    tags: Optional[list] = None
    highlights: Optional[list] = None
    version: Optional[str] = "v1.0.0"
    file_size: Optional[str] = None
    license: Optional[str] = None
    affiliate_enabled: Optional[bool] = False
    commission_type: Optional[str] = "percentage"
    commission_value: Optional[float] = 0.0


class ProductUpdate(BaseModel):
    """Partial update schema — all fields optional so PATCH-style updates work."""
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    price: Optional[float] = None
    thumbnail: Optional[str] = None
    preview: Optional[str] = None
    file_url: Optional[str] = None
    featured: Optional[bool] = None
    trending: Optional[bool] = None
    new_arrival: Optional[bool] = None
    badge: Optional[str] = None
    status: Optional[str] = None
    tags: Optional[list] = None
    highlights: Optional[list] = None
    version: Optional[str] = None
    file_size: Optional[str] = None
    license: Optional[str] = None
    affiliate_enabled: Optional[bool] = None
    commission_type: Optional[str] = None
    commission_value: Optional[float] = None


class ProductResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    price: float = 0.0
    rating: float = 5.0
    reviews: int = 0
    downloads: int = 0
    thumbnail: Optional[str] = None
    preview: Optional[str] = None
    file_url: Optional[str] = None
    seller: Optional[str] = None
    vendor_id: Optional[str] = None
    featured: bool = False
    trending: bool = False
    new_arrival: bool = False
    badge: Optional[str] = None
    status: str = "published"
    tags: Optional[list] = None
    highlights: Optional[list] = None
    version: Optional[str] = None
    file_size: Optional[str] = None
    license: Optional[str] = None
    affiliate_enabled: Optional[bool] = False
    commission_type: Optional[str] = "percentage"
    commission_value: Optional[float] = 0.0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ProductVersion Schemas
class ProductVersionBase(BaseModel):
    product_id: str
    version_number: str
    changelog: Optional[str] = None
    is_major: bool = False
    file_url: Optional[str] = None

class ProductVersionCreate(ProductVersionBase):
    pass

class ProductVersionResponse(ProductVersionBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Conversation Schemas
class ConversationBase(BaseModel):
    buyer_id: int
    seller_id: int

class ConversationCreate(ConversationBase):
    pass

class ConversationResponse(ConversationBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Message Schemas
class MessageBase(BaseModel):
    conversation_id: int
    sender_id: int
    content: str
    attachment_url: Optional[str] = None

class MessageCreate(MessageBase):
    pass

class MessageResponse(MessageBase):
    id: int
    is_read: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# Notification Schemas
class NotificationBase(BaseModel):
    user_id: int
    title: str
    message: str
    category: str = "general"

class NotificationCreate(NotificationBase):
    pass

class NotificationResponse(NotificationBase):
    id: int
    is_read: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# RecentlyViewed Schemas
class RecentlyViewedBase(BaseModel):
    user_id: int
    product_id: str

class RecentlyViewedCreate(RecentlyViewedBase):
    pass

class RecentlyViewedResponse(RecentlyViewedBase):
    id: int
    viewed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# PriceAlert Schemas
class PriceAlertBase(BaseModel):
    user_id: int
    product_id: str
    original_price: float
    target_price: Optional[float] = None
    active: bool = True

class PriceAlertCreate(PriceAlertBase):
    pass

class PriceAlertResponse(PriceAlertBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# SearchHistory Schemas
class SearchHistoryBase(BaseModel):
    user_id: Optional[int] = None
    query: str

class SearchHistoryCreate(SearchHistoryBase):
    pass

class SearchHistoryResponse(SearchHistoryBase):
    id: int
    searched_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# UserActivity Schemas
class UserActivityBase(BaseModel):
    user_id: int
    activity_type: str
    details: Optional[str] = None

class UserActivityCreate(UserActivityBase):
    pass

class UserActivityResponse(UserActivityBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
