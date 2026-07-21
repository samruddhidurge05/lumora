"""
Customer Report Submission API
================================
Allows authenticated customers to submit product reports and view their own
reports.

Endpoints
---------
POST /api/reports/
    Submit a product report. Requires JWT auth.
    Validates category, description length, and rate-limits to 3 reports per
    user per product per 24 hours.
    Writes to Firestore `reports` collection.
    Returns HTTP 503 if Firebase is unavailable.

GET /api/reports/me
    Returns the list of reports submitted by the current authenticated user.
    Returns HTTP 503 if Firebase is unavailable.

Rate Limiting
-------------
Max 3 reports per user per product per 24 hours.
Exceeding this limit returns HTTP 429.

Firestore document schema (collection: reports)
-----------------------------------------------
{
    "user_id":     str,       # SQLite user.id as string
    "product_id":  str,       # product identifier as string
    "category":    str,       # one of VALID_CATEGORIES
    "description": str,       # user-provided text (10–2000 chars)
    "created_at":  str,       # ISO-8601 UTC timestamp
    "status":      "pending", # always "pending" on creation
    "reporter":    str,       # user display name or email prefix
    "title":       str,       # auto-generated: "Report: <category>"
    "severity":    "medium",  # default severity for admin triage
}
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, field_validator

from app.dependencies import get_current_user_required
from app.models.user import User
from app.shared.firebase.connection import db as firestore_db, firebase_connected

_logger = logging.getLogger("lumora.reports")

router = APIRouter()

# ── Constants ─────────────────────────────────────────────────────────────────

VALID_CATEGORIES: List[str] = [
    "spam",
    "inappropriate",
    "counterfeit",
    "misleading",
    "other",
]

RATE_LIMIT_MAX   = 3          # max reports per user per product per window
RATE_LIMIT_HOURS = 24         # rolling window in hours


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ReportCreateRequest(BaseModel):
    product_id:  str = Field(..., description="Product identifier")
    category:    str = Field(..., description=f"One of: {VALID_CATEGORIES}")
    description: str = Field(..., min_length=10, max_length=2000,
                             description="Describe the issue (10–2000 characters)")

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        if v not in VALID_CATEGORIES:
            raise ValueError(
                f"Invalid category '{v}'. Must be one of: {', '.join(VALID_CATEGORIES)}"
            )
        return v

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str) -> str:
        return v.strip()


class ReportResponse(BaseModel):
    id:          str
    user_id:     str
    product_id:  str
    category:    str
    description: str
    created_at:  str
    status:      str


# ── Helper ────────────────────────────────────────────────────────────────────

def _require_firebase() -> None:
    """Raise HTTP 503 when Firestore is not available."""
    if not firebase_connected or firestore_db is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Report service is temporarily unavailable. Please try again later.",
        )


def _check_rate_limit(user_id: str, product_id: str) -> None:
    """
    Query Firestore to count how many reports this user has submitted for this
    product in the last 24 hours.  Raises HTTP 429 if ≥ RATE_LIMIT_MAX.
    """
    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=RATE_LIMIT_HOURS)
    cutoff_iso = cutoff.isoformat()

    try:
        # Firestore does not support compound inequality queries on different fields,
        # so we filter by user_id + product_id first, then apply the time filter
        # in Python — safe because we expect a small number (< 100) of results.
        docs = (
            firestore_db.collection("reports")
            .where("user_id", "==", user_id)
            .where("product_id", "==", product_id)
            .stream()
        )

        recent_count = 0
        for doc in docs:
            data = doc.to_dict()
            created_raw = data.get("created_at", "")
            if not created_raw:
                continue
            try:
                # Parse ISO-8601 string; handle both with/without timezone
                if created_raw.endswith("Z"):
                    created_raw = created_raw[:-1] + "+00:00"
                created_dt = datetime.fromisoformat(created_raw)
                # Make aware if naive
                if created_dt.tzinfo is None:
                    created_dt = created_dt.replace(tzinfo=timezone.utc)
                if created_dt >= cutoff:
                    recent_count += 1
            except (ValueError, TypeError):
                continue

        if recent_count >= RATE_LIMIT_MAX:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=(
                    f"You have already submitted {RATE_LIMIT_MAX} reports for this product "
                    f"in the last {RATE_LIMIT_HOURS} hours. Please wait before reporting again."
                ),
            )
    except HTTPException:
        raise
    except Exception as exc:
        _logger.warning("[reports] Rate-limit check failed (non-blocking): %s", exc)
        # If we can't check, allow the request through rather than blocking users


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/", status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: ReportCreateRequest,
    current_user: User = Depends(get_current_user_required),
) -> dict:
    """
    Submit a product report.

    - Requires valid JWT (Bearer token) — 401 if missing/invalid.
    - Validates category against allowed list — 400 on bad category.
    - Rate-limited to 3 reports per user per product per 24 h — 429 on excess.
    - Writes to Firestore `reports` collection — 503 if Firebase unavailable.
    - Returns the created report document (201).
    """
    _require_firebase()

    user_id    = str(current_user.id)
    product_id = str(payload.product_id)

    # Rate-limit check
    _check_rate_limit(user_id, product_id)

    now_iso = datetime.now(tz=timezone.utc).isoformat()
    reporter_name = (
        current_user.name
        or (current_user.email.split("@")[0] if current_user.email else "Anonymous")
    )

    doc_data = {
        "user_id":     user_id,
        "product_id":  product_id,
        "category":    payload.category,
        "description": payload.description,
        "created_at":  now_iso,
        "status":      "pending",
        # Fields used by the admin reports panel
        "reporter":    reporter_name,
        "title":       f"Report: {payload.category}",
        "severity":    "medium",
        "productId":   product_id,
        "createdAt":   now_iso,  # alias used by admin UI
    }

    try:
        doc_ref = firestore_db.collection("reports").document()
        doc_ref.set(doc_data)
        doc_id = doc_ref.id
        _logger.info(
            "[reports] New report submitted: id=%s user=%s product=%s category=%s",
            doc_id, user_id, product_id, payload.category,
        )
    except Exception as exc:
        _logger.error("[reports] Firestore write failed: %s", exc, exc_info=True)
        exc_str = str(exc).lower()
        if "quota" in exc_str or "exhausted" in exc_str or "429" in exc_str:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Report service quota limit reached. Please try again tomorrow.",
            )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Failed to save report. Please try again later.",
        ) from exc

    return {
        "id":          doc_id,
        "user_id":     user_id,
        "product_id":  product_id,
        "category":    payload.category,
        "description": payload.description,
        "created_at":  now_iso,
        "status":      "pending",
    }


@router.get("/me")
def get_my_reports(
    current_user: User = Depends(get_current_user_required),
) -> list:
    """
    Return all reports submitted by the current authenticated user.

    - Requires valid JWT — 401 if missing/invalid.
    - Falls back gracefully to returning an empty list if Firestore is unavailable or quota is exceeded.
    """
    if not firebase_connected or firestore_db is None:
        _logger.warning("[reports] Firestore not available. Returning empty list.")
        return []

    user_id = str(current_user.id)

    try:
        docs = (
            firestore_db.collection("reports")
            .where("user_id", "==", user_id)
            .stream()
        )
        results = []
        for doc in docs:
            data = doc.to_dict()
            results.append(
                {
                    "id":          doc.id,
                    "user_id":     data.get("user_id", user_id),
                    "product_id":  data.get("product_id", data.get("productId", "")),
                    "category":    data.get("category", ""),
                    "description": data.get("description", ""),
                    "created_at":  data.get("created_at", data.get("createdAt", "")),
                    "status":      data.get("status", "pending"),
                }
            )
        # Sort newest first (ISO strings sort correctly)
        results.sort(key=lambda r: r["created_at"], reverse=True)
        return results

    except Exception as exc:
        _logger.warning("[reports] Firestore read failed for user %s (quota limits or connection issues): %s", user_id, exc)
        return []
