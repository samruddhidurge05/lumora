from fastapi import APIRouter, Depends, HTTPException, Body, Query
from app.admin_api.reports.services import (
    get_reports_analytics_data,
    get_reports_list,
    update_report_status,
    assign_report_moderator,
    remove_report
)
from admin.validators.admin_auth import require_admin_role
from app.db.session import get_db
from app.models.user import User
from app.services.audit_log_service import log_admin_action
from app.services.notification_service import NotificationService
from sqlalchemy.orm import Session
from typing import Optional
import logging

_logger = logging.getLogger("lumora.admin.reports")

router = APIRouter()

@router.get("/")
def get_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    status: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    admin_user: User = Depends(require_admin_role)
):
    return get_reports_list(page=page, page_size=page_size, status=status, search=search)

@router.get("/analytics")
def get_analytics(admin_user: User = Depends(require_admin_role)):
    return get_reports_analytics_data()

@router.get("/dashboard")
def get_dashboard(admin_user: User = Depends(require_admin_role)):
    return get_reports_analytics_data()

@router.post("/resolve")
def resolve_report_endpoint(
    report_id: str = Body(..., embed=True),
    note: Optional[str] = Body(None),
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    try:
        result = update_report_status(report_id, "Resolved", note=note)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── Audit log ────────────────────────────────────────────────────────────
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="report_resolved",
            target_type="report",
            target_id=str(report_id),
        )
    except Exception:
        pass  # Non-blocking

    # ── Customer notification ─────────────────────────────────────────────────
    # Fetch the report doc from Firestore to get user_id and product title
    try:
        from app.shared.firebase.connection import db as fdb, firebase_connected
        if firebase_connected and fdb is not None:
            doc = fdb.collection("reports").document(report_id).get()
            if doc.exists:
                data = doc.to_dict()
                customer_id_str = data.get("user_id")
                product_title   = data.get("productTitle") or data.get("productName") or data.get("product_id") or "your product"
                if customer_id_str:
                    try:
                        customer_id = int(customer_id_str)
                        NotificationService.create_notification(
                            db=db,
                            user_id=customer_id,
                            title="Report Resolved ✓",
                            message=f'Your report regarding "{product_title}" has been resolved. Thank you for helping improve Lumora.',
                            category="report",
                        )
                        db.commit()
                    except (ValueError, TypeError):
                        _logger.warning("[reports] Could not parse customer_id '%s' for notification", customer_id_str)
    except Exception as notif_err:
        _logger.warning("[reports] Customer notification failed (non-blocking): %s", notif_err)

    return result


@router.post("/reject")
def reject_report_endpoint(
    report_id: str = Body(..., embed=True),
    note: Optional[str] = Body(None),
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    try:
        result = update_report_status(report_id, "Rejected", note=note)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    # ── Audit log ────────────────────────────────────────────────────────────
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="report_rejected",
            target_type="report",
            target_id=str(report_id),
        )
    except Exception:
        pass  # Non-blocking

    # ── Customer notification ─────────────────────────────────────────────────
    try:
        from app.shared.firebase.connection import db as fdb, firebase_connected
        if firebase_connected and fdb is not None:
            doc = fdb.collection("reports").document(report_id).get()
            if doc.exists:
                data = doc.to_dict()
                customer_id_str = data.get("user_id")
                product_title   = data.get("productTitle") or data.get("productName") or data.get("product_id") or "your product"
                if customer_id_str:
                    try:
                        customer_id = int(customer_id_str)
                        NotificationService.create_notification(
                            db=db,
                            user_id=customer_id,
                            title="Report Update",
                            message=f'Your report regarding "{product_title}" has been reviewed and closed.',
                            category="report",
                        )
                        db.commit()
                    except (ValueError, TypeError):
                        _logger.warning("[reports] Could not parse customer_id '%s' for notification", customer_id_str)
    except Exception as notif_err:
        _logger.warning("[reports] Customer notification failed (non-blocking): %s", notif_err)

    return result


@router.post("/assign")
def assign_report_endpoint(
    report_id: str = Body(..., embed=True),
    assignee: str = Body(..., embed=True),
    admin_user: User = Depends(require_admin_role),
    db: Session = Depends(get_db),
):
    try:
        result = assign_report_moderator(report_id, assignee)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    try:
        log_admin_action(
            db=db,
            admin_user_id=admin_user.id,
            action="report_assigned",
            target_type="report",
            target_id=str(report_id),
            metadata={"assignee": assignee},
        )
    except Exception:
        pass  # Non-blocking
    return result

@router.post("/delete")
def delete_report_endpoint(
    report_id: str = Body(..., embed=True),
    admin_user: User = Depends(require_admin_role)
):
    try:
        return remove_report(report_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
