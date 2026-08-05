"""
test_schema_migrations.py
--------------------------
Unit tests verifying schema migrations startup safety under SQLAlchemy 2.0 PoolProxiedConnection.
"""
from unittest.mock import MagicMock, patch
import pytest

from app.main import _run_schema_migrations


def test_postgresql_schema_migration_raw_connection_autocommit():
    """Verify that PostgreSQL schema migration properly sets autocommit on underlying driver connection without raising AttributeError on PoolProxiedConnection."""
    mock_engine = MagicMock()
    mock_engine.dialect.name = "postgresql"

    # Simulate SQLAlchemy 2.0 PoolProxiedConnection wrapper:
    # Top-level proxied connection object without 'autocommit' attribute directly on it,
    # but with driver_connection containing 'autocommit'.
    class MockDriverConnection:
        def __init__(self):
            self.autocommit = False

    class MockPoolProxiedConnection:
        __slots__ = ('driver_connection', '_cursor')

        def __init__(self, driver_conn):
            self.driver_connection = driver_conn
            self._cursor = MagicMock()

        def cursor(self):
            return self._cursor

        def close(self):
            pass

    mock_driver_conn = MockDriverConnection()
    mock_proxied_conn = MockPoolProxiedConnection(mock_driver_conn)
    mock_engine.raw_connection.return_value = mock_proxied_conn

    with patch("app.main.engine", mock_engine):
        _run_schema_migrations()

    # Verify autocommit was successfully set on driver_connection
    assert mock_driver_conn.autocommit is True
    # Verify cursor execute was called for migrations
    assert mock_proxied_conn._cursor.execute.called
