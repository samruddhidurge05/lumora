import os
from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel
from typing import Optional
from app.services.payment_service import payment_service

router = APIRouter()

class CreateOrderRequest(BaseModel):
    amount: float  # Amount in INR
    currency: Optional[str] = "INR"

class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str

@router.post("/create-razorpay-order")
def create_razorpay_order(body: CreateOrderRequest):
    """
    Initializes a payment order with Razorpay.
    Returns the Razorpay Order ID.
    """
    if body.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Amount must be greater than zero."
        )
        
    order_data = payment_service.create_order(
        amount_inr=body.amount,
        currency=body.currency
    )
    
    return {
        "order_id": order_data["id"],
        "amount": order_data["amount"],
        "currency": order_data["currency"],
        "razorpay_key_id": os.getenv("RAZORPAY_KEY_ID", "mock_key")
    }

@router.post("/verify-payment")
def verify_payment(body: VerifyPaymentRequest):
    """
    Verifies a Razorpay payment signature.
    """
    is_valid = payment_service.verify_payment_signature(
        payment_id=body.razorpay_payment_id,
        order_id=body.razorpay_order_id,
        signature=body.razorpay_signature
    )
    
    if not is_valid:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Payment signature verification failed."
        )
        
    return {"verified": True, "detail": "Payment verified successfully."}
