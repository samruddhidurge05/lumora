import urllib.request, json
codes = [
    'XZ27gr5ZwIJP0fFbwLRFHALaQyn6X5CUsWoV',
    'XZ5nwr5Zn8vM92qjKBuUsF5cg2odfS3EBXu7',
    'XZ7pKr5ZiyJeYpTbOLFeckiw15tauYGgOUFX',
    'XZByKr5ZKTYcbFJnFyjpykJ39a8FHJt3e5fX',
    'XZEewr5ZeGYWhTjpcfBRWODmxT6SuShTLqIX',
    'XZGb1r5Zqv4SYsox8nR2GCsHH8zfVBl2bV6X',
    'XZIdwr5ZsuJlWFXplpfl8IUKIy9KK4L8EvvV',
    'XZWVWr5Za3LsVHmbOdj9wi4jvtoGHX2M2hD7',
    'XZYh1r5ZiWOoyWse558xQCtax1zmH8TEhVzX',
    'XZfh1r5ZL2f9tKMAGnJqq8AV4BR1MhSmJRp7',
    'XZgb1r5ZjGzQM6NgEF42g9bK23F3JXualTpX',
    'XZhmtr5ZPTq22WNz2jQWbWOKOozhMb8hlKRX',
    'XZj7gr5ZWFHGQ9zjOhHLCpE1yrqnxbdmo257',
    'XZnh1r5ZAofPXWUuOnhfFBpOrKSXQB5bCCQX',
    'XZnmtr5Zpw62BARezHFs2j5hoOR7c8A03Fp7',
    'XZsmtr5ZYydTiMNnv4Q8t38HkqxexyBYMe1y',
    'XZwewr5ZAqAuVrJNdepHjPwN1aBKtRGsTiWX',
    'XZzh1r5ZCKM6LdmV1Y7TfXVs6bBdkjyANmAX'
]

for c in codes:
    url = 'https://api.pcloud.com/showpublink?code=' + c
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    try:
        with urllib.request.urlopen(req, timeout=5) as r:
            data = json.loads(r.read().decode())
        meta = data.get('metadata', {})
        print(f"Code: {c} | Name: {meta.get('name')} | isfolder: {meta.get('isfolder')}")
    except Exception as e:
        print(f"Code: {c} | Error: {e}")
