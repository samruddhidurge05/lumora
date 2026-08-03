"""
app/services/email_service.py
------------------------------
Production-grade Transactional Email Service.

Features:
- Job IDs & Correlation IDs for end-to-end tracing.
- Exponential backoff retry engine with jitter.
- Granular SMTP timeout handling & structured JSON logging.
- Real-time synthetic SMTP connection health checking.

Environment variables:
    SMTP_ENABLED=true|false          (default: false - skips delivery in local dev)
    SMTP_HOST=smtp.gmail.com
    SMTP_PORT=587
    SMTP_USER=apikey
    SMTP_PASSWORD=<password_or_app_token>
    SMTP_FROM=noreply@lumora.design
"""
from __future__ import annotations

import json
import logging
import os
import random
import smtplib
import time
import uuid
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# -- Email Dispatcher Abstraction ----------------------------------------------

class EmailDispatcher:
    """
    Decoupled execution dispatcher for transactional emails.
    Encapsulates task execution so swapping background threads for
    Celery, RQ, or Dramatiq requires zero changes to API handlers.
    """
    @classmethod
    def dispatch(cls, task_fn, *args, **kwargs) -> None:
        """Enqueue task execution asynchronously."""
        def _runner():
            try:
                task_fn(*args, **kwargs)
            except Exception as exc:
                logger.error("[EmailDispatcher] Task execution error: %s", exc)

        import threading
        thread = threading.Thread(target=_runner, daemon=True)
        thread.start()


# -- ID Generators & Structured Logging ---------------------------------------

def generate_job_id() -> str:
    """Generate a unique Email Job ID (e.g. job_8f3a91bd)."""
    return f"job_{uuid.uuid4().hex[:12]}"


def generate_correlation_id() -> str:
    """Generate a unique Correlation ID (e.g. corr_4b7e1289)."""
    return f"corr_{uuid.uuid4().hex[:12]}"


def _log_structured_event(event_name: str, payload: Dict[str, Any], level: int = logging.INFO) -> None:
    """Output structured JSON log entry for centralized log aggregation."""
    log_entry = {
        "event": event_name,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        **payload,
    }
    logger.log(level, json.dumps(log_entry))


def validate_smtp_on_startup() -> Dict[str, Any]:
    """
    Startup configuration & connection check.
    Executed during application boot up to log SMTP readiness.
    """
    from app.core.config import settings

    smtp_enabled = getattr(settings, "SMTP_ENABLED", os.getenv("SMTP_ENABLED", "false").lower() == "true")
    smtp_host = getattr(settings, "SMTP_HOST", os.getenv("SMTP_HOST", "smtp.gmail.com"))
    smtp_port = getattr(settings, "SMTP_PORT", int(os.getenv("SMTP_PORT", "587")))
    smtp_user = getattr(settings, "SMTP_USER", os.getenv("SMTP_USER", ""))
    smtp_from = getattr(settings, "SMTP_FROM", os.getenv("SMTP_FROM", "noreply@lumora.design"))

    if not smtp_enabled:
        _log_structured_event("email_startup_validation", {
            "status": "DISABLED",
            "reason": "SMTP_ENABLED is set to False (Development/Mock Mode)",
            "provider": "mock",
            "host": smtp_host,
            "port": smtp_port,
        })
        return {"status": "DISABLED", "reason": "SMTP_ENABLED=false"}

    missing_creds = []
    if not smtp_host:
        missing_creds.append("SMTP_HOST")

    if missing_creds:
        _log_structured_event("email_startup_validation", {
            "status": "WARNING",
            "reason": f"Missing SMTP configuration fields: {', '.join(missing_creds)}",
            "missing_fields": missing_creds,
        }, level=logging.WARNING)
        return {"status": "WARNING", "missing": missing_creds}

    # Perform real connection test
    health = check_smtp_health()
    _log_structured_event("email_startup_validation", {
        "status": "READY" if health["status"] == "healthy" else "UNHEALTHY",
        "provider": health["provider"],
        "host": smtp_host,
        "port": smtp_port,
        "latency_ms": health["latency_ms"],
        "tls": health["tls"],
        "error": health["error"],
    }, level=logging.INFO if health["status"] == "healthy" else logging.WARNING)

    return health


def record_email_event(
    invitation_id: Optional[int],
    event: str,
    recipient: str,
    provider: str = "gmail_smtp",
    job_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    attempt: int = 1,
    latency_ms: int = 0,
    status_code: Optional[int] = None,
    error_message: Optional[str] = None,
    message_id: Optional[str] = None,
) -> None:
    """Record an append-only entry in the AdminEmailLog audit table."""
    if not invitation_id:
        return
    try:
        from app.db.session import SessionLocal
        from app.models.admin_email_log import AdminEmailLog
        db = SessionLocal()
        log_entry = AdminEmailLog(
            invitation_id=invitation_id,
            event=event,
            recipient=recipient,
            provider=provider,
            job_id=job_id,
            correlation_id=correlation_id,
            attempt=attempt,
            latency_ms=latency_ms,
            status_code=status_code,
            error_message=error_message,
            message_id=message_id,
        )
        db.add(log_entry)
        db.commit()
        db.close()
    except Exception as db_err:
        logger.warning("[email_service] Failed to persist AdminEmailLog event '%s': %s", event, db_err)


