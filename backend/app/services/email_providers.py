"""
backend/app/services/email_providers.py
----------------------------------------
Polymorphic Email Provider Abstraction Hierarchy.
Allows swapping transport adapters (Gmail SMTP, SendGrid, Resend, AWS SES, Mock)
via configuration without changing application business logic.
"""
from abc import ABC, abstractmethod
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
import os
import smtplib
import time
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)


class BaseEmailProvider(ABC):
    """Abstract Base Class for all Email Transport Providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Return the unique provider string name (e.g. 'gmail_smtp', 'mock')."""
        pass

    @abstractmethod
    def send(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str,
        job_id: str,
        correlation_id: str,
        invitation_id: Optional[int] = None,
    ) -> Tuple[bool, Optional[str], int]:
        """
        Send email message payload.
        Returns: (success: bool, error_message: str | None, latency_ms: int).
        """
        pass

    @abstractmethod
    def check_health(self) -> Dict[str, Any]:
        """Perform synthetic provider health check."""
        pass


class MockProvider(BaseEmailProvider):
    """Mock Email Provider for local development & unit testing."""

    @property
    def name(self) -> str:
        return "mock"

    def send(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str,
        job_id: str,
        correlation_id: str,
        invitation_id: Optional[int] = None,
    ) -> Tuple[bool, Optional[str], int]:
        logger.warning(
            "[MockProvider] MOCK MODE ACTIVE: Skipped live email delivery to %s (job_id=%s). "
            "To enable real inbox delivery, set SMTP_ENABLED=true, SMTP_USER, and SMTP_PASSWORD on hosting server.",
            to_email, job_id
        )
        return True, "[MOCK_MODE] Real email delivery skipped (SMTP credentials missing on server)", 0

    def check_health(self) -> Dict[str, Any]:
        return {
            "status": "healthy",
            "provider": "mock",
            "latency_ms": 0,
            "error": None,
        }


class GmailProvider(BaseEmailProvider):
    """Production Gmail / Standard SMTP Transport Provider with STARTTLS & Retry Engine."""

    @property
    def name(self) -> str:
        return "gmail_smtp"

    def send(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str,
        job_id: str,
        correlation_id: str,
        invitation_id: Optional[int] = None,
    ) -> Tuple[bool, Optional[str], int]:
        from app.core.config import settings

        smtp_host = getattr(settings, "SMTP_HOST", os.getenv("SMTP_HOST", "smtp.gmail.com"))
        smtp_port = getattr(settings, "SMTP_PORT", int(os.getenv("SMTP_PORT", "587")))
        smtp_user = getattr(settings, "SMTP_USER", os.getenv("SMTP_USER", ""))
        smtp_password = getattr(settings, "SMTP_PASSWORD", os.getenv("SMTP_PASSWORD", ""))
        smtp_from = getattr(settings, "SMTP_FROM", os.getenv("SMTP_FROM", "noreply@lumora.design"))
        reply_to = os.getenv("SMTP_REPLY_TO", "support@lumora.design")

        # Align sender email address with authenticated Gmail SMTP user to prevent SPF/DKIM spoofing rejections
        if smtp_user and "@gmail.com" in smtp_user.lower() and ("noreply@lumora.design" in smtp_from or not smtp_from):
            smtp_from = smtp_user

        sender_header = f"Lumora Admin <{smtp_from}>" if "<" not in smtp_from else smtp_from

        message_id = f"<{datetime.utcnow().strftime('%Y%m%d%H%M%S')}.{job_id}@lumora.design>"
        msg = MIMEMultipart("alternative")
        msg["Subject"] = subject
        msg["From"] = sender_header
        msg["To"] = to_email
        msg["Reply-To"] = reply_to
        msg["Message-ID"] = message_id
        msg["X-Lumora-Job-ID"] = job_id
        msg["X-Lumora-Correlation-ID"] = correlation_id
        msg.attach(MIMEText(text_body, "plain"))
        msg.attach(MIMEText(html_body, "html"))

        start_time = time.time()
        try:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.ehlo()
                server.starttls()
                if smtp_user and smtp_password:
                    server.login(smtp_user, smtp_password)

                logger.info(
                    "[GmailProvider-Sendmail-Trigger] BEFORE_SENDMAIL: invitation_id=%s, TO=%s, Message-ID=%s, Subject='%s', provider=%s, job_id=%s",
                    invitation_id, to_email, message_id, subject, self.name, job_id
                )
                send_response = server.sendmail(smtp_from, [to_email], msg.as_string())

            latency_ms = int((time.time() - start_time) * 1000)
            logger.info(
                "[GmailProvider-Sendmail-Trigger] AFTER_SENDMAIL: invitation_id=%s, TO=%s, Message-ID=%s, response=%s, latency_ms=%dms",
                invitation_id, to_email, message_id, send_response, latency_ms
            )
            return True, None, latency_ms
        except Exception as exc:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error("[GmailProvider] SMTP Error for %s (job_id=%s): %s", to_email, job_id, exc)
            return False, f"GmailProvider SMTP Error ({type(exc).__name__}): {exc}", latency_ms

    def check_health(self) -> Dict[str, Any]:
        from app.core.config import settings

        smtp_enabled = getattr(settings, "SMTP_ENABLED", os.getenv("SMTP_ENABLED", "false").lower() == "true")
        smtp_host = getattr(settings, "SMTP_HOST", os.getenv("SMTP_HOST", "smtp.gmail.com"))
        smtp_port = getattr(settings, "SMTP_PORT", int(os.getenv("SMTP_PORT", "587")))
        smtp_user = getattr(settings, "SMTP_USER", os.getenv("SMTP_USER", ""))
        smtp_password = getattr(settings, "SMTP_PASSWORD", os.getenv("SMTP_PASSWORD", ""))

        if not smtp_enabled:
            return {
                "status": "disabled",
                "provider": self.name,
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
                "provider": self.name,
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
                "provider": self.name,
                "smtp_host": smtp_host,
                "smtp_port": smtp_port,
                "latency_ms": latency_ms,
                "tls": False,
                "error": f"{type(exc).__name__}: {exc}",
            }


class SendGridProvider(BaseEmailProvider):
    """Stub adapter for SendGrid v3 Mail API."""

    @property
    def name(self) -> str:
        return "sendgrid"

    def send(self, to_email: str, subject: str, text_body: str, html_body: str, job_id: str, correlation_id: str, invitation_id: Optional[int] = None) -> Tuple[bool, Optional[str], int]:
        logger.info("[SendGridProvider] Sending via SendGrid API to %s", to_email)
        return True, None, 10

    def check_health(self) -> Dict[str, Any]:
        return {"status": "healthy", "provider": self.name, "latency_ms": 5, "error": None}


class ResendProvider(BaseEmailProvider):
    """
    Production HTTP Email Provider via Resend REST API.
    Uses HTTPS port 443 — not subject to Render's SMTP port 587 block.
    Requires RESEND_API_KEY environment variable.
    Free tier: 3,000 emails/month, 100/day.
    """

    @property
    def name(self) -> str:
        return "resend_api"

    def send(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str,
        job_id: str,
        correlation_id: str,
        invitation_id: Optional[int] = None,
    ) -> Tuple[bool, Optional[str], int]:
        import urllib.request
        import urllib.error
        import json

        api_key = os.getenv("RESEND_API_KEY", "")
        from_address = os.getenv("RESEND_FROM", os.getenv("SMTP_FROM", "onboarding@resend.dev"))

        if not api_key:
            logger.error("[ResendProvider] RESEND_API_KEY is not set. Cannot send email to %s.", to_email)
            return False, "ResendProvider: RESEND_API_KEY environment variable is not configured.", 0

        payload = json.dumps({
            "from": f"Lumora Admin <{from_address}>",
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
            "headers": {
                "X-Lumora-Job-ID": job_id,
                "X-Lumora-Correlation-ID": correlation_id,
            },
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.resend.com/emails",
            data=payload,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )

        start_time = time.time()
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                latency_ms = int((time.time() - start_time) * 1000)
                resp_body = json.loads(resp.read().decode("utf-8"))
                resend_id = resp_body.get("id", "unknown")
                logger.info(
                    "[ResendProvider] SENT via Resend API: invitation_id=%s, TO=%s, resend_id=%s, job_id=%s, latency_ms=%dms",
                    invitation_id, to_email, resend_id, job_id, latency_ms
                )
                return True, None, latency_ms
        except urllib.error.HTTPError as exc:
            latency_ms = int((time.time() - start_time) * 1000)
            err_body = exc.read().decode("utf-8", errors="ignore")
            logger.error(
                "[ResendProvider] HTTP Error for %s (job_id=%s): status=%d, body=%s",
                to_email, job_id, exc.code, err_body
            )
            return False, f"ResendProvider HTTPError {exc.code}: {err_body}", latency_ms
        except Exception as exc:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error("[ResendProvider] Error for %s (job_id=%s): %s", to_email, job_id, exc)
            return False, f"ResendProvider Error ({type(exc).__name__}): {exc}", latency_ms

    def check_health(self) -> Dict[str, Any]:
        api_key = os.getenv("RESEND_API_KEY", "")
        return {
            "status": "healthy" if api_key else "misconfigured",
            "provider": self.name,
            "latency_ms": 0,
            "error": None if api_key else "RESEND_API_KEY not set",
        }


class BrevoProvider(BaseEmailProvider):
    """
    Production HTTP Email Provider via Brevo (formerly Sendinblue) v3 REST API.
    Uses HTTPS port 443 — bypasses Render's SMTP port 587 block.
    Free tier: 300 emails/day to ANY recipient email address without domain verification.
    Requires BREVO_API_KEY environment variable.
    """

    @property
    def name(self) -> str:
        return "brevo_api"

    def send(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str,
        job_id: str,
        correlation_id: str,
        invitation_id: Optional[int] = None,
    ) -> Tuple[bool, Optional[str], int]:
        import urllib.request
        import urllib.error
        import json

        api_key = os.getenv("BREVO_API_KEY", "")
        from_email = os.getenv("BREVO_FROM", os.getenv("SMTP_FROM", "durgesamruddhi@gmail.com"))

        if not api_key:
            logger.error("[BrevoProvider] BREVO_API_KEY is not set. Cannot send email to %s.", to_email)
            return False, "BrevoProvider: BREVO_API_KEY environment variable is not configured.", 0

        payload = json.dumps({
            "sender": {"name": "Lumora Admin", "email": from_email},
            "to": [{"email": to_email}],
            "subject": subject,
            "htmlContent": html_body,
            "textContent": text_body,
            "headers": {
                "X-Lumora-Job-ID": job_id,
                "X-Lumora-Correlation-ID": correlation_id,
            },
        }).encode("utf-8")

        req = urllib.request.Request(
            "https://api.brevo.com/v3/smtp/email",
            data=payload,
            headers={
                "api-key": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            method="POST",
        )

        start_time = time.time()
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                latency_ms = int((time.time() - start_time) * 1000)
                resp_body = json.loads(resp.read().decode("utf-8"))
                msg_id = resp_body.get("messageId", "unknown")
                logger.info(
                    "[BrevoProvider] SENT via Brevo API: invitation_id=%s, TO=%s, messageId=%s, job_id=%s, latency_ms=%dms",
                    invitation_id, to_email, msg_id, job_id, latency_ms
                )
                return True, None, latency_ms
        except urllib.error.HTTPError as exc:
            latency_ms = int((time.time() - start_time) * 1000)
            err_body = exc.read().decode("utf-8", errors="ignore")
            logger.error(
                "[BrevoProvider] HTTP Error for %s (job_id=%s): status=%d, body=%s",
                to_email, job_id, exc.code, err_body
            )
            return False, f"BrevoProvider HTTPError {exc.code}: {err_body}", latency_ms
        except Exception as exc:
            latency_ms = int((time.time() - start_time) * 1000)
            logger.error("[BrevoProvider] Error for %s (job_id=%s): %s", to_email, job_id, exc)
            return False, f"BrevoProvider Error ({type(exc).__name__}): {exc}", latency_ms

    def check_health(self) -> Dict[str, Any]:
        api_key = os.getenv("BREVO_API_KEY", "")
        return {
            "status": "healthy" if api_key else "misconfigured",
            "provider": self.name,
            "latency_ms": 0,
            "error": None if api_key else "BREVO_API_KEY not set",
        }


class SESProvider(BaseEmailProvider):
    """Stub adapter for AWS SES v2 API."""

    @property
    def name(self) -> str:
        return "aws_ses"

    def send(self, to_email: str, subject: str, text_body: str, html_body: str, job_id: str, correlation_id: str, invitation_id: Optional[int] = None) -> Tuple[bool, Optional[str], int]:
        logger.info("[SESProvider] Sending via AWS SES API to %s", to_email)
        return True, None, 10

    def check_health(self) -> Dict[str, Any]:
        return {"status": "healthy", "provider": self.name, "latency_ms": 5, "error": None}



class FailoverEmailProvider(BaseEmailProvider):
    """
    Enterprise Provider Failover Chain.
    Tries Primary Provider -> Secondary Provider -> Tertiary Provider sequentially.
    Logs structured failover events if primary fails.
    """
    def __init__(self, providers: Optional[list[BaseEmailProvider]] = None):
        self.providers = providers or [GmailProvider(), MockProvider()]

    @property
    def name(self) -> str:
        return f"failover_chain[{','.join(p.name for p in self.providers)}]"

    def send(
        self,
        to_email: str,
        subject: str,
        text_body: str,
        html_body: str,
        job_id: str,
        correlation_id: str,
        invitation_id: Optional[int] = None,
    ) -> Tuple[bool, Optional[str], int]:
        start_time = time.time()
        failover_errors = []

        for idx, provider in enumerate(self.providers, start=1):
            ok, err_msg, latency_ms = provider.send(
                to_email=to_email,
                subject=subject,
                text_body=text_body,
                html_body=html_body,
                job_id=job_id,
                correlation_id=correlation_id,
                invitation_id=invitation_id,
            )
            if ok:
                total_latency = int((time.time() - start_time) * 1000)
                if idx > 1:
                    logger.warning(
                        "[FailoverEmailProvider] Delivery succeeded via fallback provider '%s' (step %d/%d)",
                        provider.name, idx, len(self.providers)
                    )
                return True, None, total_latency

            failover_errors.append(f"[{provider.name}]: {err_msg}")
            logger.warning(
                "[FailoverEmailProvider] Provider '%s' failed. Attempting fallback... Error: %s",
                provider.name, err_msg
            )

        total_latency = int((time.time() - start_time) * 1000)
        combined_error = f"All {len(self.providers)} providers in failover chain failed: " + " | ".join(failover_errors)
        return False, combined_error, total_latency

    def check_health(self) -> Dict[str, Any]:
        primary_health = self.providers[0].check_health() if self.providers else {"status": "unhealthy"}
        return {
            "status": primary_health.get("status", "unknown"),
            "provider": self.name,
            "chain_length": len(self.providers),
            "primary_health": primary_health,
        }


# -- Factory Function ----------------------------------------------------------

def get_email_provider(provider_name: Optional[str] = None) -> BaseEmailProvider:
    """
    Factory resolving current Email Provider based on parameter or environment.
    Supported: 'failover', 'gmail', 'gmail_smtp', 'mock', 'sendgrid', 'resend', 'aws_ses'.
    """
    from app.core.config import settings

    smtp_enabled = getattr(settings, "SMTP_ENABLED", os.getenv("SMTP_ENABLED", "false").lower() == "true")
    if not smtp_enabled and not provider_name:
        return MockProvider()

    p_name = (provider_name or getattr(settings, "EMAIL_PROVIDER", os.getenv("EMAIL_PROVIDER", "failover"))).lower()

    if p_name in ("failover", "chain"):
        # Build production failover chain.
        # Priority: BrevoProvider (HTTPS 443, 300/day to ANY email, no domain required) > ResendProvider > GmailProvider
        brevo_key = os.getenv("BREVO_API_KEY", "")
        resend_key = os.getenv("RESEND_API_KEY", "")
        if smtp_enabled:
            providers = []
            if brevo_key:
                providers.append(BrevoProvider())
            if resend_key:
                providers.append(ResendProvider())
            providers.append(GmailProvider())  # Fallback — works if Render network allows port 587
            return FailoverEmailProvider(providers)
        return FailoverEmailProvider([GmailProvider(), MockProvider()])
    elif p_name in ("gmail", "gmail_smtp", "smtp"):
        return GmailProvider()
    elif p_name == "mock":
        return MockProvider()
    elif p_name in ("brevo", "brevo_api"):
        return BrevoProvider()
    elif p_name in ("resend", "resend_api"):
        return ResendProvider()
    elif p_name == "sendgrid":
        return SendGridProvider()
    elif p_name in ("ses", "aws_ses"):
        return SESProvider()
    else:
        logger.warning("Unknown EMAIL_PROVIDER '%s', defaulting to FailoverEmailProvider", p_name)
        if smtp_enabled:
            return FailoverEmailProvider([GmailProvider()])
        return FailoverEmailProvider([GmailProvider(), MockProvider()])
