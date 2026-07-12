"""
Contact Form Router
===================
Public endpoint for the contact form.

POST /api/contact/
  - No authentication required
  - Rate-limited to 3 requests per hour per IP
  - Writes to Firestore `reports` collection with category: 'contact_request'
  - Returns 201 on success, 503 on Firestore unavailability
"""
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel
from datetime import datetime, timezone

from app.shared.firebase.connection import db, firebase_connected

router = APIRouter()

# Simple in-memory rate limiter: { ip: [timestamp, ...] }
_rate_cache: dict = {}


class ContactForm(BaseModel):
    name: str
    email: str
    subject: str
    message: str


def _check_rate_limit(ip: str, max_per_hour: int = 3):
    from datetime import timedelta
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(hours=1)
    hits = _rate_cache.get(ip, [])
    hits = [h for h in hits if h > cutoff]
    if len(hits) >= max_per_hour:
        raise HTTPException(status_code=429, detail="Too many requests. Try again later.")
    hits.append(now)
    _rate_cache[ip] = hits


@router.post("/", status_code=201)
async def submit_contact(form: ContactForm, request: Request):
    ip = request.client.host if request.client else "unknown"
    _check_rate_limit(ip)

    if not firebase_connected or db is None:
        raise HTTPException(status_code=503, detail="Service temporarily unavailable. Please try again later.")

    try:
        doc_ref = db.collection("reports").document()
        doc_ref.set({
            "title": form.subject,
            "reporter": form.name,
            "reporterEmail": form.email,
            "description": form.message,
            "category": "contact_request",
            "severity": "low",
            "status": "Pending",
            "assignee": "Unassigned",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "resolvedAt": None,
        })
        return {"id": doc_ref.id, "status": "received"}
    except Exception as e:
        raise HTTPException(status_code=503, detail="Failed to submit contact request. Please try again.")
