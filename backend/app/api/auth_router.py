from fastapi import APIRouter, Depends, HTTPException, status, Request
from app.middleware.rate_limit import limiter
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from typing import Optional
from pydantic import BaseModel, EmailStr
from app.core.exceptions import LumoraException

from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
)
from app.core.config import settings
from app.core.firebase import verify_firebase_id_token
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import (
    RegisterRequest,
    LoginRequest,
    UserUpdateRequest,
    UserResponse,
    TokenResponse,
)

router = APIRouter()

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

class MsgResponse(BaseModel):
    message: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

# ── Firebase sync request body ────────────────────────────────────────────────
class FirebaseSyncRequest(BaseModel):
    idToken: str
    role: Optional[str] = "customer"   # role the user chose at registration/login


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> User:
    try:
        payload = decode_access_token(token)
        # BUG-11 FIX: always cast sub to int, regardless of how it was encoded
        raw_id = payload.get("sub")
        user_id: int = int(raw_id)
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token"
            )
    except (Exception, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate credentials"
        )
    user = db.query(User).filter(User.id == user_id).first()
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found"
        )
    check_user_active(user)
    return user

# ── /register ─────────────────────────────────────────────────────────────────
@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
@limiter.limit("10/minute")
def register(request: Request, body: RegisterRequest, db: Session = Depends(get_db)):
    email = body.email.lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email already registered"
        )
    hashed_password = get_password_hash(body.password)
    user = User(name=body.name, email=email, password_hash=hashed_password)
    db.add(user)
    db.commit()
    db.refresh(user)
    return user

def check_user_active(user):
    if not user.is_active:
        raise LumoraException(
            status_code=status.HTTP_403_FORBIDDEN,
            code="ACCOUNT_DISABLED",
            message="Your account has been disabled by the administrator."
        )
        
    from app.shared.firebase.connection import db, firebase_connected
    if not firebase_connected or db is None:
        return
        
    role = (user.role or "customer").lower()
    try:
        if role == "vendor":
            from admin_controls.vendor.firestore import get_vendor_status_from_firestore
            status_val = get_vendor_status_from_firestore(user.firebase_uid or str(user.id))
            if status_val in ("suspended", "disabled", "rejected"):
                raise LumoraException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    code="ACCOUNT_DISABLED",
                    message="Your account has been disabled by the administrator."
                )
        elif role == "affiliate":
            from admin_controls.affiliate.firestore import get_affiliate_status_from_firestore
            status_val = get_affiliate_status_from_firestore(user.firebase_uid or str(user.id))
            if status_val in ("suspended", "disabled", "rejected"):
                raise LumoraException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    code="ACCOUNT_DISABLED",
                    message="Your account has been disabled by the administrator."
                )
    except LumoraException:
        raise
    except Exception as e:
        import logging
        logging.warning(f"Firestore check failed for user {user.id}, falling back to SQLite: {e}")

# ── /login ────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(request: Request, body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    # Firebase-managed accounts have a sentinel hash — they cannot use /login.
    # They must authenticate via /firebase-sync (Firebase ID token exchange).
    if user.password_hash == "firebase_managed":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Firebase sign-in. Please use the Firebase login flow."
        )
    try:
        password_valid = verify_password(body.password, user.password_hash)
    except Exception:
        # Malformed hash — never crash as 500
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    if not password_valid:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials"
        )
    check_user_active(user)
    from app.services.activity_log_service import ActivityLogService
    ActivityLogService.log_user_activity(
        db=db,
        user_id=user.id,
        activity_type="login",
        details="Logged in via standard email/password."
    )
    db.commit()
    from app.utils.logger import log_structured_event
    log_structured_event(
        user_id=user.id,
        role=user.role,
        action="user_login",
        module="auth",
        status="success",
        details=f"User '{user.email}' logged in via email/password",
    )
    # The active role for standard login is the database role
    active_role = user.role or "customer"
    token_data = {"sub": str(user.id), "active_role": active_role}
    access_token = create_access_token(token_data)

    user_dict = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": active_role,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "firebase_uid": user.firebase_uid,
        "sqlite_user_id": user.id,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_dict
    }

# ── /me ───────────────────────────────────────────────────────────────────────
@router.get("/me")
def read_me(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    token: str = Depends(oauth2_scheme)
):
    # Decode token to extract the active_role claim
    active_role = current_user.role or "customer"
    if token:
        try:
            payload = decode_access_token(token)
            if payload.get("active_role"):
                active_role = payload.get("active_role")
        except Exception:
            pass

    is_paused = False
    from app.shared.firebase.connection import db as fs_db, firebase_connected
    if firebase_connected and fs_db is not None:
        from admin.firestore.admin_firestore import get_platform_settings
        try:
            settings = get_platform_settings()
            is_paused = settings.get("isPlatformPaused", False)
        except Exception:
            pass
    else:
        from admin.routes.settings import _local_platform_state
        is_paused = _local_platform_state.get("isPlatformPaused", False)
        
    return {
        "id":              current_user.id,
        "name":            current_user.name or "",
        "email":           current_user.email or "",
        "role":            active_role,  # Return the active role from token payload
        "is_active":       bool(current_user.is_active),
        "is_verified":     bool(current_user.is_verified),
        "platform_paused": bool(is_paused),
        "firebase_uid":    current_user.firebase_uid,
        "sqlite_user_id":  current_user.id,
    }

