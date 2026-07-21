"""
backend/app/core/firebase.py
----------------------------
Firebase ID Token verification using Google's public keys.
No firebase-admin SDK required - uses only httpx and python-jose
which are already in requirements.txt.

Flow:
  1. Fetch Firebase public X.509 certificates from Google (cached 1 hr)
  2. Identify which key signed the token (via 'kid' header)
  3. Verify RS256 signature, audience, issuer, and expiry
  4. Return the decoded claims dict on success
"""

import time
import asyncio
from typing import Optional
import httpx
from jose import jwt, JWTError
from cryptography import x509
from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import serialization

# -- Public key cache ----------------------------------------------------------
# Stores {kid: pem_public_key_string} and the fetch timestamp.
_key_cache: dict = {}
_cache_ts: float = 0.0
_CACHE_TTL: float = 3600.0  # 1 hour

FIREBASE_KEYS_URL = (
    "https://www.googleapis.com/robot/v1/metadata/x509/"
    "securetoken@system.gserviceaccount.com"
)


async def _fetch_public_keys() -> dict:
    """Fetch Firebase RS256 public keys and return {kid: pem_str}."""
    global _key_cache, _cache_ts

    now = time.time()
    if _key_cache and (now - _cache_ts) < _CACHE_TTL:
        return _key_cache

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(FIREBASE_KEYS_URL)
        resp.raise_for_status()
        certs: dict = resp.json()

    pem_keys = {}
    for kid, cert_pem in certs.items():
        try:
            cert = x509.load_pem_x509_certificate(
                cert_pem.encode("utf-8"), default_backend()
            )
            pub_key_pem = cert.public_key().public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo,
            ).decode("utf-8")
            pem_keys[kid] = pub_key_pem
        except Exception:
            continue

    _key_cache = pem_keys
    _cache_ts = now
    return _key_cache


def _fetch_public_keys_sync() -> dict:
    """Synchronous wrapper - runs the async fetch in the current event loop or a new one."""
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # We're inside an async context (FastAPI); use a thread to avoid nesting
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(asyncio.run, _fetch_public_keys())
                return future.result()
        else:
            return loop.run_until_complete(_fetch_public_keys())
    except RuntimeError:
        return asyncio.run(_fetch_public_keys())


def verify_firebase_id_token(id_token: str, project_id: str) -> dict:
    """
    Verify a Firebase ID Token and return the decoded claims.

    Raises ValueError with a descriptive message on any failure.

    Returns dict with at minimum:
      uid        - Firebase UID (str)
      email      - user email (str | None)
      name       - display name (str | None)
      email_verified - bool
    """
    if not project_id:
        raise ValueError(
            "FIREBASE_PROJECT_ID is not configured in backend/.env"
        )

    # --- Step 1: get unverified header to find the 'kid' ---
    try:
        header = jwt.get_unverified_header(id_token)
    except JWTError as e:
        raise ValueError(f"Malformed Firebase token header: {e}")

    kid = header.get("kid")
    if not kid:
        raise ValueError("Firebase token missing 'kid' header")

    # --- Step 2: fetch Google's public keys ---
    try:
        keys = _fetch_public_keys_sync()
    except Exception as e:
        raise ValueError(f"Failed to fetch Firebase public keys: {e}")

    if kid not in keys:
        # Bust cache and retry once (keys rotate periodically)
        global _cache_ts
        _cache_ts = 0.0
        try:
            keys = _fetch_public_keys_sync()
        except Exception as e:
            raise ValueError(f"Failed to refresh Firebase public keys: {e}")

    if kid not in keys:
        raise ValueError(f"Firebase token signed with unknown key id '{kid}'")

    # --- Step 3: verify JWT ---
    try:
        claims = jwt.decode(
            id_token,
            keys[kid],
            algorithms=["RS256"],
            audience=project_id,
            issuer=f"https://securetoken.google.com/{project_id}",
            options={"verify_exp": True},
        )
    except JWTError as e:
        raise ValueError(f"Firebase token verification failed: {e}")

    # --- Step 4: extract and normalise claims ---
    uid = claims.get("user_id") or claims.get("sub")
    if not uid:
        raise ValueError("Firebase token missing 'sub'/'user_id' claim")

    return {
        "uid": uid,
        "email": claims.get("email"),
        "name": claims.get("name"),
        "email_verified": claims.get("email_verified", False),
        "firebase": claims,
    }
