# app/payments/webhooks/__init__.py
from app.payments.webhooks.interface import WebhookHandler, WebhookEvent

__all__ = ["WebhookHandler", "WebhookEvent"]
