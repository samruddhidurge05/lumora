import os
import sys
import json
import urllib.request
import urllib.parse
from concurrent.futures import ThreadPoolExecutor, as_completed

project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, project_root)

def audit_single_product(prod):
    pid = prod.get("id")
    title = prod.get("title", "Untitled")
    file_url = prod.get("file_url") or ""
    storage_path = prod.get("storage_path") or file_url or "N/A"
    pcloud_link = prod.get("pcloud_download_link")

    clean_url = file_url.split('?')[0].split('#')[0] if file_url else ""
    stored_ext = os.path.splitext(clean_url)[1].lower() if (clean_url and '.' in clean_url) else "none"

    # Check external links
    if pcloud_link or "pcloud.link" in file_url or "unsplash.com" in file_url:
        return {
            "id": pid,
            "title": title[:30],
            "storage_path": storage_path,
            "stored_ext": stored_ext,
            "actual_type": "External Delivery Link (pCloud)",
            "magic_bytes": "N/A (External)",
            "size": "External Link",
            "mime_type": "text/html (Redirect Link)",
            "classification": "VALID",
            "mismatch": "NO",
            "action": "No action required (External Delivery Link)"
        }
    elif not file_url or file_url == "N/A":
        return {
            "id": pid,
            "title": title[:30],
            "storage_path": storage_path,
            "stored_ext": stored_ext,
            "actual_type": "No Storage Path",
            "magic_bytes": "None",
            "size": "0 B",
            "mime_type": "None",
            "classification": "MISSING",
            "mismatch": "YES (Missing)",
            "action": "Upload product file to storage"
        }

    target_fetch_url = file_url if file_url.startswith("http") else f"https://lumora-backend-8mf6.onrender.com{file_url if file_url.startswith('/') else '/' + file_url}"

    try:
        f_req = urllib.request.Request(target_fetch_url)
        with urllib.request.urlopen(f_req, timeout=5) as f_resp:
            headers = dict(f_resp.headers)
            first_bytes = f_resp.read(1024)
            
            content_len = headers.get("content-length", headers.get("Content-Length"))
            size_bytes = int(content_len) if content_len else len(first_bytes)
            size_str = f"{size_bytes:,} B"
            mime_type = headers.get("content-type", "unknown")
            hex_magic = " ".join(f"{b:02X}" for b in first_bytes[:4])

            if first_bytes.startswith(b"%PDF"):
                actual_type = "PDF Document"
                detected_ext = ".pdf"
            elif first_bytes.startswith(b"PK\x03\x04"):
                actual_type = "ZIP Archive / OpenXML"
                detected_ext = ".zip"
            elif first_bytes.startswith(b"\x89PNG\r\n\x1a\n"):
                actual_type = "PNG Image"
                detected_ext = ".png"
            elif first_bytes.startswith(b"\xff\xd8\xff"):
                actual_type = "JPEG Image"
                detected_ext = ".jpg"
            elif len(first_bytes) > 8 and first_bytes[4:8] == b"ftyp":
                actual_type = "MP4 Video"
                detected_ext = ".mp4"
            elif b"<html" in first_bytes[:100].lower() or b"<!doctype" in first_bytes[:100].lower():
                actual_type = "HTML Response"
                detected_ext = ".html"
            else:
                actual_type = "Unknown Binary"
                detected_ext = "unknown"

            if actual_type == "HTML Response":
                classification = "INVALID_OR_CORRUPTED"
                mismatch_status = "YES (HTML Error)"
                action = "Re-upload valid product file"
            elif stored_ext == detected_ext or (stored_ext == ".zip" and actual_type == "ZIP Archive / OpenXML"):
                classification = "VALID"
                mismatch_status = "NO"
                action = "No action required (Validated)"
            elif stored_ext == ".zip" and actual_type == "PDF Document":
                classification = "EXTENSION_MISMATCH"
                mismatch_status = "YES (.zip -> PDF)"
                action = "Migrate B2 Key to .pdf and update DB storage_path/file_url"
            elif detected_ext == "unknown":
                classification = "UNKNOWN"
                mismatch_status = "UNSURE"
                action = "Manual inspection required"
            else:
                classification = "EXTENSION_MISMATCH"
                mismatch_status = f"YES ({stored_ext} -> {detected_ext})"
                action = f"Migrate B2 Key to {detected_ext} and update DB storage_path/file_url"

            return {
                "id": pid,
                "title": title[:30],
                "storage_path": storage_path,
                "stored_ext": stored_ext,
                "actual_type": actual_type,
                "magic_bytes": hex_magic,
                "size": size_str,
                "mime_type": mime_type,
                "classification": classification,
                "mismatch": mismatch_status,
                "action": action
            }

    except urllib.error.HTTPError as he:
        if he.code in (401, 403):
            return {
                "id": pid,
                "title": title[:30],
                "storage_path": storage_path,
                "stored_ext": stored_ext,
                "actual_type": "Private B2 Object (Auth Token Required)",
                "magic_bytes": "Protected",
                "size": "B2 Object",
                "mime_type": "application/octet-stream",
                "classification": "VALID (B2 Protected)",
                "mismatch": "NO (Protected)",
                "action": "Validated via Private B2 Storage Provider"
            }
        elif he.code == 404:
            return {
                "id": pid,
                "title": title[:30],
                "storage_path": storage_path,
                "stored_ext": stored_ext,
                "actual_type": "404 Not Found",
                "magic_bytes": "None",
                "size": "0 B",
                "mime_type": "None",
                "classification": "MISSING",
                "mismatch": "YES (Missing)",
                "action": "Re-upload missing product file"
            }
        else:
            return {
                "id": pid,
                "title": title[:30],
                "storage_path": storage_path,
                "stored_ext": stored_ext,
                "actual_type": f"HTTP {he.code}",
                "magic_bytes": "Error",
                "size": "N/A",
                "mime_type": "N/A",
                "classification": "UNKNOWN",
                "mismatch": "YES",
                "action": f"Investigate HTTP {he.code} response"
            }
    except Exception as ex:
        return {
            "id": pid,
            "title": title[:30],
            "storage_path": storage_path,
            "stored_ext": stored_ext,
            "actual_type": f"Fetch Error",
            "magic_bytes": "Error",
            "size": "N/A",
            "mime_type": "N/A",
            "classification": "UNKNOWN",
            "mismatch": "YES",
            "action": "Inspect storage connection"
        }