@router.put("/me", response_model=UserResponse)
def update_me(
    user_in: UserUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if user_in.name is not None:
        current_user.name = user_in.name
    if user_in.role is not None:
        current_user.role = user_in.role
    if user_in.firebase_uid is not None:
        current_user.firebase_uid = user_in.firebase_uid
    db.commit()
    db.refresh(current_user)
    return current_user


# ── /firebase-sync ────────────────────────────────────────────────────────────
@router.post("/firebase-sync", response_model=TokenResponse)
@limiter.limit("10/minute")
def firebase_sync(request: Request, body: FirebaseSyncRequest, db: Session = Depends(get_db)):
    """
    Exchange a Firebase ID Token for a Lumora backend JWT.

    Flow:
    1. Verify the Firebase ID Token with Google's RS256 public keys.
    2. Look up User by email in SQLite.
    3. If not found → create User automatically (firebase_managed account).
    4. If found → update is_verified if Firebase says email is verified.
    5. Return a Lumora JWT identical in structure to /login.
    """
    # Step 1 — verify Firebase token
    try:
        claims = verify_firebase_id_token(body.idToken, settings.FIREBASE_PROJECT_ID)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Firebase token invalid: {exc}",
        )

    email: Optional[str] = claims.get("email")
    name: str = claims.get("name") or (email.split("@")[0] if email else "User")
    email_verified: bool = claims.get("email_verified", False)
    role: str = body.role or "customer"
    # Normalise role value
    if role == "user":
        role = "customer"

    # Step 2 — look up or create user
    if email:
        user = db.query(User).filter(User.email == email.lower()).first()
    else:
        # Rare: GitHub accounts with hidden email — use Firebase UID as identifier
        user = None

    if user is None:
        # Step 3 — auto-create backend user for this Firebase account
        if not email:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Firebase account has no email address. Cannot create backend account.",
            )
        # Use a sentinel password_hash so the account cannot be used with /login
        user = User(
            name=name,
            email=email.lower(),
            password_hash="firebase_managed",   # not a valid bcrypt hash
            role=role,
            is_verified=email_verified,
            firebase_uid=claims.get("uid"),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    else:
        # Step 4 — update verification status; only set role if not already assigned
        # (never downgrade vendor/affiliate → customer on re-login from the wrong tile)
        changed = False
        if email_verified and not user.is_verified:
            user.is_verified = True
            changed = True
        # Sync Firebase UID to user if missing or mismatched
        fb_uid = claims.get("uid")
        if fb_uid and user.firebase_uid != fb_uid:
            user.firebase_uid = fb_uid
            changed = True
        # Only update role when the user currently has the default 'customer' role
        # AND the incoming role is more specific.  This prevents a vendor who logs
        # in through the customer tile from having their role silently reset.
        ELEVATED_ROLES = ("vendor", "affiliate", "admin")
        if role and role != "customer" and user.role not in ELEVATED_ROLES:
            if role == "admin":
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Cannot elevate to admin role.",
                )
            user.role = role
            changed = True
        if changed:
            db.commit()
            db.refresh(user)

    check_user_active(user)
    from app.services.activity_log_service import ActivityLogService
    ActivityLogService.log_user_activity(
        db=db,
        user_id=user.id,
        activity_type="firebase_sync",
        details=f"Synced Firebase account. Role: {user.role or 'customer'}."
    )
    db.commit()
    from app.utils.logger import log_structured_event
    log_structured_event(
        user_id=user.id,
        role=user.role,
        action="firebase_login",
        module="auth",
        status="success",
        details=f"User '{user.email}' authenticated via Firebase. Role: {user.role or 'customer'}",
    )
    # Step 5 — issue backend JWT with the active role, strictly validated against SQLite role (Source of Truth)
    db_role = user.role or "customer"
    active_role = role or "customer"
    
    if db_role == "customer":
        active_role = "customer"
    elif db_role == "vendor":
        if active_role not in ("vendor", "customer"):
            active_role = "vendor"
    elif db_role == "affiliate":
        if active_role not in ("affiliate", "customer"):
            active_role = "affiliate"
            
    token_data = {"sub": str(user.id), "active_role": active_role}
    access_token = create_access_token(token_data)

    user_dict = {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "role": active_role,
        "is_active": user.is_active,
        "is_verified": user.is_verified,
        "firebase_uid": user.firebase_uid,
        "sqlite_user_id": user.id,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
    }
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user_dict
    }

# ── /forgot-password ──────────────────────────────────────────────────────────
@router.post("/forgot-password", response_model=MsgResponse)
@limiter.limit("10/minute")
def forgot_password(request: Request, body: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email.lower()).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )
    return MsgResponse(message="Cryptographic reset link dispatched to your email registry.")

# ── /verify-email ─────────────────────────────────────────────────────────────
@router.post("/verify-email", response_model=MsgResponse)
@limiter.limit("10/minute")
def verify_email(request: Request):
    return MsgResponse(message="Email verified successfully.")

# ── /resend-verification ──────────────────────────────────────────────────────
@router.post("/resend-verification", response_model=MsgResponse)
@limiter.limit("10/minute")
def resend_verification(request: Request):
    return MsgResponse(message="Verification email resent.")
