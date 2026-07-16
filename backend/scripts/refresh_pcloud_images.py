"""
refresh_pcloud_images.py
========================
Run this script whenever pCloud product images disappear.
pCloud direct download URLs (p-lux*.pcloud.com) expire after ~24-48 hours.
This script fetches fresh URLs from the pCloud API using stored share codes.

Usage:
    cd backend
    python scripts/refresh_pcloud_images.py
"""

import sys
import os
import urllib.request
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.product import Product


def extract_share_code(pcloud_url: str):
    """Extract the share code from a pCloud share URL."""
    if not pcloud_url:
        return None
    if "code=" in pcloud_url:
        return pcloud_url.split("code=")[1].split("&")[0].split("#")[0]
    return None


def get_folder_files(share_code: str) -> dict:
    """Fetch list of files in a pCloud shared folder."""
    url = f"https://api.pcloud.com/showpublink?code={share_code}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read().decode())
    if data.get("result") != 0:
        raise RuntimeError(f"pCloud API error: {data}")
    contents = data["metadata"].get("contents", [])
    return {f["name"]: f["fileid"] for f in contents if not f.get("isfolder")}


def get_direct_link(share_code: str, file_id: int):
    """Get a fresh direct download URL for a file in a shared folder."""
    url = f"https://api.pcloud.com/getpublinkdownload?code={share_code}&fileid={file_id}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as r:
        data = json.loads(r.read().decode())
    if data.get("result") == 0:
        hosts = data.get("hosts", [])
        path = data.get("path", "")
        if hosts and path:
            return f"https://{hosts[0]}{path}"
    return None


def refresh_product_images(db, product) -> bool:
    """Refresh image URLs for a single product. Returns True if updated."""
    share_code = extract_share_code(product.pcloud_download_link)
    if not share_code:
        print(f"  Product {product.id} ({product.title}): no pCloud share code, skipping")
        return False

    try:
        files = get_folder_files(share_code)
    except Exception as e:
        print(f"  Product {product.id}: failed to fetch folder files: {e}")
        return False

    image_names = [name for name in files if name.lower().endswith(".png")]
    if not image_names:
        print(f"  Product {product.id}: no PNG files in folder")
        return False

    def pick(names, keyword):
        for n in names:
            if keyword in n.lower():
                return n
        return names[0] if names else None

    thumbnail_name = pick(image_names, "thumbnail") or pick(image_names, "cover")
    cover_name     = pick(image_names, "cover")
    featured_name  = pick(image_names, "featured")
    preview_name   = pick(image_names, "preview")

    new_urls = {}
    for name in set(filter(None, [thumbnail_name, cover_name, featured_name, preview_name])):
        link = get_direct_link(share_code, files[name])
        if link:
            new_urls[name] = link

    if not new_urls:
        print(f"  Product {product.id}: no fresh image URLs retrieved")
        return False

    image_list = []
    for name in [cover_name, featured_name, preview_name, thumbnail_name]:
        if name and name in new_urls and new_urls[name] not in image_list:
            image_list.append(new_urls[name])

    product.thumbnail  = new_urls.get(thumbnail_name) or new_urls.get(cover_name) or image_list[0]
    product.preview    = new_urls.get(preview_name) or new_urls.get(featured_name) or product.thumbnail
    product.image_urls = image_list if image_list else [product.thumbnail]

    db.commit()
    print(f"  OK  Product {product.id} ({product.title}): {len(image_list)} images refreshed")
    return True


def sync_all_to_firestore(db, product_ids):
    try:
        from admin.firestore.admin_firestore import sync_product_to_firestore
        for pid in product_ids:
            p = db.query(Product).filter(Product.id == pid).first()
            if p:
                sync_product_to_firestore(p)
                print(f"  Firestore synced: product {pid}")
    except Exception as e:
        print(f"  Firestore sync skipped: {e}")


def main():
    db = SessionLocal()
    try:
        products = db.query(Product).filter(
            Product.pcloud_download_link.isnot(None)
        ).all()

        print(f"Found {len(products)} products with pCloud links\n")

        refreshed_ids = []
        for product in products:
            print(f"Processing product {product.id}: {product.title}")
            if refresh_product_images(db, product):
                refreshed_ids.append(product.id)

        print(f"\nRefreshed {len(refreshed_ids)} products. Syncing to Firestore...")
        sync_all_to_firestore(db, refreshed_ids)
        print(f"\nDone! {len(refreshed_ids)} products updated.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
