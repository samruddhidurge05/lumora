from typing import List
from app.models.user_activity import UserActivity
from app.models.audit_log import AuditLog
from app.repositories.base import BaseRepository

class UserActivityRepository(BaseRepository[UserActivity]):
    def __init__(self, db):
        super().__init__(UserActivity, db)

    def get_by_user(self, user_id: int, limit: int = 50) -> List[UserActivity]:
        return (
            self.db.query(UserActivity)
            .filter(UserActivity.user_id == user_id)
            .order_by(UserActivity.created_at.desc())
            .limit(limit)
            .all()
        )


class AuditLogRepository(BaseRepository[AuditLog]):
    def __init__(self, db):
        super().__init__(AuditLog, db)

    def get_logs(self, limit: int = 100) -> List[AuditLog]:
        return (
            self.db.query(AuditLog)
            .order_by(AuditLog.created_at.desc())
            .limit(limit)
            .all()
        )
