"""
conftest.py — pytest configuration for backend tests.

Adds the backend directory to sys.path so that modules like `admin`, `app`,
etc. can be imported directly (e.g. `from admin.firestore.admin_firestore import ...`).

Also pre-patches Firebase and firebase_admin initialization so tests that
import production modules do not attempt real Firebase connections.
"""
import sys
import os
from unittest.mock import MagicMock, patch

# ── Add the backend directory to sys.path ────────────────────────────────────
# This allows `import admin.firestore.admin_firestore` etc. to work.
BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)

# ── Pre-mock firebase_admin so it doesn't need real credentials ──────────────
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
