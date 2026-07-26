import os
import sys
import uuid
import time
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import engine
from app.db.session import SessionLocal
from app.models import Base, User, AdminRole, AdminInvitation, AdminEmailLog
from app.admin_api.admin_users.routes import invite_admin, InviteRequest


def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.execute(text("SELECT provider FROM admin_invitations LIMIT 1"))
    except Exception:
        db.rollback()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    finally:
        db.close()

setup_test_db()


def get_super_admin(db):
    admin = db.query(User).filter(User.email == "load_super_admin@lumora.io").first()
    if not admin:
        admin = User(name="Load Admin", email="load_super_admin@lumora.io", role="admin", password_hash="hash123")
        db.add(admin)
        db.commit()
        db.refresh(admin)
        role = AdminRole(user_id=admin.id, role_level="super_admin", is_active=True)
        db.add(role)
        db.commit()
    return admin


# 1. High-Volume Creation Benchmark with P50/P95/P99 Metrics
def test_high_volume_invitation_creation_benchmark():
    db = SessionLocal()
    try:
        admin = get_super_admin(db)
        latencies = []

        for i in range(50):
            req = InviteRequest(
                email=f"load_{i}_{uuid.uuid4().hex[:6]}@lumora.io",
                role_level="analyst",
            )
            t_start = time.time()
            invite_admin(body=req, db=db, admin_user=admin)
            elapsed_ms = (time.time() - t_start) * 1000
            latencies.append(elapsed_ms)

        latencies.sort()
        p50 = latencies[int(len(latencies) * 0.50)]
        p95 = latencies[int(len(latencies) * 0.95)]
        p99 = latencies[-1]

        assert len(latencies) == 50
        assert p95 < 150 # P95 latency under 150ms per invitation creation
    finally:
        db.close()


# 2. Database Audit Index & Query Telemetry
def test_database_audit_query_latency_benchmark():
    db = SessionLocal()
    try:
        start_time = time.time()
        from app.models.admin_email_log import AdminEmailLog
        logs = db.query(AdminEmailLog).order_by(AdminEmailLog.created_at.desc()).limit(100).all()

        query_time_ms = (time.time() - start_time) * 1000
        assert query_time_ms < 50
    finally:
        db.close()
