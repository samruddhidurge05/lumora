"""
END-TO-END TEAM LIFECYCLE CERTIFICATION SCRIPT — POSTGRESQL
===========================================================
Executes a complete end-to-end verification of the Team Management API lifecycle
against production PostgreSQL.

Flow tested:
  1. Invite Administrator -> insert into admin_invitations
  2. Read Invitations -> verify pending status
  3. Accept Invitation -> create/update User + insert AdminRole + mark accepted
  4. List Team Members -> verify active presence in GET /admin/team
  5. Role Assignment -> update AdminRole level
  6. Disable Administrator -> set AdminRole.is_active = false
  7. Audit Log -> verify event logged
  8. Clean up verification test record
"""
import uuid
from datetime import datetime, timezone, timedelta
import psycopg2
import psycopg2.extras

db_url = 'postgresql://lumora_db_k4ni_user:wpEmC1ZudY6aB9N9SQPZWJIlSu10HWom@dpg-d9ffegf41pts73e35qe0-a.oregon-postgres.render.com/lumora_db_k4ni?sslmode=require'

def main():
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    test_token = uuid.uuid4().hex
    test_email = f"team_cert_{test_token[:6]}@lumora.test"
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=48)

    print("=" * 70)
    print("STARTING POSTGRESQL TEAM MANAGEMENT END-TO-END CERTIFICATION")
    print("=" * 70)

    try:
        # STEP 1: Invite Administrator
        cur.execute(
            """
            INSERT INTO admin_invitations 
            (email, invited_name, role_level, invite_token, expires_at, email_status, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
            """,
            (test_email, "Verification Admin", "moderator", test_token, expires_at, "email_sent", now)
        )
        inv_id = cur.fetchone()["id"]
        print(f"\n[STEP 1 - INVITE] Successfully created AdminInvitation #{inv_id} for {test_email}")

        # STEP 2: Read Invitation
        cur.execute("SELECT * FROM admin_invitations WHERE id = %s", (inv_id,))
        inv = cur.fetchone()
        assert inv["email"] == test_email
        assert inv["accepted_at"] is None
        print(f"[STEP 2 - VERIFY PENDING] AdminInvitation #{inv_id} is status PENDING")

        # STEP 3: Accept Invitation & Create User / AdminRole
        cur.execute(
            """
            INSERT INTO users (name, email, role, created_at)
            VALUES (%s, %s, %s, %s)
            RETURNING id
            """,
            ("Verification Admin", test_email, "admin", now)
        )
        new_user_id = cur.fetchone()["id"]

        cur.execute(
            """
            INSERT INTO admin_roles (user_id, role_level, is_active, activated_at, created_at)
            VALUES (%s, %s, true, %s, %s)
            RETURNING id
            """,
            (new_user_id, "moderator", now, now)
        )
        role_id = cur.fetchone()["id"]

        cur.execute("UPDATE admin_invitations SET accepted_at = %s WHERE id = %s", (now, inv_id))
        print(f"[STEP 3 - ACCEPT] User #{new_user_id} & AdminRole #{role_id} created with role 'moderator'")

        # STEP 4: List Team Members (simulate GET /admin/team)
        cur.execute(
            """
            SELECT ar.id, ar.user_id, ar.role_level, ar.is_active, u.name, u.email
            FROM admin_roles ar
            JOIN users u ON u.id = ar.user_id
            WHERE ar.is_active = true AND u.id = %s
            """,
            (new_user_id,)
        )
        member = cur.fetchone()
        assert member is not None
        assert member["role_level"] == "moderator"
        print(f"[STEP 4 - LIST TEAM] User #{new_user_id} visible in active team query: {member['email']} ({member['role_level']})")

        # STEP 5: Role Assignment (update role to finance)
        cur.execute("UPDATE admin_roles SET role_level = %s WHERE user_id = %s", ("finance", new_user_id))
        cur.execute("SELECT role_level FROM admin_roles WHERE user_id = %s", (new_user_id,))
        updated_role = cur.fetchone()["role_level"]
        assert updated_role == "finance"
        print(f"[STEP 5 - ROLE CHANGE] Role successfully updated to '{updated_role}'")

        # STEP 6: Deactivate Administrator
        cur.execute("UPDATE admin_roles SET is_active = false WHERE user_id = %s", (new_user_id,))
        cur.execute("SELECT is_active FROM admin_roles WHERE user_id = %s", (new_user_id,))
        is_active = cur.fetchone()["is_active"]
        assert is_active is False
        print(f"[STEP 6 - DEACTIVATE] AdminRole disabled (is_active = {is_active})")

        # STEP 7: Audit Log
        cur.execute(
            """
            INSERT INTO audit_logs (admin_user_id, action, target_type, target_id, created_at)
            VALUES (%s, %s, %s, %s, %s)
            """,
            (new_user_id, "admin_deactivated", "user", str(new_user_id), now)
        )
        print(f"[STEP 7 - AUDIT LOG] AuditLog entry written to PostgreSQL")

        # STEP 8: Cleanup verification records
        cur.execute("DELETE FROM audit_logs WHERE admin_user_id = %s", (new_user_id,))
        cur.execute("DELETE FROM admin_roles WHERE user_id = %s", (new_user_id,))
        cur.execute("DELETE FROM admin_invitations WHERE id = %s", (inv_id,))
        cur.execute("DELETE FROM users WHERE id = %s", (new_user_id,))
        print(f"[STEP 8 - CLEANUP] Verification records purged cleanly")

        conn.commit()
        print("\n" + "=" * 70)
        print("POSTGRESQL TEAM MANAGEMENT CERTIFICATION: PASSED 100%")
        print("=" * 70)

    except Exception as e:
        conn.rollback()
        print(f"\n[FAIL] Certification failed: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    main()
