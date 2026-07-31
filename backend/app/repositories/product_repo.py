from typing import List, Optional
from sqlalchemy import or_
from app.models.product import Product
from app.repositories.base import BaseRepository

class ProductRepository(BaseRepository[Product]):
    def __init__(self, db):
        super().__init__(Product, db)

    def get_published(self, skip: int = 0, limit: int = 100) -> List[Product]:
        return (
            self.db.query(Product)
            .filter(Product.status.in_(["published", "active", None]))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_platform_products(self, skip: int = 0, limit: int = 100) -> List[Product]:
        from app.models.user import User
        admin_user_ids = [str(u.id) for u in self.db.query(User.id).filter(User.role == "admin").all()]
        platform_filters = [
            Product.owner_type == "PLATFORM",
            Product.is_platform_product == True,
            Product.vendor_id == "lumora-creator",
            Product.vendor_id.is_(None),
            Product.vendor_id == "",
        ]
        if admin_user_ids:
            platform_filters.append(Product.vendor_id.in_(admin_user_ids))

        return (
            self.db.query(Product)
            .filter(or_(*platform_filters))
            .offset(skip)
            .limit(limit)
            .all()
        )

    def get_by_vendor(self, vendor_id: str) -> List[Product]:
        return (
            self.db.query(Product)
            .filter(
                Product.owner_type == "VENDOR",
                Product.is_platform_product == False,
                or_(Product.vendor_id == vendor_id, Product.seller == vendor_id)
            )
            .all()
        )

    def search(self, query_str: str, category: str = None) -> List[Product]:
        q = self.db.query(Product).filter(Product.status.in_(["published", "active", None]))
        if category and category.lower() != "all":
            q = q.filter(Product.category.ilike(category))
        if query_str:
            search_pattern = f"%{query_str}%"
            q = q.filter(
                or_(
                    Product.title.ilike(search_pattern),
                    Product.description.ilike(search_pattern),
                    Product.category.ilike(search_pattern)
                )
            )
        return q.all()
