"""
Security middleware untuk FastAPI
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time
import logging
import asyncio
import os

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware untuk menambahkan security headers"""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Ambil konfigurasi lingkungan (default ke development jika tidak ada)
        env = os.getenv("ENV", "development")

        # Konfigurasi Content Security Policy (CSP)
        if env == "development":
            # Izinkan CDN yang dibutuhkan oleh Swagger UI (FastAPI Docs)
            csp_rules = (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; "
                "img-src 'self' data: https://fastapi.tiangolo.com; "
                "frame-src 'self';"
            )
        else:
            # Mode Production: Tetap sangat ketat
            csp_rules = "default-src 'self'"

        # Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
        response.headers["Content-Security-Policy"] = csp_rules
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = (
            "geolocation=(), microphone=(), camera=()"
        )

        # Remove server header untuk menyembunyikan teknologi yang digunakan
        if "server" in response.headers:
            del response.headers["server"]

        return response


class RequestTimeoutMiddleware(BaseHTTPMiddleware):
    """Middleware untuk timeout request"""

    def __init__(self, app, timeout: int = 300):  # 5 menit default
        super().__init__(app)
        self.timeout = timeout

    async def dispatch(self, request: Request, call_next):
        start_time = time.time()

        try:
            # Bungkus call_next dengan timeout
            response = await asyncio.wait_for(call_next(request), timeout=self.timeout)
            elapsed = time.time() - start_time

            # Log request yang lambat (> 10 detik)
            if elapsed > 10:
                logger.warning(
                    f"Slow request: {request.method} {request.url.path} took {elapsed:.2f}s"
                )

            return response
        except asyncio.TimeoutError:
            logger.error(f"Request timeout: {request.method} {request.url.path}")
            return JSONResponse(status_code=504, content={"detail": "Request timeout"})
        except Exception as e:
            logger.error(f"Middleware error: {str(e)}")
            raise e