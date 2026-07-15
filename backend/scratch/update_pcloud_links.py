import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.product import Product
from admin.firestore.admin_firestore import sync_product_to_firestore

db = SessionLocal()
try:
    # 1. Update ID 108 and 109 (Resume template packs)
    resume_link = "https://u.pcloud.link/publink/show?code=kZ3a9r5ZiEfxzD6Rwz8si43xOwwD9yI0eeX0"
    for pid in [108, 109]:
        p = db.query(Product).filter(Product.id == pid).first()
        if p:
            p.pcloud_download_link = resume_link
            sync_product_to_firestore(p)
            print(f"Updated product {pid} with resume pack link.")
        else:
            print(f"Product {pid} not found in SQLite.")

    # 2. Update ID 111 (Digital planner)
    planner_link = "https://u.pcloud.link/publink/show?code=kZ3i9r5Z6kgVesSWw7bi5HqqBxGgyz4FQA2y"
    p_111 = db.query(Product).filter(Product.id == 111).first()
    if p_111:
        p_111.pcloud_download_link = planner_link
        sync_product_to_firestore(p_111)
        print("Updated product 111 with digital planner link.")
    else:
        print("Product 111 not found in SQLite.")

    # 3. Update ID 112 (Instagram content planner)
    insta_link = "https://u.pcloud.link/publink/show?code=kZca9r5ZhCrIFBq83B0uxvVsiqpOvfJDXr2V"
    p_112 = db.query(Product).filter(Product.id == 112).first()
    if p_112:
        p_112.pcloud_download_link = insta_link
        sync_product_to_firestore(p_112)
        print("Updated product 112 with instagram content planner link.")
    else:
        print("Product 112 not found in SQLite.")

    db.commit()
    print("Database updates committed successfully!")
except Exception as e:
    db.rollback()
    print("Error updating database:", e)
finally:
    db.close()
