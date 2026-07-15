import sys
import os

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.product import Product
from admin.firestore.admin_firestore import sync_product_to_firestore

# The three active pCloud links
resume_link = "https://u.pcloud.link/publink/show?code=kZ3a9r5ZiEfxzD6Rwz8si43xOwwD9yI0eeX0"
planner_link = "https://u.pcloud.link/publink/show?code=kZ3i9r5Z6kgVesSWw7bi5HqqBxGgyz4FQA2y"
insta_link = "https://u.pcloud.link/publink/show?code=kZca9r5ZhCrIFBq83B0uxvVsiqpOvfJDXr2V"

db = SessionLocal()
try:
    products = db.query(Product).all()
    print(f"Loaded {len(products)} products from SQLite database.")
    
    updated_count = 0
    for p in products:
        title = p.title.lower() if p.title else ""
        cat = p.category.lower() if p.category else ""
        
        assigned_link = None
        
        # 1. Categorize resume
        if "resume" in title or "resume" in cat or "cv" in title:
            assigned_link = resume_link
            
        # 2. Categorize planner / notion / productivity
        elif "planner" in title or "planner" in cat or "notion" in title or "notion" in cat or "productivity" in title or "productivity" in cat:
            assigned_link = planner_link
            
        # 3. Categorize instagram / social / content / calendar
        elif "instagram" in title or "instagram" in cat or "social" in title or "social" in cat or "calendar" in title or "reels" in title or "content" in title or "content" in cat:
            assigned_link = insta_link
            
        # 4. Fallback for all other products (UI Kits, Website Templates, AI Tools, etc.)
        else:
            # We can alternate or assign resume_link as default
            assigned_link = resume_link
            
        # Update SQLite and sync to Firestore
        if assigned_link:
            p.pcloud_download_link = assigned_link
            sync_product_to_firestore(p)
            updated_count += 1
            
    db.commit()
    print(f"Successfully updated and synced {updated_count} products to SQLite and Firestore!")
except Exception as e:
    db.rollback()
    print(f"Error updating database: {e}")
finally:
    db.close()
