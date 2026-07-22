"""
Task 2 - Read-Only Storage Audit
=================================
Reads every product from the database (same DATABASE_URL as production).
Checks:
  1. PostgreSQL record exists
  2. storage_path set
  3. file_url type (B2, placeholder, pCloud, local, null)
  4. thumbnail / preview types
  5. Whether file_url is a real B2 URL or a placeholder path
  6. Orphan / missing references

DO NOT MODIFY: This script is 100% read-only. It commits nothing.

Usage:
  cd backend
  python scripts/audit_storage.py

Set AUDIT_CHECK_B2=true to also HEAD-check each B2 URL (slow but thorough).
"""

import os
import sys
import json
import re
from pathlib import Path

project_root = str(Path(__file__).resolve().parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)

try:
    from dotenv import load_dotenv
    env_file = Path(project_root) / ".env"
    if env_file.exists():
        load_dotenv(dotenv_path=str(env_file), override=True)
except ImportError:
    pass

from app.db.database import SessionLocal, engine
from app.models.product import Product

PLACEHOLDER_PATTERNS = [
    r"^/products/product-\d+\.",
    r"^/uploads/vendors/.*/temp/",
    r"fake",
    r"placeholder",
    r"example\.com",
    r"localhost",
    r"127\.0\.0\.1",
]
PCLOUD_PATTERNS = [r"pcloud", r"u\.pcloud\.link", r"publink"]
B2_PATTERNS = [r"backblazeb2\.com", r"^b2://", r"f\d{3}\.backblazeb2\.com"]


def classify_url(url):
    if not url:
        return "NULL"
    ul = url.lower()
    for pat in PLACEHOLDER_PATTERNS:
        if re.search(pat, ul):
            return "PLACEHOLDER"
    for pat in PCLOUD_PATTERNS:
        if re.search(pat, ul):
            return "PCLOUD"
    for pat in B2_PATTERNS:
        if re.search(pat, ul):
            return "B2"
    if url.startswith("/uploads/") or url.startswith("local://"):
        return "LOCAL"
    if url.startswith("http://") or url.startswith("https://"):
        return "EXTERNAL"
    if url.startswith("/"):
        return "PLACEHOLDER"
    return "UNKNOWN"


def check_b2_head(url):
    try:
        import requests
        resp = requests.head(url, timeout=8, allow_redirects=True)
        size = int(resp.headers.get("Content-Length", 0))
        return {
            "reachable": resp.status_code == 200,
            "status_code": resp.status_code,
            "content_type": resp.headers.get("Content-Type", ""),
            "size_bytes": size,
        }
    except Exception as e:
        return {"reachable": False, "status_code": 0, "content_type": "", "size_bytes": 0, "error": str(e)}


def magic_verdict(content_type, url):
    if not content_type:
        return "UNKNOWN"
    ct = content_type.lower()
    ul = url.lower()
    if "application/zip" in ct or "application/x-zip" in ct:
        return "OK (zip)"
    if "application/pdf" in ct:
        return "OK (pdf)"
    if "application/vnd.openxmlformats" in ct:
        return "OK (office)"
    if "image/" in ct:
        return "OK (image)"
    if "application/octet-stream" in ct:
        return "OK (binary)"
    if "text/plain" in ct:
        return "SUSPICIOUS (text/plain)"
    return f"UNKNOWN ({ct})"


