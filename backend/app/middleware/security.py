"""
Security middleware untuk FastAPI
"""
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
import time
import logging
import asyncio

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Middleware untuk menambahkan security headers"""
    
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        
        # Security Headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'self'"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
        
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
            response = await call_next(request)
            elapsed = time.time() - start_time
            
            # Log request yang lambat
            if elapsed > 10:  # Lebih dari 10 detik
                logger.warning(
                    f"Slow request: {request.method} {request.url.path} took {elapsed:.2f}s"
                )
            
            return response
        except asyncio.TimeoutError:
            logger.error(f"Request timeout: {request.method} {request.url.path}")
            return JSONResponse(
                status_code=504,
                content={"detail": "Request timeout"}
            )

