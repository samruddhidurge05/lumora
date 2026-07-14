import sys, json, requests
sys.stdout.reconfigure(encoding='utf-8', errors='replace')

with open(r'frontend/src/data/products.json', encoding='utf-8', errors='replace') as f:
    json_data = json.load(f)

api_data = requests.get('http://localhost:8000/api/products/', timeout=10).json()

json_ids = {str(p['id']) for p in json_data}
api_ids = {str(p['id']) for p in api_data}

json_only = sorted(json_ids - api_ids, key=lambda x: int(x) if x.isdigit() else x)
api_only = sorted(api_ids - json_ids, key=lambda x: int(x) if x.isdigit() else x)

print('IDs in JSON but NOT in API (mock-only):', json_only)
print('IDs in API but NOT in JSON (new products):', api_only)

print()
print('Resume products in API:')
for p in api_data:
    if 'resume' in p.get('category','').lower():
        pid = p['id']
        vid = p.get('vendor_id')
        cat = p.get('category')
        title = p['title']
        status = p.get('status')
        print('  API id=' + str(pid) + ' vendor=' + str(vid) + ' status=' + str(status) + ' title=' + title)

print()
print('Resume products in JSON:')
for p in json_data:
    if 'resume' in p.get('category','').lower():
        pid = p['id']
        vid = p.get('vendor_id')
        cat = p.get('category')
        title = p['title']
        print('  JSON id=' + str(pid) + ' vendor=' + str(vid) + ' title=' + title)
