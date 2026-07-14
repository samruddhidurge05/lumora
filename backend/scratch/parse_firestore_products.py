import json

with open("C:/Users/samruddhi/.gemini/antigravity-ide/brain/7fbf4dda-c8d3-4b9c-850d-5f21ce11f0a2/.system_generated/steps/649/output.txt", "r", encoding="utf-8") as f:
    data = json.load(f)

docs = data.get("documents", [])
print(f"Total documents in Firestore: {len(docs)}")

resumes = []
for doc in docs:
    name = doc.get("name", "")
    fields = doc.get("fields", {})
    # Extract ID from document name
    doc_id = name.split("/")[-1]
    title = fields.get("title", {}).get("stringValue", "")
    category = fields.get("category", {}).get("stringValue", "")
    status = fields.get("status", {}).get("stringValue", "")
    
    if "resume" in category.lower() or "resume" in title.lower():
        resumes.append((doc_id, title, category, status))

print(f"\nResume products in Firestore ({len(resumes)}):")
for r in resumes:
    print(f"  ID={r[0]} title={r[1]} category={r[2]} status={r[3]}")