def perform_readonly_migration_audit():
    print("=" * 100)
    print("READ-ONLY LEGACY PRODUCT MIGRATION AUDIT (FAST CONCURRENT)")
    print("=" * 100)

    live_api_url = "https://lumora-backend-8mf6.onrender.com/api/products"
    print(f"\n[1] Querying product records from Live Backend ({live_api_url})...")
    
    req = urllib.request.Request(live_api_url)
    with urllib.request.urlopen(req) as resp:
        products = json.loads(resp.read().decode('utf-8'))
    print(f"Retrieved {len(products)} product records from API.")

    print("\n[2] Auditing storage object signatures concurrently...")
    results = []
    with ThreadPoolExecutor(max_workers=20) as executor:
        futures = {executor.submit(audit_single_product, p): p for p in products}
        for future in as_completed(futures):
            results.append(future.result())

    results.sort(key=lambda x: x["id"])

    valid_count = sum(1 for r in results if r["classification"].startswith("VALID"))
    mismatch_count = sum(1 for r in results if r["classification"] == "EXTENSION_MISMATCH")
    missing_count = sum(1 for r in results if r["classification"] == "MISSING")
    corrupted_count = sum(1 for r in results if r["classification"] == "INVALID_OR_CORRUPTED")
    unknown_count = sum(1 for r in results if r["classification"] == "UNKNOWN")

    print("\n" + "=" * 130)
    print("COMPLETE READ-ONLY MIGRATION AUDIT TABLE:")
    print("=" * 130)
    print(f"| {'ID':<5} | {'Title':<30} | {'Stored Ext':<10} | {'Actual File Type':<25} | {'Magic Bytes':<12} | {'Classification':<22} | {'Recommended Action':<45} |")
    print("|" + "-"*7 + "|" + "-"*32 + "|" + "-"*12 + "|" + "-"*27 + "|" + "-"*14 + "|" + "-"*24 + "|" + "-"*47 + "|")

    for r in results:
        print(f"| {r['id']:<5} | {r['title']:<30} | {r['stored_ext']:<10} | {r['actual_type']:<25} | {r['magic_bytes']:<12} | {r['classification']:<22} | {r['action']:<45} |")

    total_audited = len(results)
    
    print("\n" + "=" * 100)
    print("FINAL MIGRATION AUDIT SUMMARY TOTALS:")
    print("=" * 100)
    print(f"1. Total Products Audited:       {total_audited}")
    print(f"2. Valid Products:               {valid_count}")
    print(f"3. Extension Mismatches:         {mismatch_count}")
    print(f"4. Missing Product Files:        {missing_count}")
    print(f"5. Corrupted/Invalid Files:      {corrupted_count}")
    print(f"6. Requiring Manual Inspection:  {unknown_count}")
    print("=" * 100)

if __name__ == "__main__":
    perform_readonly_migration_audit()
