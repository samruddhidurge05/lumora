import urllib.request, json

codes = {
    "kZ3a9r5ZiEfxzD6Rwz8si43xOwwD9yI0eeX0": "Ultimate Resume Template Pack",
    "kZ3i9r5Z6kgVesSWw7bi5HqqBxGgyz4FQA2y": "2026 Digital Planner",
    "kZca9r5ZhCrIFBq83B0uxvVsiqpOvfJDXr2V": "Instagram Content Calendar",
    "kZPVPr5Zg0tysBTLgI8yBd8xRGM36BNU9eKyu": "UI Design Icon Pack and Guide (with u)",
    "kZPVPr5Zg0tysBTLgI8yBd8xRGM36BNU9eKy": "UI Design Icon Pack and Guide (no u)",
    "kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk": "Personal Budget Planner",
    "kZoPwr5ZRdFKL7YNck47nNsNDEpYehi88GXys": "Study Planner",
    "kZ4Kwr5ZQEFmzSNMS8Xf5tUnnFV2Ij2UOC0y": "Freelancer Toolkit",
    "kZTdwr5ZWEtX8oeWiBzM5xbAgNzU4VDTNcK7": "Habit Tracker"
}

for code, name in codes.items():
    url = f"https://api.pcloud.com/showpublink?code={code}"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode())
        if data.get("result") == 0:
            meta = data.get("metadata", {})
            print(f"Code: {code} ({name})")
            print(f"  Folder Name: {meta.get('name')}")
            for f in meta.get("contents", []):
                print(f"    - {f['name']} (fileid: {f['fileid']}, size: {f['size']}, isfolder: {f.get('isfolder')})")
        else:
            print(f"Code: {code} ({name}) | API Error: {data.get('error')} (Result: {data.get('result')})")
    except Exception as e:
        print(f"Code: {code} ({name}) | Request Error: {e}")
    print("-" * 50)
