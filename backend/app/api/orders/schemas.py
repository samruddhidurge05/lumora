from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime

class OrderItemBase(BaseModel):
    product_id: int
    price_paid: float
    download_url: Optional[str] = None
    downloaded: bool = False

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
    discount_amount: float = 0.0
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

    class Config:
        from_attributes = True
