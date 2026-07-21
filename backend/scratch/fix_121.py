"""
Fix product 121 - The Wedding Planning Toolkit
Prompt admin to enter the real features, or populate from context.
Since the admin entered features but they weren't saved due to the bug,
we need to know what was entered. For now, set appropriate features
based on the product name. Admin can edit and update to their exact text.
"""
import sys, os
_B = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _B)
_e = os.path.join(_B, ".env")
if os.path.exists(_e):
    with open(_e) as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())

from app.db.session import SessionLocal
from app.models.product import Product
from admin.firestore.admin_firestore import sync_product_to_firestore

# Show current state and ask user what features to set
session = SessionLocal()
try:
    p = session.query(Product).filter(Product.id == 121).first()
    if not p:
        print("Product 121 not found.")
        sys.exit(1)
    
    print(f"Product 121: {p.title}")
    print(f"Current features: {p.features}")
    print(f"Current description: {p.description}")
    print()
    
    # Since we cannot ask interactively, check if there's anything in description
    # that hints at what features were intended
    # The admin will need to re-edit and save to update with their exact features
    # For now, mark the features clearly as placeholder to prompt re-edit
    
    # DO NOT add fake features - leave as [] so admin can re-enter via Edit
    print("Product 121 has empty features in SQLite.")
    print("The bug fix is now in place - re-saving this product via the admin Edit modal")
    print("will correctly capture whatever features you type.")
    print()
    print("To fix: Go to Admin ? Products ? Edit 'The Wedding Planning Toolkit'")
    print("        Add your features in the Key Features section ? Save")
    print()
    print("The form will now auto-capture any text in the feature input box on save.")

finally:
    session.close()
