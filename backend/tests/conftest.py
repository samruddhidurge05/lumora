"""
conftest.py - pytest configuration for backend tests.

Adds the backend directory to sys.path so that modules like `admin`, `app`,
etc. can be imported directly (e.g. `from admin.firestore.admin_firestore import ...`).

Also pre-patches Firebase and firebase_admin initialization so tests that
import production modules do not attempt real Firebase connections.

CRITICAL — DATABASE ISOLATION:
  The DATABASE_URL environment variable is overridden to an in-memory SQLite
  database BEFORE any production module is imported. This guarantees that test
  sessions can never write to the production lumora.db file.

  Root cause of phantom admin accounts (2026-07-29):
    - Test files imported `app.db.database.engine` which read DATABASE_URL from
      .env (sqlite:///./lumora.db) and committed real rows into production.
    - 252 @lumora.io User records, 183 AdminRole records, and 698 AdminInvitation
      records were written to lumora.db during past test runs.
    - This fix ensures that can never happen again.
"""
import sys
import os
from unittest.mock import MagicMock

# -- Add the backend directory to sys.path ------------------------------------
# This allows `import admin.firestore.admin_firestore` etc. to work.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# -- DATABASE ISOLATION: Redirect to sandbox test DB BEFORE any app imports --
# This MUST happen before any `from app.db.database import engine` statement
# is executed anywhere. conftest.py is loaded first by pytest, making this
# the correct and only reliable place to enforce isolation.
TEST_DB_PATH = os.path.join(BACKEND_DIR, "test_lumora_sandbox.db")
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB_PATH}"

# -- Pre-mock firebase_admin so it doesn't need real credentials --------------
# Prevents ImportError / initialization errors when production modules are
# imported during test collection.
firebase_admin_mock = MagicMock()
sys.modules.setdefault("firebase_admin", firebase_admin_mock)
sys.modules.setdefault("firebase_admin.auth", firebase_admin_mock.auth)
sys.modules.setdefault("firebase_admin.firestore", firebase_admin_mock.firestore)
sys.modules.setdefault("firebase_admin.credentials", firebase_admin_mock.credentials)
sys.modules.setdefault("firebase_admin._apps", {})

# Pre-mock google.cloud.firestore to avoid grpc init issues in tests
google_mock = MagicMock()
sys.modules.setdefault("google", google_mock)
sys.modules.setdefault("google.cloud", google_mock.cloud)
sys.modules.setdefault("google.cloud.firestore", google_mock.cloud.firestore)
sys.modules.setdefault("google.cloud.firestore_v1", google_mock.cloud.firestore_v1)
