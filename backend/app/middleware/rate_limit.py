from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from starlette.requests import Request
from starlette.responses import JSONResponse

limiter = Limiter(key_func=get_remote_address)


async def _rate_limit_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    origin = request.headers.get("origin")
    res = JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please wait a moment before trying again."},
    )
    if origin:
        res.headers["Access-Control-Allow-Origin"] = origin
        res.headers["Access-Control-Allow-Credentials"] = "true"
    return res