# -- Low-Level SMTP Transport with Retry Engine ---------------------------------

def _send_raw_with_retry(
    to_email: str,
    subject: str,
    text_body: str,
    html_body: str,
    job_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    invitation_id: Optional[int] = None,
    max_retries: int = 3,
) -> Tuple[bool, Optional[str], int]:
    """
    Deliver email via OOP Provider hierarchy with exponential backoff retry & append-only audit logging.
    Returns (success: bool, error_message: str | None, latency_ms: int).
    """
    from app.core.config import settings
    from app.services.email_providers import get_email_provider

    j_id = job_id or generate_job_id()
    c_id = correlation_id or generate_correlation_id()
    provider = get_email_provider()

    # Generate RFC 5322–compatible Message-ID tied to this job for full traceability
    from datetime import datetime as _dt
    _msg_id = f"<{_dt.utcnow().strftime('%Y%m%d%H%M%S')}.{j_id}@lumora.design>"

    record_email_event(
        invitation_id=invitation_id,
        event="SENDING",
        recipient=to_email,
        provider=provider.name,
        job_id=j_id,
        correlation_id=c_id,
        attempt=1,
        message_id=_msg_id,
    )

    start_time = time.time()
    last_error: Optional[str] = None

    for attempt in range(1, max_retries + 1):
        attempt_start = time.time()
        ok, err_msg, latency_ms = provider.send(
            to_email=to_email,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            job_id=j_id,
            correlation_id=c_id,
            invitation_id=invitation_id,
        )

        if ok:
            total_lat = int((time.time() - start_time) * 1000)
            _log_structured_event("email_dispatch_success", {
                "job_id": j_id,
                "correlation_id": c_id,
                "message_id": _msg_id,
                "invitation_id": invitation_id,
                "recipient": to_email,
                "provider": provider.name,
                "attempt": attempt,
                "latency_ms": total_lat,
            })
            record_email_event(
                invitation_id=invitation_id,
                event="SENT",
                recipient=to_email,
                provider=provider.name,
                job_id=j_id,
                correlation_id=c_id,
                attempt=attempt,
                latency_ms=total_lat,
                status_code=200,
                message_id=_msg_id,
            )
            return True, None, total_lat
        else:
            attempt_latency = int((time.time() - attempt_start) * 1000)
            last_error = f"Attempt {attempt}/{max_retries} failed: {err_msg}"
            _log_structured_event("email_dispatch_attempt_failed", {
                "job_id": j_id,
                "correlation_id": c_id,
                "invitation_id": invitation_id,
                "recipient": to_email,
                "attempt": attempt,
                "attempt_latency_ms": attempt_latency,
                "error": err_msg,
            }, level=logging.WARNING)
            record_email_event(
                invitation_id=invitation_id,
                event="RETRYING" if attempt < max_retries else "FAILED",
                recipient=to_email,
                provider=provider.name,
                job_id=j_id,
                correlation_id=c_id,
                attempt=attempt,
                latency_ms=attempt_latency,
                error_message=err_msg,
            )

            if attempt < max_retries:
                backoff_sec = (2 ** attempt) + random.uniform(0, 1.0)
                time.sleep(backoff_sec)

    total_latency_ms = int((time.time() - start_time) * 1000)
    _log_structured_event("email_dispatch_permanent_failure", {
        "job_id": j_id,
        "correlation_id": c_id,
        "invitation_id": invitation_id,
        "recipient": to_email,
        "attempts": max_retries,
        "total_latency_ms": total_latency_ms,
        "final_error": last_error,
    }, level=logging.ERROR)

    record_email_event(
        invitation_id=invitation_id,
        event="DEAD_LETTER_QUEUE",
        recipient=to_email,
        provider=provider.name,
        job_id=j_id,
        correlation_id=c_id,
        attempt=max_retries,
        latency_ms=total_latency_ms,
        status_code=500,
        error_message=f"DLQ Enqueued: {last_error}",
    )

    return False, last_error, total_latency_ms


# -- Health Check Verification --------------------------------------------------

