from typing import List
from app.models.notification import Notification
from app.repositories.base import BaseRepository

class NotificationRepository(BaseRepository[Notification]):
    def __init__(self, db):
        super().__init__(Notification, db)

    def get_by_user(self, user_id: int, only_unread: bool = False) -> List[Notification]:
        q = self.db.query(Notification).filter(Notification.user_id == user_id)
        if only_unread:
            q = q.filter(Notification.is_read == False)
        return q.order_by(Notification.created_at.desc()).all()

    def mark_all_as_read(self, user_id: int) -> None:
        self.db.query(Notification).filter(
            Notification.user_id == user_id,
            Notification.is_read == False
        ).update({"is_read": True}, synchronize_session=False)
