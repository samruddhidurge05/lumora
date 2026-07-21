import sys, os
sys.path.append(os.getcwd())

from app.db.database import SessionLocal
from app.models.product import Product as ProductModel
from admin.firestore.admin_firestore import sync_product_to_firestore

db = SessionLocal()

# Delete them if they exist first, to make the restore clean and idempotent
for pid in [115, 116]:
    existing = db.query(ProductModel).filter(ProductModel.id == pid).first()
    if existing:
        db.delete(existing)
db.commit()

# Recreate Product 115: UI Design Icon Pack & Guide
p115 = ProductModel(
    id=115,
    title="UI Design Icon Pack & Guide",
    description="A comprehensive UI/UX design asset pack containing premium icons, guides, and best practices for modern web and mobile applications.",
    category="Graphics & UI",
    price=2.0,
    rating=5.0,
    reviews=0,
    downloads=0,
    thumbnail="https://u.pcloud.link/publink/show?code=XZfh1r5ZL2f9tKMAGnJqq8AV4BR1MhSmJRp7",
    preview="https://u.pcloud.link/publink/show?code=XZfh1r5ZL2f9tKMAGnJqq8AV4BR1MhSmJRp7",
    file_url="https://u.pcloud.link/publink/show?code=kZPVPr5Zg0tysBTLgI8yBd8xRGM36BNU9eKy",
    pcloud_download_link="https://u.pcloud.link/publink/show?code=kZPVPr5Zg0tysBTLgI8yBd8xRGM36BNU9eKy",
    image_urls=[
        "https://u.pcloud.link/publink/show?code=XZfh1r5ZL2f9tKMAGnJqq8AV4BR1MhSmJRp7",
        "https://u.pcloud.link/publink/show?code=XZj7gr5ZWFHGQ9zjOhHLCpE1yrqnxbdmo257"
    ],
    seller="durgemaitri",
    vendor_id="5",
    status="published",
    version="v1.0.0",
    file_size="48 MB",
    last_updated="Recently",
    license="Personal Use",
    features=["Premium UI Components", "Vector Format", "Lifetime Updates"],
    tags=["icon", "guide", "ui", "ux", "vector"]
)

# Recreate Product 116: The Personal Budget Planner
p116 = ProductModel(
    id=116,
    title="The Personal Budget Planner",
    description="Track income, expenses, savings, debt, and investments in one clear system - plus a monthly report to keep you on track.",
    category="Templates",
    price=2.0,
    rating=5.0,
    reviews=0,
    downloads=0,
    thumbnail="https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=800&q=80",
    preview="https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=800&q=80",
    file_url="https://u.pcloud.link/publink/show?code=kZPVPr5Zg0tysBTLgI8yBd8xRGM36BNU9eKy",
    pcloud_download_link="https://u.pcloud.link/publink/show?code=kZPVPr5Zg0tysBTLgI8yBd8xRGM36BNU9eKy",
    image_urls=[
        "https://images.unsplash.com/photo-1554415707-6e8cfc93fe23?auto=format&fit=crop&w=800&q=80"
    ],
    seller="durgemaitri",
    vendor_id="5",
    status="published",
    version="v1.0.0",
    file_size="15 MB",
    last_updated="Recently",
    license="Personal Use",
    features=["Income Tracking", "Expense Analysis", "Debt Snowball Planner", "Visual Dashboard"],
    tags=["budget", "finance", "planner", "sheets", "template"]
)

db.add(p115)
db.add(p116)
db.commit()
print("Products 115 and 116 added successfully to SQLite!")

# Sync to Firestore
sync_product_to_firestore(p115)
sync_product_to_firestore(p116)
print("Products 115 and 116 synced to Firestore!")

db.close()
