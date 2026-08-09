from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class OrderItemBase(BaseModel):
    product_id: Optional[int] = None
    price_paid: float
    download_url: Optional[str] = None
    downloaded: bool = False
    downloaded_at: Optional[datetime] = None
    download_count: Optional[int] = 0
    download_ip: Optional[str] = None

class OrderItemCreate(OrderItemBase):
    pass

class OrderItemResponse(OrderItemBase):
    id: int
    order_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class OrderBase(BaseModel):
    user_id: int
    total_amount: float
    currency: str = "INR"
    promo_code: Optional[str] = None
    discount_amount: Optional[float] = 0.0
    payment_method: Optional[str] = None
    payment_id: Optional[str] = None
    notes: Optional[str] = None

class OrderCreate(BaseModel):
    items: List[OrderItemCreate]
    total_amount: float
    payment_method: Optional[str] = "upi"
    payment_id: Optional[str] = None
    razorpay_order_id: Optional[str] = None
    razorpay_signature: Optional[str] = None
    promo_code: Optional[str] = None
    discount_amount: float = 0.0
    notes: Optional[str] = None
    affiliate_code: Optional[str] = None

class OrderResponse(OrderBase):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse] = []
    
    # Download audit evidence fields
    downloadGranted: bool = True
    download_count: Optional[int] = 0
    first_downloaded_at: Optional[datetime] = None
    last_downloaded_at: Optional[datetime] = None
    download_ip: Optional[str] = None
    download_device: Optional[str] = None
    download_browser: Optional[str] = None

    class Config:
        from_attributes = True
