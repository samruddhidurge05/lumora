import os
import re

search_dirs = [
    r"c:\Users\samruddhi\lumora final\lumora\backend\app",
    r"c:\Users\samruddhi\lumora final\lumora\backend\admin",
    r"c:\Users\samruddhi\lumora final\lumora\frontend\src",
    r"c:\Users\samruddhi\lumora final\lumora\admin-app\src"
]

results = []

for sdir in search_dirs:
    if not os.path.exists(sdir):
        continue
    for root, dirs, files in os.walk(sdir):
        for file in files:
            if not file.endswith((".py", ".js", ".jsx", ".ts", ".tsx")):
                continue
            path = os.path.join(root, file)
            try:
                with open(path, "r", encoding="utf-8", errors="ignore") as f:
                    lines = f.readlines()
                for idx, line in enumerate(lines):
                    if re.search(r"pcloud", line, re.IGNORECASE):
                        rel_path = os.path.relpath(path, r"c:\Users\samruddhi\lumora final\lumora")
                        results.append({
                            "dir": os.path.basename(sdir),
                            "file": rel_path.replace("\\", "/"),
                            "line": idx + 1,
                            "content": line.strip()
                        })
            except Exception as e:
                print(f"Error reading {path}: {e}")

output_path = r"c:\Users\samruddhi\lumora final\lumora\backend\scratch\pcloud_audit_raw.txt"
with open(output_path, "w", encoding="utf-8") as out:
    out.write("| Location | File | Line | pCloud Reference | Purpose |\n")
    out.write("| --- | --- | --- | --- | --- |\n")
    for res in results:
        content = res["content"]
        purpose = "Unknown"
        if "pcloud_download_link" in content or "pcloudDownloadLink" in content:
            purpose = "pCloud download link metadata/reference field"
        elif "redirect" in content:
            purpose = "Customer download redirection to pCloud"
        elif "sync" in content or "firestore" in content:
            purpose = "Firestore synchronization mapping for pCloud"
        elif "refresh" in content or "p-lux" in content or "publink" in content:
            purpose = "pCloud direct image URL / folder link fetching"
        elif "model" in content or "Column" in content:
            purpose = "Database schema column definition"
        elif "Schema" in content or "BaseModel" in content:
            purpose = "API Schema validation definition"
        elif "pin" in content or "Home.jsx" in res["file"]:
            purpose = "Sorting/pinning pCloud products on Home screen"
        
        content_esc = content.replace("|", "\\|")
        out.write(f"| {res['dir']} | {res['file']} | {res['line']} | `{content_esc}` | {purpose} |\n")

print("Audit completed successfully.")
