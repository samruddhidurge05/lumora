import sys
import os
import shutil
import json
import urllib.request
import argparse

# Add backend directory to Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.database import SessionLocal
from app.models.product import Product as ProductModel
from admin.firestore.admin_firestore import sync_product_to_firestore

# Default known folder mappings
DEFAULT_MAPPINGS = [
    {
        "code": "kZ3a9r5ZiEfxzD6Rwz8si43xOwwD9yI0eeX0",
        "hint_ids": [108, 109],  # Resume Template Pack
        "title": "Resume Template Pack"
    },
    {
        "code": "kZ3i9r5Z6kgVesSWw7bi5HqqBxGgyz4FQA2y",
        "hint_ids": [111],       # digital planner
        "title": "digital planner"
    },
    {
        "code": "kZca9r5ZhCrIFBq83B0uxvVsiqpOvfJDXr2V",
        "hint_ids": [112],       # Instagram content calendar
        "title": "Instagram content calendar"
    },
    {
        "code": "kZPVPr5Zg0tysBTLgI8yBd8xRGM36BNU9eKyu",
        "hint_ids": [115],       # UI Design Icon Pack & Guide
        "title": "UI Design Icon Pack & Guide"
    },
    {
        "code": "kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk",
        "hint_ids": [116],       # The Personal Budget Planner
        "title": "The Personal Budget Planner"
    },
    {
        "code": "kZoPwr5ZRdFKL7YNck47nNsNDEpYehi88GXys",
        "hint_ids": [117],       # Study Planner & Exam Organizer
        "title": "Study Planner & Exam Organizer"
    },
    {
        "code": "kZ4Kwr5ZQEFmzSNMS8Xf5tUnnFV2Ij2UOC0y",
        "hint_ids": [118],       # The Freelancer Client Toolkit
        "title": "The Freelancer Client Toolkit"
    },
    {
        "code": "kZTdwr5ZWEtX8oeWiBzM5xbAgNzU4VDTNcK7",
        "hint_ids": [119],       # The Healthy Habit Tracker
        "title": "The Healthy Habit Tracker"
    }
]

def backup_files():
    print("=== Creating Backups ===")
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    
    # Backup SQLite DB
    db_path = os.path.join(backend_dir, "test.db")
    if os.path.exists(db_path):
        db_bak = db_path + ".bak"
        shutil.copy2(db_path, db_bak)
        print(f"Backed up SQLite DB to: {db_bak}")
    else:
        print("SQLite DB not found, skipping DB backup.")
        
    # Backup products.json
    root_dir = os.path.dirname(backend_dir)
    json_path = os.path.join(root_dir, "frontend", "src", "data", "products.json")
    if os.path.exists(json_path):
        json_bak = json_path + ".bak"
        shutil.copy2(json_path, json_bak)
        print(f"Backed up products.json to: {json_bak}")
    else:
        print("products.json not found, skipping JSON backup.")
    print()

def get_pcloud_folder_contents(code):
    url = f"https://api.pcloud.com/showpublink?code={code}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode())
        if data.get("result") != 0:
            print(f"pCloud API error for code {code}: {data.get('error')}")
            return None
        return data.get("metadata", {})
    except Exception as e:
        print(f"Failed to fetch pCloud folder for code {code}: {e}")
        return None