def run_audit():
    db = SessionLocal()
    dialect = engine.dialect.name
    print(f"\n{'='*70}")
    print(f"  LUMORA STORAGE AUDIT  (Task 2 - READ-ONLY)")
    print(f"  Database: {dialect.upper()}")
    print(f"{'='*70}\n")

    products = db.query(Product).order_by(Product.id).all()
    total = len(products)
    print(f"  Total products in database: {total}\n")

    if total == 0:
        print("  WARNING: No products found.")
        db.close()
        return

    CHECK_B2 = os.getenv("AUDIT_CHECK_B2", "false").lower() in ("1", "true", "yes")
    if CHECK_B2:
        print("  AUDIT_CHECK_B2=true - will HEAD each B2 URL\n")
    else:
        print("  AUDIT_CHECK_B2 not set - skipping live B2 checks (set AUDIT_CHECK_B2=true to enable)\n")

    counts_file = {}
    counts_thumb = {}
    counts_storage = {"SET": 0, "NULL": 0}
    b2_reachable = 0
    b2_unreachable = 0
    b2_checked = 0

    rows = []
    print(f"  {'ID':<6} {'STATUS':<11} {'TITLE':<33} {'FILE_URL':<14} {'STORAGE':<8} {'THUMB':<14}")
    print(f"  {'-'*6} {'-'*11} {'-'*33} {'-'*14} {'-'*8} {'-'*14}")

    for p in products:
        ftype = classify_url(p.file_url)
        ttype = classify_url(p.thumbnail)
        has_sp = bool(p.storage_path)
        counts_file[ftype] = counts_file.get(ftype, 0) + 1
        counts_thumb[ttype] = counts_thumb.get(ttype, 0) + 1
        counts_storage["SET" if has_sp else "NULL"] += 1

        b2_check = {}
        if CHECK_B2 and ftype == "B2" and p.file_url:
            b2_check = check_b2_head(p.file_url)
            b2_checked += 1
            if b2_check.get("reachable"):
                b2_reachable += 1
            else:
                b2_unreachable += 1

        flags = []
        if ftype == "PLACEHOLDER": flags.append("WARN: PLACEHOLDER file_url")
        if ftype == "PCLOUD":      flags.append("WARN: PCLOUD file_url")
        if ftype == "NULL":        flags.append("WARN: NULL file_url")
        if ftype == "LOCAL":       flags.append("WARN: LOCAL file_url (not B2)")
        if not has_sp and ftype not in ("B2", "EXTERNAL"):
            flags.append("WARN: no storage_path + no B2 file_url")
        if ttype == "PCLOUD":      flags.append("WARN: PCLOUD thumbnail")
        if ttype == "PLACEHOLDER": flags.append("WARN: PLACEHOLDER thumbnail")
        if b2_check and not b2_check.get("reachable"):
            flags.append(f"ERROR: B2 UNREACHABLE (HTTP {b2_check.get('status_code')})")
        if b2_check and b2_check.get("reachable"):
            sz = b2_check.get("size_bytes", 0)
            if sz < 100:
                flags.append(f"ERROR: B2 file too small ({sz} bytes - likely fake/empty)")

        title_s = (p.title or "")[:31]
        sp_label = "SET" if has_sp else "NULL"
        print(f"  {p.id:<6} {(p.status or ''):<11} {title_s:<33} {ftype:<14} {sp_label:<8} {ttype:<14}")
        if p.file_url:
            print(f"         file_url    : {p.file_url[:80]}")
        if p.storage_path:
            print(f"         storage_path: {p.storage_path[:80]}")
        if p.thumbnail:
            print(f"         thumbnail   : {p.thumbnail[:80]}")
        if b2_check:
            sz = b2_check.get("size_bytes", 0)
            ct = b2_check.get("content_type", "")
            verdict = magic_verdict(ct, p.file_url or "")
            print(f"         B2 HEAD     : HTTP {b2_check.get('status_code')} | {sz}B | {ct} | {verdict}")
        for flag in flags:
            prefix = "  [!]" if "ERROR" in flag else "  [w]"
            print(f"         {prefix} {flag}")
        if flags:
            print()

        rows.append({
            "id": p.id, "status": p.status, "title": p.title,
            "file_url": p.file_url, "file_url_type": ftype,
            "storage_path": p.storage_path, "has_storage_path": has_sp,
            "thumbnail": p.thumbnail, "thumb_type": ttype,
            "preview": p.preview, "flags": flags, "b2_check": b2_check,
        })

    print(f"\n{'='*70}")
    print("  SUMMARY")
    print(f"{'='*70}")
    print(f"  Total products  : {total}")
    print(f"\n  file_url breakdown:")
    for k, v in sorted(counts_file.items(), key=lambda x: -x[1]):
        ok = k == "B2"
        icon = "OK" if ok else ("!!" if k in ("PLACEHOLDER","PCLOUD","NULL") else "--")
        print(f"    [{icon}] {k:<14}: {v}")

    print(f"\n  storage_path:")
    for k, v in counts_storage.items():
        icon = "OK" if k == "SET" else "!!"
        print(f"    [{icon}] {k:<14}: {v}")

    print(f"\n  thumbnail breakdown:")
    for k, v in sorted(counts_thumb.items(), key=lambda x: -x[1]):
        ok = k in ("B2", "EXTERNAL")
        icon = "OK" if ok else ("!!" if k in ("PCLOUD","NULL","PLACEHOLDER") else "--")
        print(f"    [{icon}] {k:<14}: {v}")

    if CHECK_B2 and b2_checked > 0:
        print(f"\n  B2 reachability checks ({b2_checked}):")
        print(f"    [OK] Reachable  : {b2_reachable}")
        print(f"    [!!] Unreachable: {b2_unreachable}")

    problems = [r for r in rows if r["flags"]]
    if problems:
        print(f"\n  PRODUCTS NEEDING ATTENTION ({len(problems)}):")
        for r in problems:
            print(f"    ID {r['id']:>4} [{(r['status'] or '?'):<10}] {(r['title'] or '')[:50]}")
            for flag in r["flags"]:
                print(f"             {flag}")
    else:
        print(f"\n  All {total} products passed audit checks.")

    out_path = Path(project_root) / "scripts" / "audit_storage_report.json"
    with open(str(out_path), "w", encoding="utf-8") as f:
        json.dump({"dialect": dialect, "total": total, "products": rows}, f, indent=2, default=str)
    print(f"\n  JSON report: {out_path}")
    db.close()


if __name__ == "__main__":
    run_audit()
