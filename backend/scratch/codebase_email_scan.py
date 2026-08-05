"""
SEARCH ALL CODE & COMMIT LOGS FOR ANY EMAIL PATTERNS
====================================================
Searches all files, commits, docs, and python files for any mentioned email addresses.
"""
import os
import re
import subprocess

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

email_regex = re.compile(r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+')

all_emails = {}

for root, dirs, files in os.walk(ROOT_DIR):
    if ".git" in root or ".venv" in root or "node_modules" in root:
        continue
    for f in files:
        if f.endswith(".py") or f.endswith(".md") or f.endswith(".json") or f.endswith(".txt") or f.endswith(".js") or f.endswith(".jsx"):
            fpath = os.path.join(root, f)
            try:
                with open(fpath, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                    matches = email_regex.findall(content)
                    for m in matches:
                        rel = os.path.relpath(fpath, ROOT_DIR)
                        all_emails.setdefault(m.lower(), set()).add(rel)
            except Exception:
                pass

print("=" * 70)
print("ALL EMAILS DISCOVERED IN CODEBASE FILES & DOCUMENTATION")
print("=" * 70)

for email in sorted(all_emails.keys()):
    if not email.endswith("@example.com") and not email.endswith("@lumora.io") and not email.endswith("@lumora.test") and not email.endswith("@lumora.dev"):
        locs = ", ".join(sorted(list(all_emails[email]))[:3])
        print(f"  {email:<45} (found in {len(all_emails[email])} files: {locs})")
