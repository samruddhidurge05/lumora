import urllib.request, json
url = 'https://api.pcloud.com/showpublink?code=kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req, timeout=10) as r:
        data = json.loads(r.read().decode())
    contents = data['metadata']['contents']
    for f in contents:
        if f['name'] == 'metadata.json':
            dl_url = f"https://api.pcloud.com/getpublinkdownload?code=kZF0Pr5ZWDMyRxFiDDVWNv6kxVWRM0BwlTsk&fileid={f['fileid']}"
            dl_req = urllib.request.Request(dl_url, headers={'User-Agent': 'Mozilla/5.0'})
            with urllib.request.urlopen(dl_req, timeout=10) as dl_r:
                dl_data = json.loads(dl_r.read().decode())
            final_url = f"https://{dl_data['hosts'][0]}{dl_data['path']}"
            with urllib.request.urlopen(final_url, timeout=10) as file_r:
                print(file_r.read().decode())
except Exception as e:
    print('Error:', e)