def import_folder(db, code, product_id=None):
    metadata = get_pcloud_folder_contents(code)
    if not metadata:
        return None, "Could not fetch folder metadata from pCloud"
        
    folder_name = metadata.get("name", "")
    contents = metadata.get("contents", [])
    
    # 1. Identify files
    files = {f["name"]: f["fileid"] for f in contents if not f.get("isfolder")}
    if not files:
        return None, f"No files found in folder '{folder_name}'"
        
    # 2. Match to a product
    product = None
    if product_id:
        product = db.query(ProductModel).filter(ProductModel.id == product_id).first()
        if not product:
            return None, f"Product ID {product_id} not found in database"
    else:
        # Match by title or folder name
        all_products = db.query(ProductModel).filter(ProductModel.id >= 104).all()
        # Look for exact or fuzzy matches
        for p in all_products:
            p_title = str(p.title).strip().lower()
            f_name_clean = folder_name.strip().lower().replace("-", " ").replace("_", " ")
            if p_title == f_name_clean or p_title in f_name_clean or f_name_clean in p_title:
                product = p
                break
                
    if not product:
        return None, f"No matching product found in database for folder '{folder_name}'"

    # 3. Categorize PNG images and the main downloadable file
    png_files = [n for n in files if n.lower().endswith(".png")]
    pdf_zip_files = [n for n in files if n.lower().endswith((".pdf", ".zip", ".fig", ".rar"))]
    
    def pick_image(names, keywords):
        for kw in keywords:
            for n in names:
                if kw in n.lower():
                    return n
        return names[0] if names else None

    # Resolve cover, featured, preview, thumbnail
    cover_name = pick_image(png_files, ["cover", "featured", "preview"])
    featured_name = pick_image(png_files, ["featured", "cover", "preview"])
    preview_name = pick_image(png_files, ["preview", "featured", "cover"])
    thumbnail_name = pick_image(png_files, ["thumbnail", "icon", "cover"])

    # Construct permanent URLs
    base_thumb_url = "https://api.pcloud.com/getpubthumb"
    
    img_urls = []
    # Add unique images to the gallery list
    seen_fileids = set()
    for name in [cover_name, featured_name, preview_name, thumbnail_name]:
        if name and name in files:
            fid = files[name]
            if fid not in seen_fileids:
                seen_fileids.add(fid)
                img_urls.append(f"{base_thumb_url}?code={code}&fileid={fid}&size=1024x768")

    thumbnail_url = f"{base_thumb_url}?code={code}&fileid={files[thumbnail_name]}&size=400x300" if thumbnail_name else None
    preview_url = f"{base_thumb_url}?code={code}&fileid={files[preview_name]}&size=1024x768" if preview_name else None

    # Resolve product download link
    # Prefer a zip/pdf file inside the folder, otherwise use the folder link itself
    download_url = f"https://u.pcloud.link/publink/show?code={code}"
    if pdf_zip_files:
        # We can link specifically to the file inside the folder code
        p_file = pdf_zip_files[0]
        download_url = f"https://u.pcloud.link/publink/show?code={code}&fileid={files[p_file]}"

    # Update SQLite fields
    product.pcloud_download_link = f"https://u.pcloud.link/publink/show?code={code}"
    product.file_url = download_url
    if thumbnail_url:
        product.thumbnail = thumbnail_url
    if preview_url:
        product.preview = preview_url
    if img_urls:
        product.image_urls = img_urls
        
    db.commit()
    
    # 4. Sync to Firestore
    try:
        sync_product_to_firestore(product)
        sync_status = "Successfully synced to Firestore"
    except Exception as fs_err:
        sync_status = f"SQLite updated, but Firestore sync failed: {fs_err}"
        
    return {
        "id": product.id,
        "title": product.title,
        "folder_name": folder_name,
        "thumbnail": product.thumbnail,
        "preview": product.preview,
        "image_urls": product.image_urls,
        "download_url": product.file_url,
        "sync_status": sync_status
    }, None

def update_products_json():
    print("=== Updating frontend products.json ===")
    backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    db = SessionLocal()
    try:
        # Load all products from DB
        db_products = db.query(ProductModel).all()
        db_prod_map = {p.id: p for p in db_products}
        
        # Load products.json
        root_dir = os.path.dirname(backend_dir)
        json_path = os.path.join(root_dir, "frontend", "src", "data", "products.json")
        if not os.path.exists(json_path):
            print("products.json not found in frontend!")
            return
            
        with open(json_path, "r", encoding="utf-8") as f:
            json_data = json.load(f)
            
        # Update matching items
        updated_count = 0
        for item in json_data:
            pid = item.get("id")
            if pid in db_prod_map:
                db_p = db_prod_map[pid]
                if db_p.pcloud_download_link:
                    item["thumbnail"] = db_p.thumbnail
                    item["preview"] = db_p.preview
                    item["image_urls"] = db_p.image_urls
                    item["pcloud_download_link"] = db_p.pcloud_download_link
                    item["pcloudDownloadLink"] = db_p.pcloud_download_link
                    item["file_url"] = db_p.file_url
                    item["fileUrl"] = db_p.file_url
                    updated_count += 1
                    
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=2, ensure_ascii=False)
            
        print(f"Successfully updated {updated_count} products in frontend products.json!")
    except Exception as e:
        print(f"Error updating products.json: {e}")
    finally:
        db.close()

