import json
import sqlite3
import datetime
from pathlib import Path

root_dir = Path(__file__).resolve().parent.parent
backups_dir = root_dir / "backend" / "backups"

def audit_backups():
    print("=" * 80)
    print("PHASE 2 — BACKUP AUDIT REPORT")
    print("=" * 80)

    if not backups_dir.exists():
        print(f"Backups directory {backups_dir} does not exist.")
        return

    backup_files = list(backups_dir.glob("*"))
    print(f"Total backup files found in {backups_dir}: {len(backup_files)}\n")

    report = {}

    for f in backup_files:
        rel_path = str(f.relative_to(root_dir))
        size_bytes = f.stat().st_size
        mtime = datetime.datetime.fromtimestamp(f.stat().st_mtime, tz=datetime.timezone.utc).isoformat()
        
        print(f"File: {rel_path} | Size: {size_bytes:,} bytes | Modified: {mtime}")
        
        file_info = {
            "file": rel_path,
            "size_bytes": size_bytes,
            "modified_time": mtime,
            "type": "",
            "collections": {},
            "can_restore_production": False,
            "notes": ""
        }

        if f.suffix == ".json":
            file_info["type"] = "JSON Export"
            try:
                content = json.loads(f.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(content, dict):
                    file_info["collections"] = {k: len(v) if isinstance(v, (list, dict)) else 1 for k, v in content.items()}
                    print(f"  -> JSON Keys/Collections: {file_info['collections']}")
                elif isinstance(content, list):
                    file_info["collections"] = {"array_items": len(content)}
                    print(f"  -> JSON Array Length: {len(content)}")
            except Exception as e:
                file_info["notes"] = f"JSON parse error: {e}"

        elif f.suffix == ".db":
            file_info["type"] = "SQLite Database Backup"
            try:
                conn = sqlite3.connect(str(f))
                c = conn.cursor()
                c.execute("SELECT name FROM sqlite_master WHERE type='table';")
                tables = [t[0] for t in c.fetchall()]
                tbl_counts = {}
                for t in tables:
                    try:
                        c.execute(f"SELECT COUNT(*) FROM {t};")
                        tbl_counts[t] = c.fetchone()[0]
                    except Exception:
                        pass
                file_info["collections"] = tbl_counts
                print(f"  -> SQLite Tables & Counts: {tbl_counts}")
                conn.close()
            except Exception as e:
                file_info["notes"] = f"SQLite read error: {e}"

        report[f.name] = file_info
        print("-" * 60)

    # Save backup audit results
    out_json = root_dir / "scratch" / "backup_audit_results.json"
    out_json.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nBackup audit complete. Saved to {out_json}")

if __name__ == "__main__":
    audit_backups()
