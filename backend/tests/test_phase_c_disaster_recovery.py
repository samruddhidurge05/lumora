import os
import sys
import uuid
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import engine
from app.db.session import SessionLocal
from app.models import Base, User, AdminRole, AdminInvitation, AdminEmailLog
from app.services.email_service import check_smtp_health, validate_smtp_on_startup


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


# 1. Test Startup Validation Recovery with Disabled SMTP
def test_startup_validation_recovery(monkeypatch):
    from app.core import config
    monkeypatch.setattr(config.settings, "SMTP_ENABLED", False)

    val = validate_smtp_on_startup()
    assert val["status"] == "DISABLED"


# 2. Test Synthetic Health Check with Mock Provider
def test_synthetic_health_check_recovery(monkeypatch):
    from app.core import config
    monkeypatch.setattr(config.settings, "SMTP_ENABLED", False)
    monkeypatch.setattr(config.settings, "EMAIL_PROVIDER", "mock")

    health = check_smtp_health()
    assert health["status"] == "healthy" or health["status"] == "disabled"
