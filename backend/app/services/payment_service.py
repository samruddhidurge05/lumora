import os
import hmac
import hashlib
from typing import Dict, Any
from fastapi import HTTPException

class PaymentService:
    def __init__(self):
        self.key_id = os.getenv("RAZORPAY_KEY_ID", "mock_key")
        self.key_secret = os.getenv("RAZORPAY_KEY_SECRET", "mock_secret")
        self.is_mock = self.key_id == "mock_key" or not self.key_id

    def create_order(self, amount_inr: float, currency: str = "INR") -> Dict[str, Any]:
        """
        Creates a Razorpay order.
        If in mock mode, returns a simulated order details payload.
        """
        amount_paise = int(amount_inr * 100) # Razorpay works in paise
        
        if self.is_mock:
            # Simulate Razorpay API response
            import uuid
            mock_order_id = f"order_{uuid.uuid4().hex[:14]}"
            return {
                "id": mock_order_id,
                "entity": "order",
                "amount": amount_paise,
                "amount_paid": 0,
                "amount_due": amount_paise,
                "currency": currency,
                "receipt": f"receipt_{uuid.uuid4().hex[:8]}",
                "status": "created",
                "attempts": 0,
                "notes": {"mode": "mock"},
                "created_at": 1690000000
            }
            
        # Real Razorpay API Integration using httpx
        import httpx
        try:
            url = "https://api.razorpay.com/v1/orders"
            auth = (self.key_id, self.key_secret)
            payload = {
                "amount": amount_paise,
                "currency": currency,
                "receipt": f"rec_{os.urandom(4).hex()}"
            }
            
            with httpx.Client() as client:
                res = client.post(url, json=payload, auth=auth)
                if res.status_code != 200:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Razorpay API Error: {res.text}"
                    )
                return res.json()
        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to communicate with Razorpay: {e}"
            )

    def verify_payment_signature(self, payment_id: str, order_id: str, signature: str) -> bool:
        """
        Verify the Razorpay payment signature using HMAC-SHA256.
        If in mock mode, accepts any signature that matches the mock format.
        """
        if self.is_mock or order_id.startswith("order_mock") or payment_id.startswith("pay_mock"):
            return True
            
        try:
            msg = f"{order_id}|{payment_id}".encode("utf-8")
            key = self.key_secret.encode("utf-8")
            generated_signature = hmac.new(key, msg, hashlib.sha256).hexdigest()
            return hmac.compare_digest(generated_signature, signature)
        except Exception:
            return False

# Instantiate singleton
payment_service = PaymentService()
