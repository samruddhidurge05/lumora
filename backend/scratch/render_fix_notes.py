"""
RENDER STARTUP SAFETY GUARD
============================
On Render (or any deployment where .env is not present), DATABASE_URL
must be explicitly set as an environment variable. This startup guard
detects the dangerous default and aborts with a clear error message
rather than silently reading test.db.

Add this at the top of app/core/config.py (BEFORE the Settings class).
"""
