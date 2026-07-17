import os, json, re
log_path = r"C:\Users\samruddhi\AppData\Local\Temp" # Wait, let's use the real path
log_path = r"C:\Users\samruddhi\.gemini\antigravity-ide\brain\e66f7c07-b6e8-4762-be2a-92a2aa6a8b04\.system_generated\logs\transcript.jsonl"
if os.path.exists(log_path):
    print("Log exists, reading...")
    codes = set()
    urls = set()
    with open(log_path, "r", encoding="utf-8", errors="ignore") as f:
        for line in f:
            try:
                obj = json.loads(line)
                content = str(obj.get("content", ""))
                # Also search tool_calls
                for tc in obj.get("tool_calls", []):
                    content += " " + str(tc)
                # Find all pcloud codes/urls
                found_urls = re.findall(r"https?://[^\s\"\'\<\>\)]+", content)
                for u in found_urls:
                    if "pcloud" in u:
                        urls.add(u)
                        if "code=" in u:
                            codes.add(u.split("code=")[1].split("&")[0].split("#")[0])
            except Exception as e:
                pass
    print("Found", len(urls), "unique pCloud URLs in transcript:")
    for u in sorted(list(urls)):
        print("  ", u)
    print("Found", len(codes), "unique codes in transcript:")
    for c in sorted(list(codes)):
        print("  ", c)
else:
    print("Log does not exist at:", log_path)
