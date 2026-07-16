import firebase_admin
from firebase_admin import credentials, firestore
from app.db.session import SessionLocal
from app.models.product import Product as ProductModel

# Initialize firebase if not initialized
cert_path = "app/shared/firebase/serviceAccountKey.json"
if not firebase_admin._apps:
    cred = credentials.Certificate(cert_path)
    firebase_admin.initialize_app(cred)

db = firestore.client()
db_session = SessionLocal()

print("Running manual restore from Firestore to SQLite...")
docs = db.collection("products").where("status", "==", "published").stream()
count = 0
for doc in docs:
    data = doc.to_dict()
    try:
        prod_id = int(doc.id)
    except ValueError:
        print(f"Skipping non-integer Doc ID: {doc.id}")
        continue
        
    exists = db_session.query(ProductModel).filter(ProductModel.id == prod_id).first()
    if not exists:
        print(f"Restoring product {prod_id}: {data.get('title')}")
        product = ProductModel(
            id=prod_id,
            title=data.get("title", data.get("name", "Product")),
            description=data.get("description", ""),
            category=data.get("category", "General"),
            price=float(data.get("price", 0.0)),
            rating=float(data.get("rating", 5.0)),
            reviews=int(data.get("reviews", 0)),
            downloads=int(data.get("downloads", 0)),
            thumbnail=data.get("thumbnail"),
            preview=data.get("preview"),
            file_url=data.get("file_url", data.get("fileUrl")),
            seller=data.get("creatorName", data.get("seller", "Creator")),
            vendor_id=data.get("vendor_id"),
            featured=bool(data.get("featured", data.get("isFeatured", False))),
            trending=bool(data.get("trending", False)),
            new_arrival=bool(data.get("new_arrival", False)),
            badge=data.get("badge"),
            status=data.get("status", "published"),
            tags=data.get("tags", []),
            highlights=data.get("highlights", []),
            version=data.get("version", "v1.0.0"),
            file_size=data.get("fileSize", "48 MB"),
            last_updated=data.get("last_updated", "Recently"),
            license=data.get("license", "Personal Use"),
            affiliate_enabled=bool(data.get("affiliate_enabled", False)),
            commission_type=data.get("commission_type", "percentage"),
            commission_value=float(data.get("commission_value", 0.0)),
            short_desc=data.get("shortDesc", data.get("short_desc")),
            features=data.get("features", []),
            system_requirements=data.get("systemRequirements", data.get("system_requirements", [])),
            what_you_get=data.get("whatYouGet", data.get("what_you_get", [])),
            installation_guide=data.get("installationGuide", data.get("installation_guide")),
            subcategory=data.get("subcategory"),
            discount=float(data.get("discount", 0.0)),
            preview_images=data.get("previewImages", data.get("preview_images", [])),
            preview_video=data.get("previewVideo", data.get("preview_video")),
            seo_title=data.get("seoTitle", data.get("seo_title")),
            seo_description=data.get("seoDescription", data.get("seo_description")),
            visibility=data.get("visibility", "public"),
            pcloud_download_link=data.get("pcloud_download_link", data.get("pcloudDownloadLink")),
            image_urls=data.get("image_urls", data.get("imageUrls", [])),
        )
        db_session.add(product)
        count += 1
    else:
        # Update existing product links just in case
        print(f"Product {prod_id} already exists in SQLite: {exists.title}")

if count > 0:
    db_session.commit()
    print(f"Successfully restored {count} products to SQLite.")
else:
    print("No products restored.")

db_session.close()
