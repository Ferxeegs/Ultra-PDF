from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.api.v1.endpoints import router as api_router
from app.middleware.security import SecurityHeadersMiddleware
from app.middleware.rate_limit import get_rate_limiter
from slowapi.errors import RateLimitExceeded
import os
import logging
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Environment configuration
ENV = os.getenv("ENV", "development")
# Default allowed origins - include production domains
DEFAULT_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000,https://www.ultrapdf.my.id,https://ultrapdf.my.id"
ALLOWED_ORIGINS = [origin.strip() for origin in os.getenv("ALLOWED_ORIGINS", DEFAULT_ORIGINS).split(",")]

app = FastAPI(
    title="UltraPDF Backend API",
    description="Secure PDF compression API",
    version="1.0.0",
    docs_url="/docs" if ENV == "development" else None,  # Disable docs in production
    redoc_url="/redoc" if ENV == "development" else None,  # Disable redoc in production
)

# Initialize rate limiter
limiter = get_rate_limiter()
app.state.limiter = limiter

# Rate limit exception handler
@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    """Handle rate limit exceeded"""
    logger.warning(f"Rate limit exceeded: {request.url} - {request.client.host if request.client else 'unknown'}")
    return JSONResponse(
        status_code=429,
        content={"detail": "Rate limit exceeded. Please try again later."}
    )

# Security Headers Middleware (harus pertama)
app.add_middleware(SecurityHeadersMiddleware)

# CORS Middleware dengan konfigurasi yang lebih ketat
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS if ENV == "production" else ["*"],  # Strict di production
    allow_credentials=True,
    allow_methods=["GET", "POST", "OPTIONS"],  # Tambahkan OPTIONS untuk preflight
    allow_headers=["Content-Type", "Authorization", "X-Requested-With"],  # Tambahkan headers yang diperlukan
    expose_headers=["Content-Disposition"],
    max_age=3600,  # Cache preflight untuk 1 jam
)

# Pastikan direktori penyimpanan ada
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "outputs")
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# Error handlers
@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Custom HTTP exception handler - jangan expose detail error di production"""
    logger.error(f"HTTP {exc.status_code}: {exc.detail} - {request.url}")
    
    # Pastikan CORS headers selalu ada, bahkan untuk error
    response_content = {"detail": exc.detail} if ENV == "development" else {"detail": "An error occurred"}
    
    response = JSONResponse(
        status_code=exc.status_code,
        content=response_content
    )
    
    # Tambahkan CORS headers untuk error response
    origin = request.headers.get("origin")
    if origin and (origin in ALLOWED_ORIGINS or ENV != "production"):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization, X-Requested-With"
    
    return response

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Custom validation error handler"""
    logger.warning(f"Validation error: {exc.errors()} - {request.url}")
    
    response = JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={"detail": "Invalid request data"}
    )
    
    # Tambahkan CORS headers
    origin = request.headers.get("origin")
    if origin and (origin in ALLOWED_ORIGINS or ENV != "production"):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    
    return response

@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {exc} - {request.url}", exc_info=True)
    
    response = JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"}
    )
    
    # Tambahkan CORS headers
    origin = request.headers.get("origin")
    if origin and (origin in ALLOWED_ORIGINS or ENV != "production"):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Credentials"] = "true"
    
    return response

# Include router
app.include_router(api_router, prefix="/api/v1")

@app.get("/")
async def root():
    """Health check endpoint"""
    return {
        "message": "UltraPDF Backend API",
        "status": "running",
        "version": "1.0.0"
    }

@app.get("/health")
async def health_check():
    """Health check untuk monitoring"""
    return {
        "status": "healthy",
        "service": "ultrapdf-backend"
    }
