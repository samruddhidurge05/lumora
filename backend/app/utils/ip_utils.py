"""
ip_utils.py
───────────
Production-grade, proxy-aware client IP extraction and User-Agent parsing utilities.
"""

from typing import Optional, Tuple
from fastapi import Request


def get_client_ip(request: Optional[Request]) -> str:
    """
    Extract the production-safe public client IP address.

    Order of precedence:
      1. CF-Connecting-IP (Cloudflare Edge Proxy)
      2. X-Forwarded-For (First IP in multi-proxy chain)
      3. X-Real-IP (Vercel / Render Reverse Proxy)
      4. request.client.host (Direct socket fallback)
    """
    if not request:
        return "Not Available"

    try:
        # 1. Cloudflare edge header
        cf_ip = request.headers.get("CF-Connecting-IP")
        if cf_ip and cf_ip.strip():
            return cf_ip.strip()

        # 2. Standard proxy header (client, proxy1, proxy2)
        xfwd = request.headers.get("X-Forwarded-For")
        if xfwd and xfwd.strip():
            first_ip = xfwd.split(",")[0].strip()
            if first_ip and first_ip.lower() not in ("unknown", "null"):
                return first_ip

        # 3. Nginx / Vercel / Render real IP
        xreal = request.headers.get("X-Real-IP")
        if xreal and xreal.strip():
            return xreal.strip()

        # 4. Direct socket client host
        if request.client and request.client.host:
            host = request.client.host.strip()
            if host and host not in ("127.0.0.1", "localhost", "::1"):
                return host

    except Exception:
        pass

    return "Not Available"


def parse_user_agent(user_agent: Optional[str]) -> Tuple[str, str]:
    """
    Parse User-Agent string into (device_type, browser).
    Returns ("Desktop", "Chrome") defaults if unparsed.
    """
    if not user_agent or not isinstance(user_agent, str):
        return ("Desktop", "Chrome")

    ua_lower = user_agent.lower()

    # Device detection
    if any(k in ua_lower for k in ("iphone", "android", "mobile", "ipod", "blackberry")):
        device = "Mobile"
    elif any(k in ua_lower for k in ("ipad", "tablet", "kindle")):
        device = "Tablet"
    else:
        device = "Desktop"

    # Browser detection
    if "edg/" in ua_lower or "edge/" in ua_lower:
        browser = "Edge"
    elif "opera" in ua_lower or "opr/" in ua_lower:
        browser = "Opera"
    elif "chrome" in ua_lower or "crios" in ua_lower:
        browser = "Chrome"
    elif "firefox" in ua_lower or "fxios" in ua_lower:
        browser = "Firefox"
    elif "safari" in ua_lower:
        browser = "Safari"
    else:
        browser = "Chrome"

    return (device, browser)
