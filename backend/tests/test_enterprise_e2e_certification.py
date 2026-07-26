import os
import sys
import uuid
import time
import pytest
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException
from sqlalchemy import text

backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from app.db.database import engine
from app.db.session import SessionLocal
from app.models import Base, User, AdminRole, AdminInvitation
from app.services.email_service import (
    check_smtp_health,
    _send_raw_with_retry,
    generate_job_id,
    generate_correlation_id,
    send_invitation_email,
    EmailDispatcher,
    validate_smtp_on_startup,
)
from app.admin_api.admin_users.routes import (
    invite_admin,
    accept_invite,
    resend_invitation,
    get_admin_me,
    get_email_health,
    get_email_metrics,
)


def setup_test_db():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        db.execute(text("SELECT email_status FROM admin_invitations LIMIT 1"))
    except Exception:
        db.rollback()
        Base.metadata.drop_all(bind=engine)
        Base.metadata.create_all(bind=engine)
    finally:
        db.close()

setup_test_db()


def create_test_super_admin(db):
    email = f"super_admin_{uuid.uuid4().hex[:6]}@lumora.io"
    user = User(name="Super Admin", email=email, role="admin", password_hash="hash")
    db.add(user)
    db.commit()
    db.refresh(user)
    role = AdminRole(user_id=user.id, role_level="super_admin", is_active=True)
    db.add(role)
    db.commit()
    return user


