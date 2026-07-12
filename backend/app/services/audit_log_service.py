from app.models.audit_log import AuditLog
from datetime import datetime
from sqlalchemy.orm import Session
import json


def log_admin_action(
    db: Session,
    admin_user_id: int,
    action: str,
    target_type: str = None,
    target_id: str = None,
    metadata: dict = None,
    ip_address: str = None,
) -> AuditLog:
    entry = AuditLog(
        admin_user_id=admin_user_id,
        action=action,
        target_type=target_type,
        target_id=str(target_id) if target_id else None,
        metadata_json=json.dumps(metadata) if metadata else None,
        ip_address=ip_address,
        created_at=datetime.utcnow(),
    )
    db.add(entry)
    db.commit()
    return entry
