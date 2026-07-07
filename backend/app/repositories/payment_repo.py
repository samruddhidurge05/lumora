from typing import List, Optional
from app.models.payment import Payment
from app.repositories.base import BaseRepository

class PaymentRepository(BaseRepository[Payment]):
    def __init__(self, db):
        super().__init__(Payment, db)

    def get_by_order_id(self, order_id: int) -> List[Payment]:
        return self.db.query(Payment).filter(Payment.order_id == order_id).all()

    def get_by_gateway_ref(self, gateway_ref: str) -> Optional[Payment]:
        return self.db.query(Payment).filter(Payment.gateway_ref == gateway_ref).first()
