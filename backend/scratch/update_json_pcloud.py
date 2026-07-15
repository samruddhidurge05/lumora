import json
import os

json_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "src", "data", "products.json"))

resume_link = "https://u.pcloud.link/publink/show?code=kZ3a9r5ZiEfxzD6Rwz8si43xOwwD9yI0eeX0"
planner_link = "https://u.pcloud.link/publink/show?code=kZ3i9r5Z6kgVesSWw7bi5HqqBxGgyz4FQA2y"
insta_link = "https://u.pcloud.link/publink/show?code=kZca9r5ZhCrIFBq83B0uxvVsiqpOvfJDXr2V"

if os.path.exists(json_path):
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)
        
    updated_count = 0
    for p in data:
        title = p.get("title", "").lower()
        cat = p.get("category", "").lower()
        
        assigned_link = None
        
        # 1. Categorize resume
        if "resume" in title or "resume" in cat or "cv" in title:
            assigned_link = resume_link
            
        # 2. Categorize planner / notion / productivity
        elif "planner" in title or "planner" in cat or "notion" in title or "notion" in cat or "productivity" in title or "productivity" in cat:
            assigned_link = planner_link
            
        # 3. Categorize instagram / social / content / calendar
        elif "instagram" in title or "instagram" in cat or "social" in title or "social" in cat or "calendar" in title or "reels" in title or "content" in title or "content" in cat:
            assigned_link = insta_link
            
        # 4. Fallback for all other products (UI Kits, Website Templates, AI Tools, etc.)
        else:
            assigned_link = resume_link
            
        p["pcloud_download_link"] = assigned_link
        p["pcloudDownloadLink"] = assigned_link
        updated_count += 1
        
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully updated {updated_count} products in frontend products.json!")
else:
    print(f"File not found: {json_path}")
