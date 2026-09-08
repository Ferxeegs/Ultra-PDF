"""
Security middleware untuk FastAPI
"""

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware
import logging
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
