import requests, sys
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
r = requests.get('http://localhost:8000/api/products/', timeout=10)
data = r.json()
print(f'API returned {len(data)} products')

resume_products = [p for p in data if 'resume' in p.get('title','').lower() or 'resume' in p.get('category','').lower()]
print(f'Resume products from API: {len(resume_products)}')
for p in resume_products:
    title = p.get('title', '')
    cat = p.get('category', '')
    pid = p.get('id', '')
    print(f'  ID={pid} cat={cat} title={title}')

print()
cats = {}
for p in data:
    c = p.get('category') or 'None'
    cats[c] = cats.get(c, 0) + 1
print('Category breakdown:')
for cat, count in sorted(cats.items()):
    print(f'  {cat}: {count}')
