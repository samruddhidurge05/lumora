import os
import sys
from dotenv import load_dotenv

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

load_dotenv(os.path.join(backend_dir, ".env"))

from app.db.session import SessionLocal
from app.models.product import Product
from app.services.storage_service import storage_service

def verify_b2_stream():
    print("=================================================================")
    print("        VERIFYING BACKBLAZE B2 STREAMING FOR PRODUCT 123         ")
    print("=================================================================")

    db = SessionLocal()
    try:
        p123 = db.query(Product).filter(Product.id == 123).first()
        print(f"[Product 123] storage_path = {p123.storage_path}")
        
        stream = storage_service.get_stream(p123.storage_path)
        first_chunk = next(stream)
        print(f"[Pass] Successfully retrieved stream chunk from Backblaze B2!")
        print(f"       Chunk size: {len(first_chunk)} bytes")
        print(f"       Chunk header bytes: {first_chunk[:10]}")

    finally:
        db.close()

if __name__ == "__main__":
    verify_b2_stream()