def check_smtp_health() -> Dict[str, Any]:
    """
    Perform synthetic SMTP connection & STARTTLS handshake test.
    Does NOT send an actual email. Returns diagnostic dict.
    """
    from app.core.config import settings

    smtp_enabled = getattr(settings, "SMTP_ENABLED", os.getenv("SMTP_ENABLED", "false").lower() == "true")
    smtp_host = getattr(settings, "SMTP_HOST", os.getenv("SMTP_HOST", "smtp.gmail.com"))
    smtp_port = getattr(settings, "SMTP_PORT", int(os.getenv("SMTP_PORT", "587")))
    smtp_user = getattr(settings, "SMTP_USER", os.getenv("SMTP_USER", ""))
    smtp_password = getattr(settings, "SMTP_PASSWORD", os.getenv("SMTP_PASSWORD", ""))

    if not smtp_enabled:
        return {
            "status": "disabled",
            "provider": "gmail_smtp",
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "latency_ms": 0,
            "tls": False,
            "error": None,
        }

    start_time = time.time()
    try:
        with smtplib.SMTP(smtp_host, smtp_port, timeout=5) as server:
            server.ehlo()
            server.starttls()
            if smtp_user and smtp_password:
                server.login(smtp_user, smtp_password)
            server.noop()

        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "status": "healthy",
            "provider": "gmail_smtp",
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "latency_ms": latency_ms,
            "tls": True,
            "error": None,
        }
    except Exception as exc:
        latency_ms = int((time.time() - start_time) * 1000)
        return {
            "status": "unhealthy",
            "provider": "gmail_smtp",
            "smtp_host": smtp_host,
            "smtp_port": smtp_port,
            "latency_ms": latency_ms,
            "tls": False,
            "error": f"{type(exc).__name__}: {exc}",
        }


# -- Public API ----------------------------------------------------------------

def send_invitation_email(
    to_email: str,
    invited_name: Optional[str],
    role_level: str,
    accept_url: str,
    expires_at: datetime,
    message: Optional[str] = None,
    job_id: Optional[str] = None,
    correlation_id: Optional[str] = None,
    invitation_id: Optional[int] = None,
) -> Tuple[bool, Optional[str], int]:
    """
    Send an admin team invitation email with retry and structured tracing.
    Returns (success: bool, error_message: str | None, latency_ms: int).
    """
    display_name = invited_name or to_email.split("@")[0]
    role_label = role_level.replace("_", " ").title()
    expiry_str = expires_at.strftime("%B %d, %Y at %H:%M UTC")
    message_block = f"\n\nPersonal message from your admin:\n\"{message}\"\n" if message else ""

    subject = "You've been invited to join Lumora Admin"

    text_body = f"""Hi {display_name},

You have been invited to join the Lumora Admin Platform as {role_label}.
{message_block}
Accept your invitation before it expires on {expiry_str}:

{accept_url}

This link is single-use and expires in 48 hours.
If you did not expect this invitation, you can safely ignore this email.

- The Lumora Team
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family: system-ui, -apple-system, sans-serif; background: #FAF5FF; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background: #fff; border-radius: 20px;
              padding: 40px; box-shadow: 0 4px 24px rgba(90,30,126,0.10);
              border: 1px solid rgba(196,148,230,0.25);">

    <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 32px;">
      <div style="width: 36px; height: 36px; border-radius: 10px;
                  background: linear-gradient(135deg,#7B3FA0,#5A1E7E);
                  display: flex; align-items: center; justify-content: center;
                  color: #fff; font-weight: 800; font-size: 1rem;">L</div>
      <div>
        <div style="font-size: 1.1rem; font-weight: 700; color: #2D004D;">Lumora</div>
        <div style="font-size: 0.6rem; font-weight: 700; color: #7B3FA0;
                    text-transform: uppercase; letter-spacing: 0.06em;">Admin Portal</div>
      </div>
    </div>

    <h1 style="color: #2D004D; font-size: 1.4rem; font-weight: 700; margin: 0 0 8px;">
      You've been invited!
    </h1>
    <p style="color: #7B3FA0; font-size: 0.9rem; margin: 0 0 20px;">
      Hi <strong>{display_name}</strong>, you've been invited to join the Lumora Admin
      Platform as <strong>{role_label}</strong>.
    </p>

    {"<div style='background: rgba(123,63,160,0.06); border-left: 3px solid #7B3FA0; border-radius: 6px; padding: 12px 16px; margin-bottom: 20px; color: #5A1E7E; font-size: 0.85rem; font-style: italic;'>" + message + "</div>" if message else ""}

    <a href="{accept_url}"
       style="display: inline-block; padding: 14px 32px; border-radius: 12px;
              background: linear-gradient(135deg,#7B3FA0,#5A1E7E); color: #fff;
              font-weight: 700; font-size: 0.95rem; text-decoration: none;
              margin-bottom: 24px;">
      Accept Invitation
    </a>

    <p style="color: #8E6AA8; font-size: 0.78rem; margin: 0 0 8px;">
      Or copy this link into your browser:
    </p>
    <div style="background: rgba(123,63,160,0.05); border: 1px solid rgba(196,148,230,0.3);
                border-radius: 8px; padding: 10px 14px; font-family: monospace;
                font-size: 0.72rem; word-break: break-all; color: #2D004D; margin-bottom: 24px;">
      {accept_url}
    </div>

    <p style="color: #8E6AA8; font-size: 0.75rem; margin: 0;">
      This link expires on <strong>{expiry_str}</strong>. It is single-use - once accepted,
      it cannot be reused. If you did not expect this invitation, ignore this email.
    </p>
  </div>
</body>
</html>"""

    return _send_raw_with_retry(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
        job_id=job_id,
        correlation_id=correlation_id,
        invitation_id=invitation_id,
    )


