"""
Shared FastAPI dependencies for the Lumora backend.

get_current_user_optional — returns User or None (never raises).
get_current_user_required — returns User or raises 401.
get_current_vendor        — requires a valid JWT with role='vendor' or 'admin'.
                            Returns a dict with {uid, role, email, name}.
"""
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from app.core.security import decode_access_token
from app.db.session import get_db
from app.models.user import User
from app.core.exceptions import LumoraException

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def _decode_user(token: str, db: Session) -> User | None:
    """
    Internal helper: decode the JWT and look up the corresponding User row.
    Returns None on any failure (bad token, user not found).
    """
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        raw_id = payload.get("sub")
        if raw_id is None:
            return None
        user_id = int(raw_id)   # BUG-11 FIX: always cast to int
        return db.query(User).filter(User.id == user_id).first()
    except Exception:
        return None


def get_current_user_optional(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User | None:
    """Return the authenticated User or None (never raises)."""
    return _decode_user(token, db)


def get_current_user_required(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    """Return the authenticated User or raise 401."""
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user = _decode_user(token, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise LumoraException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ACCOUNT_DISABLED",
            message="Your account has been disabled."
        )
    return user


def get_current_vendor(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> dict:
    """
    Require a valid JWT token from a vendor-role account.
    Returns a dict: {uid: str(user.id), role: 'vendor', email: ..., name: ...}

    BUG-01 FIX: Dev mock fallback removed. A real JWT is always required.
    The uid returned is now str(user.id) — the SQLite integer — which is what
    the frontend stores via firebase-sync. Vendor routes compare this uid
    against the vendor_id path param sent by the frontend.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated. Please log in.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = _decode_user(token, db)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise LumoraException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ACCOUNT_DISABLED",
            message="Your account has been disabled by the administrator."
        )

    if user.role not in ("vendor", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Vendor access required. Your account role is '{user.role}'.",
        )

    return {
        "uid":   str(user.id),
        "role":  user.role,
        "email": user.email,
        "name":  user.name,
    }
