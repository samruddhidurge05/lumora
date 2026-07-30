from typing import Any

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings

db_url = settings.DATABASE_URL
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

if db_url.startswith("postgresql://") and "sslmode" not in db_url:
    delimiter = "&" if "?" in db_url else "?"
    db_url = f"{db_url}{delimiter}sslmode=require"

connect_args = {"check_same_thread": False} if db_url.startswith("sqlite") else {}
engine_kwargs: dict[str, Any] = {"echo": False, "connect_args": connect_args}
if db_url.startswith("postgresql"):
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 300
    # Increase pool to handle concurrent API + background-sync connections.
    # pool_size=10 persistent workers + max_overflow=20 burst headroom = 30 max total.
    # pool_timeout raised to 45 s to survive slow cold-start traffic spikes.
    engine_kwargs["pool_size"] = 10
    engine_kwargs["max_overflow"] = 20
    engine_kwargs["pool_timeout"] = 45

# Create SQLAlchemy engine
engine = create_engine(db_url, **engine_kwargs)

# Create a configured "Session" class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