def send_verification_email(
    to_email: str,
    user_name: Optional[str] = None,
    role: str = "customer",
    verification_url: str = "",
) -> Tuple[bool, Optional[str], int]:
    """
    Send a production-grade branded HTML email verification link.
    """
    display_name = user_name or to_email.split("@")[0]
    role_label = (role or "customer").replace("_", " ").title()

    subject = f"Verify your Lumora {role_label} Account"

    text_body = f"""Hello {display_name},

Thank you for registering your {role_label} account with Lumora.
Please follow the link below to verify your email address and activate your account:

{verification_url}

If you did not request this email, you can safely ignore it.

Thanks,
The Lumora Team
https://lumora.design
"""

    html_body = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email — Lumora</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #F8F5FB; margin: 0; padding: 40px 16px;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 24px; padding: 44px 36px; box-shadow: 0 10px 40px rgba(75, 20, 110, 0.08); border: 1px solid rgba(196, 181, 253, 0.30);">
    
    <!-- Lumora Logo Header -->
    <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 32px;">
      <div style="width: 42px; height: 42px; border-radius: 12px; background: linear-gradient(135deg, #7B3FA0, #5A1E7E); display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 900; font-size: 1.2rem; box-shadow: 0 4px 14px rgba(90, 30, 126, 0.35);">L</div>
      <div>
        <div style="font-size: 1.3rem; font-weight: 700; color: #2D004D; letter-spacing: -0.02em;">Lumora</div>
        <div style="font-size: 0.65rem; font-weight: 800; color: #7B3FA0; text-transform: uppercase; letter-spacing: 0.08em;">{role_label} Account Verification</div>
      </div>
    </div>

    <!-- Main Heading -->
    <h1 style="color: #2D004D; font-size: 1.6rem; font-weight: 700; margin: 0 0 12px; letter-spacing: -0.02em;">
      Verify Your Email Address
    </h1>

    <p style="color: #4A3B58; font-size: 0.95rem; line-height: 1.6; margin: 0 0 28px;">
      Hello <strong>{display_name}</strong>,<br>
      Thank you for registering your <strong>{role_label}</strong> account with Lumora. Please click the button below to verify your email address and unlock full dashboard access.
    </p>

    <!-- Verification Button -->
    <div style="text-align: center; margin: 36px 0;">
      <a href="{verification_url}" style="display: inline-block; padding: 15px 38px; border-radius: 14px; background: linear-gradient(135deg, #7B3FA0, #5A1E7E); color: #ffffff; font-weight: 700; font-size: 1rem; text-decoration: none; box-shadow: 0 6px 20px rgba(90, 30, 126, 0.30);">
        Verify Email Address
      </a>
    </div>

    <!-- Link Backup Box -->
    <p style="color: #7B6B8A; font-size: 0.8rem; margin: 28px 0 8px;">
      If the button above does not work, copy and paste this link into your browser:
    </p>
    <div style="background: rgba(123, 63, 160, 0.04); border: 1px solid rgba(196, 181, 253, 0.40); border-radius: 10px; padding: 12px 16px; font-family: monospace; font-size: 0.76rem; word-break: break-all; color: #4A1E6E; margin-bottom: 28px; line-height: 1.4;">
      {verification_url}
    </div>

    <!-- Security Note & Sign-Off -->
    <div style="border-top: 1px solid rgba(196, 181, 253, 0.20); padding-top: 24px; margin-top: 24px;">
      <p style="color: #9A89AB; font-size: 0.78rem; line-height: 1.5; margin: 0 0 16px;">
        If you did not create a Lumora account, you can safely ignore this email.
      </p>
      <p style="color: #2D004D; font-size: 0.88rem; font-weight: 700; margin: 0;">
        Warm regards,<br>
        <span style="color: #7B3FA0;">The Lumora Team</span>
      </p>
    </div>

  </div>
</body>
</html>"""

    return _send_raw_with_retry(
        to_email=to_email,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )
