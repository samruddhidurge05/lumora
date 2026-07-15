"""
app/services/email_service.py
──────────────────────────────
Thin SMTP / SendGrid email delivery service.

Environment variables:
    SMTP_ENABLED=true|false          (default: false — skips delivery in local dev)
    SMTP_HOST=smtp.sendgrid.net
    SMTP_PORT=587
    SMTP_USER=apikey
    SMTP_PASSWORD=<sendgrid_api_key>
    SMTP_FROM=noreply@lumora.design

All methods return bool (True = success) and NEVER raise — callers decide
whether to surface failures to the user.
"""
from __future__ import annotations

import logging
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from typing import Optional

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────────────────────

_SMTP_ENABLED  = os.getenv("SMTP_ENABLED", "false").lower() == "true"
_SMTP_HOST     = os.getenv("SMTP_HOST", "smtp.sendgrid.net")
_SMTP_PORT     = int(os.getenv("SMTP_PORT", "587"))
_SMTP_USER     = os.getenv("SMTP_USER", "")
_SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
_SMTP_FROM     = os.getenv("SMTP_FROM", "noreply@lumora.design")


def _send_raw(to_email: str, subject: str, text_body: str, html_body: str) -> bool:
    """Low-level SMTP send. Returns True on success, False on any failure."""
    if not _SMTP_ENABLED:
        logger.debug("[email_service] SMTP disabled — would send '%s' to %s", subject, to_email)
        return True

    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"]    = _SMTP_FROM
        msg["To"]      = to_email
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        with smtplib.SMTP(_SMTP_HOST, _SMTP_PORT, timeout=8) as server:
            server.ehlo()
            server.starttls()
            if _SMTP_USER and _SMTP_PASSWORD:
                server.login(_SMTP_USER, _SMTP_PASSWORD)
            server.sendmail(_SMTP_FROM, [to_email], msg.as_string())

        logger.info("[email_service] Sent '%s' to %s", subject, to_email)
        return True

    except Exception as exc:
        logger.error("[email_service] Failed to send '%s' to %s: %s", subject, to_email, exc)
        return False


# ── Public API ────────────────────────────────────────────────────────────────

def send_invitation_email(
    to_email: str,
    invited_name: Optional[str],
    role_level: str,
    accept_url: str,
    expires_at: datetime,
    message: Optional[str] = None,
) -> bool:
    """
    Send an admin team invitation email.

    Returns True on success (or when SMTP is disabled).
    Returns False on SMTP delivery failure.
    """
    display_name  = invited_name or to_email.split("@")[0]
    role_label    = role_level.replace("_", " ").title()
    expiry_str    = expires_at.strftime("%B %d, %Y at %H:%M UTC")
    message_block = f"\n\nPersonal message from your admin:\n\"{message}\"\n" if message else ""

    subject = "You've been invited to join Lumora Admin"

    text_body = f"""Hi {display_name},

You have been invited to join the Lumora Admin Platform as {role_label}.
{message_block}
Accept your invitation before it expires on {expiry_str}:

{accept_url}

This link is single-use and expires in 48 hours.
If you did not expect this invitation, you can safely ignore this email.

— The Lumora Team
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
      This link expires on <strong>{expiry_str}</strong>. It is single-use — once accepted,
      it cannot be reused. If you did not expect this invitation, ignore this email.
    </p>
  </div>
</body>
</html>"""

    return _send_raw(to_email, subject, text_body, html_body)
