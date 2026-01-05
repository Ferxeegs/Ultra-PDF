"""
Rate limiting middleware menggunakan slowapi
"""
from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os

# Inisialisasi limiter
limiter = Limiter(key_func=get_remote_address)

# Rate limit configuration dari environment
RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "10"))
RATE_LIMIT_PER_HOUR = int(os.getenv("RATE_LIMIT_PER_HOUR", "100"))

def get_rate_limiter():
    """Get rate limiter instance"""
    return limiter

