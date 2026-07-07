import json
from sqlalchemy.orm import Session
from app.models.user_activity import UserActivity
from app.models.audit_log import AuditLog

class ActivityLogService:
    @staticmethod
    def log_user_activity(
        db: Session,
        user_id: int,
        activity_type: str,
        details: str = None
    ) -> UserActivity:
        activity = UserActivity(
            user_id=user_id,
            activity_type=activity_type,
            details=details
        )
        db.add(activity)
        return activity

    @staticmethod
    def log_admin_audit(
        db: Session,
        admin_user_id: int,
        action: str,
        target_type: str = None,
        target_id: str = None,
        metadata_dict: dict = None,
        ip_address: str = None
    ) -> AuditLog:
        metadata_str = json.dumps(metadata_dict) if metadata_dict else None
        log = AuditLog(
            admin_user_id=admin_user_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata_json=metadata_str,
            ip_address=ip_address
        )
        db.add(log)
        return log
