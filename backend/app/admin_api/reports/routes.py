from fastapi import APIRouter, HTTPException, Body
from app.admin_api.reports.services import (
    get_reports_analytics_data,
    get_reports_list,
    update_report_status,
    assign_report_moderator,
    remove_report
)

router = APIRouter()

@router.get("/")
def get_reports():
    return get_reports_list()

@router.get("/analytics")
def get_analytics():
    return get_reports_analytics_data()

@router.get("/dashboard")
def get_dashboard():
    return get_reports_analytics_data()

@router.post("/resolve")
def resolve_report_endpoint(report_id: str = Body(..., embed=True)):
    try:
        return update_report_status(report_id, "Resolved")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/reject")
def reject_report_endpoint(report_id: str = Body(..., embed=True)):
    try:
        return update_report_status(report_id, "Rejected")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/assign")
def assign_report_endpoint(
    report_id: str = Body(..., embed=True),
    assignee: str = Body(..., embed=True)
):
    try:
        return assign_report_moderator(report_id, assignee)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/delete")
def delete_report_endpoint(report_id: str = Body(..., embed=True)):
    try:
        return remove_report(report_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
