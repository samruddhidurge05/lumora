from fastapi import APIRouter, Depends, HTTPException, Body
from app.admin_api.reports.services import (
    get_reports_analytics_data,
    get_reports_list,
    update_report_status,
    assign_report_moderator,
    remove_report
)
from admin.validators.admin_auth import require_admin_role
from app.models.user import User

router = APIRouter()

@router.get("/")
def get_reports(admin_user: User = Depends(require_admin_role)):
    return get_reports_list()

@router.get("/analytics")
def get_analytics(admin_user: User = Depends(require_admin_role)):
    return get_reports_analytics_data()

@router.get("/dashboard")
def get_dashboard(admin_user: User = Depends(require_admin_role)):
    return get_reports_analytics_data()

@router.post("/resolve")
def resolve_report_endpoint(
    report_id: str = Body(..., embed=True),
    admin_user: User = Depends(require_admin_role)
):
    try:
        return update_report_status(report_id, "Resolved")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject")
def reject_report_endpoint(
    report_id: str = Body(..., embed=True),
    admin_user: User = Depends(require_admin_role)
):
    try:
        return update_report_status(report_id, "Rejected")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/assign")
def assign_report_endpoint(
    report_id: str = Body(..., embed=True),
    assignee: str = Body(..., embed=True),
    admin_user: User = Depends(require_admin_role)
):
    try:
        return assign_report_moderator(report_id, assignee)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete")
def delete_report_endpoint(
    report_id: str = Body(..., embed=True),
    admin_user: User = Depends(require_admin_role)
):
    try:
        return remove_report(report_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
