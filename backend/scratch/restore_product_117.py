import sys, os
sys.path.append(os.getcwd())

from app.db.database import SessionLocal
from app.models.product import Product as ProductModel
from admin.firestore.admin_firestore import sync_product_to_firestore

db = SessionLocal()

# Delete if it exists first
existing = db.query(ProductModel).filter(ProductModel.id == 117).first()
if existing:
    db.delete(existing)
db.commit()

# Create Product 117
p117 = ProductModel(
    id=117,
    title="Study Planner & Exam Organizer",
    description="Achieve your academic goals with this comprehensive Study Planner & Exam Organizer. Track assignments, manage exam schedules, log study hours, and plan coursework efficiently.",
    category="Templates",
    price=2.0,
    rating=5.0,
    reviews=0,
    downloads=0,
    thumbnail="https://p-lux1.pcloud.com/D4ZSf37yJ7Z1Y9Q767ZZZpMCN5kZ2ZZQSHZkZdevZbQZTmZQYZoPwr5Za46E96p9Y0bbqSJQgfLIdLhVtqjX/thumbnail.png",
    preview="https://p-lux3.pcloud.com/D4ZQm37yJ7Z4F9Q767ZZZt9CN5kZ2ZZQSHZkZEQPZVFZSmZ3QZoPwr5ZlMddSC8T1Tkk2LUnaV9pK7uAxHxX/preview.png",
    file_url="https://p-lux1.pcloud.com/D4ZdS37yJ7ZGR9Q767ZZZBMCN5kZ2ZZQSHZkZ9utZGQZIQZ2mZoPwr5ZhbGXuyEU86zeShsYNnVqHbRc3I8k/product.pdf",
    pcloud_download_link="https://p-lux1.pcloud.com/D4ZdS37yJ7ZGR9Q767ZZZBMCN5kZ2ZZQSHZkZ9utZGQZIQZ2mZoPwr5ZhbGXuyEU86zeShsYNnVqHbRc3I8k/product.pdf",
    image_urls=[
        "https://p-lux3.pcloud.com/D4ZPp37yJ7ZQEnQ767ZZZUnCN5kZ2ZZQSHZkZyHQ7ZoLZdmZN4ZoPwr5ZG2GfUzCr39jfbD9HBOe86pvQsDhV/cover.png",
        "https://p-lux1.pcloud.com/D4Z4R37yJ7ZwAnQ767ZZZ89CN5kZ2ZZQSHZkZzwDZg4ZMLZF4ZoPwr5ZkadO4j5HrdFzzNI2yU9zL8OlkIRk/featured.png",
        "https://p-lux3.pcloud.com/D4ZQm37yJ7Z4F9Q767ZZZt9CN5kZ2ZZQSHZkZEQPZVFZSmZ3QZoPwr5ZlMddSC8T1Tkk2LUnaV9pK7uAxHxX/preview.png",
        "https://p-lux1.pcloud.com/D4ZSf37yJ7Z1Y9Q767ZZZpMCN5kZ2ZZQSHZkZdevZbQZTmZQYZoPwr5Za46E96p9Y0bbqSJQgfLIdLhVtqjX/thumbnail.png"
    ],
    seller="durgemaitri",
    vendor_id="5",
    status="published",
    version="v1.0.0",
    file_size="24 MB",
    last_updated="Recently",
    license="Personal Use",
    features=["Class Scheduler", "Assignment Tracker", "Exam countdown", "Grade Calculator"],
    tags=["study", "planner", "organizer", "school", "notion"]
)

db.add(p117)
db.commit()
print("Product 117 added successfully to SQLite!")

# Sync to Firestore
sync_product_to_firestore(p117)
print("Product 117 synced to Firestore!")

db.close()
