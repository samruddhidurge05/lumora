import urllib.parse as urlparse
import requests

def resolve_pcloud_direct_file_url(publink_url: str, filename_pattern: str = None) -> str:
    if not publink_url or "pcloud" not in publink_url:
        return publink_url
    try:
        parsed = urlparse.urlparse(publink_url)
        params = urlparse.parse_qs(parsed.query)
        code = params.get("code")
        if not code:
            return publink_url
        code_str = code[0]
        
        # 1. Get folder contents
        res = requests.get(f"https://api.pcloud.com/showpublink?code={code_str}", timeout=3)
        data = res.json()
        if data.get("result") == 0 and "metadata" in data:
            metadata = data["metadata"]
            if metadata.get("isfolder"):
                contents = metadata.get("contents", [])
                target_file = None
                
                if filename_pattern:
                    for f in contents:
                        if filename_pattern.lower() in f.get("name", "").lower():
                            target_file = f
                            break
                else:
                    # Look for pdf or zip
                    for f in contents:
                        name = f.get("name", "").lower()
                        if name.endswith(".pdf") or name.endswith(".zip"):
                            target_file = f
                            break
                            
                if target_file:
                    fileid = target_file.get("fileid")
                    # 2. Get direct download link for this file
                    dl_res = requests.get(f"https://api.pcloud.com/getpublinkdownload?code={code_str}&fileid={fileid}", timeout=3)
                    dl_data = dl_res.json()
                    if dl_data.get("result") == 0 and dl_data.get("hosts") and dl_data.get("path"):
                        host = dl_data["hosts"][0]
                        path = dl_data["path"]
                        return f"https://{host}{path}"
    except Exception as e:
        print(f"[Resolve-Error]: {e}")
    return publink_url

# Test links
links = [
    "https://u.pcloud.link/publink/show?code=kZ3a9r5ZiEfxzD6Rwz8si43xOwwD9yI0eeX0",
    "https://u.pcloud.link/publink/show?code=kZ3i9r5Z6kgVesSWw7bi5HqqBxGgyz4FQA2y",
    "https://u.pcloud.link/publink/show?code=kZca9r5ZhCrIFBq83B0uxvVsiqpOvfJDXr2V"
]

for url in links:
    print("--------------------------------")
    print(f"Original: {url}")
    print(f"Direct PDF: {resolve_pcloud_direct_file_url(url)}")
