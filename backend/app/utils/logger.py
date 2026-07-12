import json
import logging
import re
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger("lumora.structured")

_EMAIL_REGEX = re.compile(r"[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+")
_PHONE_REGEX = re.compile(r"\b(?:\+?\d{1,3}[- ]?)?\d{10}\b")
_AADHAAR_REGEX = re.compile(r"\b\d{4}\s?\d{4}\s?\d{4}\b")
_PAN_REGEX = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]{1}\b")

def mask_sensitive_value(text: str) -> str:
    if not isinstance(text, str):
        return text
    # Mask emails
    def _mask_email(match):
        email = match.group(0)
        try:
            local, domain = email.split("@", 1)
            if len(local) <= 2:
                masked_local = local[0] + "*" * (len(local) - 1)
            else:
                masked_local = local[0] + "*" * (len(local) - 2) + local[-1]
            return f"{masked_local}@{domain}"
        except Exception:
            return "******@*******.***"
            
    text = _EMAIL_REGEX.sub(_mask_email, text)
    
    # Mask Aadhaar
    text = _AADHAAR_REGEX.sub("XXXX-XXXX-XXXX", text)
    
    # Mask PAN
    text = _PAN_REGEX.sub("XXXXX0000X", text)
    
    # Mask Phone Numbers (keep last 4 digits)
    def _mask_phone(match):
        phone = match.group(0).replace(" ", "").replace("-", "")
        return "******" + phone[-4:]
    text = _PHONE_REGEX.sub(_mask_phone, text)
    
    return text

def mask_dict(d: Any) -> Any:
    if isinstance(d, dict):
        new_dict = {}
        for k, v in d.items():
            k_lower = k.lower()
            if any(term in k_lower for term in ["password", "token", "jwt", "secret", "cvv", "card", "account", "bank", "pan", "aadhaar", "phone", "email"]):
                new_dict[k] = "[MASKED]"
            else:
                new_dict[k] = mask_dict(v)
        return new_dict
    elif isinstance(d, list):
        return [mask_dict(item) for item in d]
    elif isinstance(d, str):
        return mask_sensitive_value(d)
    return d

def log_structured_event(
    user_id: Optional[int],
    role: Optional[str],
    action: str,
    module: str,
    status: str = "success",
    ip_address: Optional[str] = None,
    details: Optional[str] = None,
    metadata: Optional[dict] = None
) -> None:
    """
    Format and output a structured JSON log message for production ingestion.
    Automatically masks personal data fields.
    """
    masked_details = mask_sensitive_value(details or "")
    masked_metadata = mask_dict(metadata) if metadata else None

    log_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "user_id": user_id,
        "role": role or "anonymous",
        "action": action,
        "module": module,
        "status": status,
        "ip_address": ip_address or "0.0.0.0",
        "details": masked_details,
    }
    if masked_metadata:
        log_data["metadata"] = masked_metadata

    # Print to stdout/stderr so that uvicorn/systemd/docker/k8s captures it
    logger.info(json.dumps(log_data))
