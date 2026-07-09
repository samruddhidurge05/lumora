import json
import logging
from datetime import datetime
from typing import Any, Optional

logger = logging.getLogger("lumora.structured")

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
    """
    log_data = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "user_id": user_id,
        "role": role or "anonymous",
        "action": action,
        "module": module,
        "status": status,
        "ip_address": ip_address or "0.0.0.0",
        "details": details or "",
    }
    if metadata:
        log_data["metadata"] = metadata

    # Print to stdout/stderr so that uvicorn/systemd/docker/k8s captures it
    logger.info(json.dumps(log_data))