# Scenario 1: Brand New Email Onboarding Flow
def test_scenario_1_brand_new_email_onboarding():
    db = SessionLocal()
    try:
        admin = create_test_super_admin(db)
        new_email = f"new_admin_{uuid.uuid4().hex[:6]}@lumora.io"
        now = datetime.now(timezone.utc)
        token = uuid.uuid4().hex

        # 1. Invitation created
        inv = AdminInvitation(
            email=new_email,
            role_level="moderator",
            invite_token=token,
            invited_by=admin.id,
            expires_at=now + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()

        # 2. User registers (Customer bootstrap)
        user = User(name="New Admin", email=new_email, role="customer", password_hash="hash")
        db.add(user)
        db.commit()

        # 3. User accepts invitation
        res = accept_invite(token=token, db=db, current_user=user)
        assert res["message"] == "Admin role activated successfully."

        # 4. Role elevated
        db.refresh(user)
        assert user.role == "admin"
        admin_role = db.query(AdminRole).filter(AdminRole.user_id == user.id).first()
        assert admin_role is not None
        assert admin_role.role_level == "moderator"
    finally:
        db.close()


# Scenario 2: Existing Customer Role Elevation (Preserving Orders/Data)
def test_scenario_2_existing_customer_upgrade():
    db = SessionLocal()
    try:
        admin = create_test_super_admin(db)
        cust_email = f"customer_{uuid.uuid4().hex[:6]}@lumora.io"
        user = User(name="Existing Customer", email=cust_email, role="customer", password_hash="hash")
        db.add(user)
        db.commit()

        # Create invitation
        now = datetime.now(timezone.utc)
        token = uuid.uuid4().hex
        inv = AdminInvitation(
            email=cust_email,
            role_level="analyst",
            invite_token=token,
            invited_by=admin.id,
            expires_at=now + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()

        # Accept
        res = accept_invite(token=token, db=db, current_user=user)
        assert res["message"] == "Admin role activated successfully."

        # Verify role elevated while user record/id is preserved
        db.refresh(user)
        assert user.role == "admin"
        assert user.email == cust_email
    finally:
        db.close()


# Scenario 3: Existing Vendor Role Addition (Preserving Vendor Identity)
def test_scenario_3_existing_vendor_upgrade():
    db = SessionLocal()
    try:
        admin = create_test_super_admin(db)
        vendor_email = f"vendor_{uuid.uuid4().hex[:6]}@lumora.io"
        user = User(name="Existing Vendor", email=vendor_email, role="vendor", password_hash="hash")
        db.add(user)
        db.commit()

        token = uuid.uuid4().hex
        inv = AdminInvitation(
            email=vendor_email,
            role_level="support_lead",
            invite_token=token,
            invited_by=admin.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()

        res = accept_invite(token=token, db=db, current_user=user)
        assert res["message"] == "Admin role activated successfully."

        db.refresh(user)
        assert user.role == "admin" # Admin role granted
    finally:
        db.close()


# Scenario 4: Existing Affiliate Role Addition (Preserving Affiliate Identity)
def test_scenario_4_existing_affiliate_upgrade():
    db = SessionLocal()
    try:
        admin = create_test_super_admin(db)
        aff_email = f"affiliate_{uuid.uuid4().hex[:6]}@lumora.io"
        user = User(name="Existing Affiliate", email=aff_email, role="affiliate", password_hash="hash")
        db.add(user)
        db.commit()

        token = uuid.uuid4().hex
        inv = AdminInvitation(
            email=aff_email,
            role_level="marketing_manager",
            invite_token=token,
            invited_by=admin.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()

        res = accept_invite(token=token, db=db, current_user=user)
        assert res["message"] == "Admin role activated successfully."

        db.refresh(user)
        assert user.role == "admin"
    finally:
        db.close()


# Scenario 5: Existing Admin (Immediate Routing)
def test_scenario_5_existing_admin_routing():
    db = SessionLocal()
    try:
        admin = create_test_super_admin(db)
        token = uuid.uuid4().hex
        inv = AdminInvitation(
            email=admin.email,
            role_level="super_admin",
            invite_token=token,
            invited_by=admin.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()

        # Existing admin attempting to accept returns already_admin: True
        res = accept_invite(token=token, db=db, current_user=admin)
        assert res.get("already_admin") is True
    finally:
        db.close()


# Scenario 6: Wrong Email Security Guard
def test_scenario_6_wrong_email_blocked():
    db = SessionLocal()
    try:
        admin = create_test_super_admin(db)
        inv_email = f"intended_{uuid.uuid4().hex[:6]}@lumora.io"
        other_email = f"wrong_{uuid.uuid4().hex[:6]}@lumora.io"
        other_user = User(name="Wrong User", email=other_email, role="customer", password_hash="hash")
        db.add(other_user)
        db.commit()

        token = uuid.uuid4().hex
        inv = AdminInvitation(
            email=inv_email,
            role_level="moderator",
            invite_token=token,
            invited_by=admin.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
        )
        db.add(inv)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            accept_invite(token=token, db=db, current_user=other_user)

        assert exc_info.value.status_code == 403
        assert "sent to" in exc_info.value.detail.lower()
    finally:
        db.close()


# Scenario 7: Expired Invitation Guard
def test_scenario_7_expired_invitation_blocked():
    db = SessionLocal()
    try:
        admin = create_test_super_admin(db)
        email = f"expired_{uuid.uuid4().hex[:6]}@lumora.io"
        user = User(name="Expired User", email=email, role="customer", password_hash="hash")
        db.add(user)
        db.commit()

        token = uuid.uuid4().hex
        inv = AdminInvitation(
            email=email,
            role_level="moderator",
            invite_token=token,
            invited_by=admin.id,
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1), # Expired 1 hour ago
        )
        db.add(inv)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            accept_invite(token=token, db=db, current_user=user)

        assert exc_info.value.status_code == 400
        assert "expired" in exc_info.value.detail.lower()
    finally:
        db.close()


# Scenario 8: Revoked Invitation Guard
def test_scenario_8_revoked_invitation_blocked():
    db = SessionLocal()
    try:
        admin = create_test_super_admin(db)
        email = f"revoked_{uuid.uuid4().hex[:6]}@lumora.io"
        user = User(name="Revoked User", email=email, role="customer", password_hash="hash")
        db.add(user)
        db.commit()

        token = uuid.uuid4().hex
        inv = AdminInvitation(
            email=email,
            role_level="moderator",
            invite_token=token,
            invited_by=admin.id,
            expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
            revoked_at=datetime.now(timezone.utc) - timedelta(minutes=10),
        )
        db.add(inv)
        db.commit()

        with pytest.raises(HTTPException) as exc_info:
            accept_invite(token=token, db=db, current_user=user)

        assert exc_info.value.status_code == 400
        assert "revoked" in exc_info.value.detail.lower()
    finally:
        db.close()


# High-Volume Load Simulation (10 -> 20 -> 50 invitations)
def test_high_volume_load_simulation():
    """Simulate queuing 10, 20, and 50 invitations through EmailDispatcher."""
    dispatched_counts = []

    def load_task(inv_id):
        dispatched_counts.append(inv_id)

    # Batch 1: 10 invitations
    for i in range(10):
        EmailDispatcher.dispatch(load_task, f"batch1_{i}")

    # Batch 2: 20 invitations
    for i in range(20):
        EmailDispatcher.dispatch(load_task, f"batch2_{i}")

    # Batch 3: 50 invitations
    for i in range(50):
        EmailDispatcher.dispatch(load_task, f"batch3_{i}")

    time.sleep(0.5) # Allow background threads to complete
    assert len(dispatched_counts) == 80
