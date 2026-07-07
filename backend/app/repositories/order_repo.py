from typing import List, Optional
from app.models.order import Order, OrderItem
from app.repositories.base import BaseRepository

class OrderRepository(BaseRepository[Order]):
    def __init__(self, db):
        super().__init__(Order, db)

    def get_by_user(self, user_id: int) -> List[Order]:
        return (
            self.db.query(Order)
            .filter(Order.user_id == user_id)
            .order_by(Order.created_at.desc())
            .all()
        )

    def get_all_by_ids(self, order_ids: List[int]) -> List[Order]:
        return (
            self.db.query(Order)
            .filter(Order.id.in_(order_ids))
            .order_by(Order.created_at.desc())
            .all()
        )


class OrderItemRepository(BaseRepository[OrderItem]):
    def __init__(self, db):
        super().__init__(OrderItem, db)

    def get_by_order(self, order_id: int) -> List[OrderItem]:
        return self.db.query(OrderItem).filter(OrderItem.order_id == order_id).all()

    def get_by_product_ids(self, product_ids: List[int]) -> List[OrderItem]:
        return self.db.query(OrderItem).filter(OrderItem.product_id.in_(product_ids)).all()

    def check_user_ownership(self, user_id: int, product_id: int) -> bool:
        """
        Check if the user has a completed order containing this product.
        """
        item = (
            self.db.query(OrderItem)
            .join(Order, OrderItem.order_id == Order.id)
            .filter(Order.user_id == user_id)
            .filter(OrderItem.product_id == product_id)
            .filter(Order.status == "completed")
            .first()
        )
        return item is not None
