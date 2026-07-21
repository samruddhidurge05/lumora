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
    "description": str,       # user-provided text (10-2000 chars)
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
from sqlalchemy.orm import Session

from app.dependencies import get_current_user_required
from app.models.user import User
from app.models.report import SQLReport
from app.db.session import get_db
from app.shared.firebase.connection import db as firestore_db, firebase_connected

_logger = logging.getLogger("lumora.reports")

router = APIRouter()

# ?? Constants ?????????????????????????????????????????????????????????????????

VALID_CATEGORIES: List[str] = [
    "spam",
    "inappropriate",
    "counterfeit",
    "misleading",
    "other",
]

RATE_LIMIT_MAX   = 3          # max reports per user per product per window
RATE_LIMIT_HOURS = 24         # rolling window in hours


# ?? Pydantic schemas ??????????????????????????????????????????????????????????

class ReportCreateRequest(BaseModel):
    product_id:  str = Field(..., description="Product identifier")
    category:    str = Field(..., description=f"One of: {VALID_CATEGORIES}")
    description: str = Field(..., min_length=10, max_length=2000,
                             description="Describe the issue (10-2000 characters)")

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


# ?? Helper ????????????????????????????????????????????????????????????????????

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
    product in the last 24 hours.  Raises HTTP 429 if ? RATE_LIMIT_MAX.
    """
    cutoff = datetime.now(tz=timezone.utc) - timedelta(hours=RATE_LIMIT_HOURS)
    cutoff_iso = cutoff.isoformat()

    try:
        # Firestore does not support compound inequality queries on different fields,
        # so we filter by user_id + product_id first, then apply the time filter
        # in Python - safe because we expect a small number (< 100) of results.
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


# ?? Routes ????????????????????????????????????????????????????????????????????

@router.post("/", status_code=status.HTTP_201_CREATED)
def submit_report(
    payload: ReportCreateRequest,
    current_user: User = Depends(get_current_user_required),
    db: Session = Depends(get_db),
) -> dict:
    """
    Submit a product report.
    - Requires valid JWT.
    - Rate-limits to 3 reports per user/product/24h.
    - Writes to the SQL database (PostgreSQL/SQLite) as the primary reliable storage.
    - Dual-writes to Firestore for real-time sync (non-blocking if Firestore is over quota or unavailable).
    """
    user_id    = str(current_user.id)
    product_id = str(payload.product_id)

    # Check rate limit (non-blocking if Firestore fails)
    try:
        if firebase_connected and firestore_db is not None:
            _check_rate_limit(user_id, product_id)
    except HTTPException:
        raise
    except Exception as exc:
        _logger.warning("[reports] Rate-limit check failed: %s", exc)

    now_iso = datetime.now(tz=timezone.utc).isoformat()
    reporter_name = (
        current_user.name
        or (current_user.email.split("@")[0] if current_user.email else "Anonymous")
    )

    # 1. Write to SQL database (always)
    sql_report = SQLReport(
        user_id=user_id,
        product_id=product_id,
        category=payload.category,
        description=payload.description,
        status="Pending",
        reporter=reporter_name,
        title=f"Report: {payload.category}",
        severity="medium",
        assignee="Unassigned",
        created_at=datetime.utcnow()
    )

    try:
        db.add(sql_report)
        db.commit()
        db.refresh(sql_report)
        doc_id = str(sql_report.id)
    except Exception as sql_err:
        _logger.error("[reports] SQL database write failed: %s", sql_err, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to submit report. Please try again.",
        )

    # 2. Try Firestore dual-write (non-blocking)
    doc_data = {
        "user_id":     user_id,
        "product_id":  product_id,
        "category":    payload.category,
        "description": payload.description,
        "created_at":  now_iso,
        "status":      "pending",
        "reporter":    reporter_name,
        "title":       f"Report: {payload.category}",
        "severity":    "medium",
        "productId":   product_id,
        "createdAt":   now_iso,
    }

    if firebase_connected and firestore_db is not None:
        try:
            firestore_db.collection("reports").document(doc_id).set(doc_data)
            _logger.info("[reports] Firestore dual-write succeeded: id=%s", doc_id)
        except Exception as fs_err:
            _logger.warning("[reports] Firestore write failed (using SQL only): %s", fs_err)

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
    db: Session = Depends(get_db),
) -> list:
    """
    Return all reports submitted by the current authenticated user.
    - Requires valid JWT.
    - Reads from Firestore first (for backward compatibility).
    - Falls back to SQL database reports if Firestore fails or is offline.
    """
    user_id = str(current_user.id)

    # 1. Try Firestore first
    if firebase_connected and firestore_db is not None:
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
            results.sort(key=lambda r: r["created_at"], reverse=True)
            if results:
                return results
        except Exception as exc:
            _logger.warning("[reports] Firestore read failed, falling back to SQL: %s", exc)

    # 2. Fallback: query from SQL database
    try:
        sql_reports = (
            db.query(SQLReport)
            .filter(SQLReport.user_id == user_id)
            .order_by(SQLReport.created_at.desc())
            .all()
        )
        return [
            {
                "id":          str(r.id),
                "user_id":     r.user_id,
                "product_id":  r.product_id,
                "category":    r.category,
                "description": r.description,
                "created_at":  r.created_at.isoformat() + "Z",
                "status":      r.status,
            }
            for r in sql_reports
        ]
    except Exception as sql_err:
        _logger.error("[reports] SQL read failed: %s", sql_err)
        return []
