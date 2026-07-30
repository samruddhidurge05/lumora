import urllib.parse
from sqlalchemy import create_engine, or_, func, cast, String
from sqlalchemy.orm import sessionmaker
from app.models.product import Product
from app.models.user import User

db_url = 'postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni'

try:
    engine = create_engine(db_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()
    
    product_id = "196"
    query = db.query(Product).outerjoin(User, Product.vendor_id == cast(User.id, String))
    
    if product_id.isdigit():
        pid = int(product_id)
        query = query.filter(Product.id == pid)
        
    product = query.filter(
        or_(User.id.is_(None), User.is_active.is_(True))
    ).first()
    
    if product:
        print("Product found!", product.id, product.status)
        if (product.status or "published").lower() != "published":
            print("But status is not published!")
    else:
        print("Product NOT FOUND by the query!")
        
    # Let's see what the raw query looks like
    print("\nRaw Query:")
    print(str(query.filter(
        or_(User.id.is_(None), User.is_active.is_(True))
    )))
except Exception as e:
    import traceback
    traceback.print_exc()