def generate_report(results, skipped):
    print("=== Generating Report ===")
    report_path = "pcloud_import_report.md"
    
    report_content = f"# pCloud Product Asset Import Report\n\n"
    report_content += "## Summary of Import Operations\n\n"
    report_content += f"- **Successfully Matched & Updated**: {len(results)}\n"
    report_content += f"- **No Folder Code / Preserved**: {len(skipped)}\n\n"
    
    report_content += "## Updated Products\n\n"
    if results:
        report_content += "| ID | Title | Folder Name | Permanent Images | Download Link | Sync Status |\n"
        report_content += "|---|---|---|---|---|---|\n"
        for r in results:
            img_count = len(r['image_urls'])
            report_content += f"| {r['id']} | {r['title']} | `{r['folder_name']}` | {img_count} images | [Link]({r['download_url']}) | {r['sync_status']} |\n"
    else:
        report_content += "*No products updated.*\n"
        
    report_content += "\n## Preserved Products (No Folder Match)\n\n"
    if skipped:
        report_content += "| ID | Title | Reason |\n"
        report_content += "|---|---|---|\n"
        for s in skipped:
            report_content += f"| {s['id']} | {s['title']} | {s['reason']} |\n"
    else:
        report_content += "*No products skipped.*\n"
        
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_content)
    print(f"Match report written to: {os.path.abspath(report_path)}")
    print()

def main():
    parser = argparse.ArgumentParser(description="Import assets from pCloud shared folders")
    parser.add_argument("--code", type=str, help="pCloud shared folder link or code")
    parser.add_argument("--id", type=int, help="Database product ID to map the code to")
    args = parser.parse_args()
    
    # 1. Create backups first
    backup_files()
    
    db = SessionLocal()
    results = []
    skipped = []
    
    try:
        if args.code:
            # Import a single user-specified folder link/code
            print(f"Processing user-provided code: {args.code} (Product ID hint: {args.id})")
            clean_code = args.code.split("code=")[-1].split("&")[0].split("#")[0]
            res, err = import_folder(db, clean_code, args.id)
            if err:
                print(f"Error: {err}")
                skipped.append({"id": args.id or "N/A", "title": "User Request", "reason": err})
            else:
                results.append(res)
                print(f"Successfully processed product {res['id']}: {res['title']}")
        else:
            # Process default known folder mappings
            print("No code provided. Processing default mappings...")
            for mapping in DEFAULT_MAPPINGS:
                code = mapping["code"]
                pids = mapping["hint_ids"]
                for pid in pids:
                    print(f"Processing product {pid} using code {code}...")
                    res, err = import_folder(db, code, pid)
                    if err:
                        print(f"Error for ID {pid}: {err}")
                        skipped.append({"id": pid, "title": mapping["title"], "reason": err})
                    else:
                        results.append(res)
                        print(f"Successfully matched & updated ID {pid}: {res['title']}")
            
            # List other mock/pcloud products that were not matched to any folders
            all_mock_products = db.query(ProductModel).filter(ProductModel.id >= 108).all()
            matched_ids = {r["id"] for r in results}
            for p in all_mock_products:
                if p.id not in matched_ids:
                    skipped.append({
                        "id": p.id,
                        "title": p.title,
                        "reason": "Preserved existing single-file link (no folder link provided)"
                    })
                    
        # 2. Update frontend json
        update_products_json()
        
        # 3. Generate report
        generate_report(results, skipped)
        
    finally:
        db.close()

if __name__ == "__main__":
    main()
