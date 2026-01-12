from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, Form, Request, Depends
from starlette.requests import Request as StarletteRequest
from fastapi.responses import FileResponse
from app.services.pdf_service import PDFService
from app.utils.security import (
    validate_file_size,
    validate_file_extension,
    validate_file_content,
    sanitize_filename,
    get_safe_file_path
)
from app.middleware.rate_limit import limiter
from pydantic import BaseModel, Field
import uuid
import os
import shutil
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

# Folder dari environment atau default
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "outputs")

# Validasi quality input
ALLOWED_QUALITIES = ["low", "medium", "high"]


class QualityInput(BaseModel):
    """Model untuk validasi quality input"""
    quality: str = Field(default="medium", pattern="^(low|medium|high)$")


def remove_file(path: str):
    """Safely remove file dengan error handling"""
    try:
        if os.path.exists(path):
            os.remove(path)
            logger.info(f"File removed: {path}")
    except Exception as e:
        logger.error(f"Error removing file {path}: {e}")


@router.post("/compress")
@limiter.limit("10/minute")  # Rate limit: 10 requests per minute
async def compress_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    quality: str = Form("medium")
):
    """
    Compress PDF file dengan validasi keamanan
    
    - Validasi file size
    - Validasi file extension
    - Validasi file content (MIME type)
    - Rate limiting
    - Sanitized file paths
    """
    
    # Validasi quality
    if quality not in ALLOWED_QUALITIES:
        logger.warning(f"Invalid quality parameter: {quality}")
        raise HTTPException(
            status_code=400,
            detail=f"Quality must be one of: {', '.join(ALLOWED_QUALITIES)}"
        )
    
    # Validasi filename
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    # Validasi ekstensi file
    if not validate_file_extension(file.filename):
        logger.warning(f"Invalid file extension: {file.filename}")
        raise HTTPException(
            status_code=400,
            detail="Only PDF files are allowed"
        )
    
    # Validasi ukuran file - akan dilakukan sambil menyimpan file
    # Jangan gunakan seek(SEEK_END) karena tidak efisien untuk file besar (>100MB)
    # Kita akan validasi ukuran sambil menyimpan file secara streaming
    max_size = int(os.getenv("MAX_FILE_SIZE_MB", "500")) * 1024 * 1024
    
    # Generate safe file paths
    file_id = str(uuid.uuid4())
    sanitized_filename = sanitize_filename(file.filename)
    
    try:
        input_path = get_safe_file_path(UPLOAD_DIR, f"{file_id}.pdf")
        output_path = get_safe_file_path(OUTPUT_DIR, f"compressed_{file_id}.pdf")
    except ValueError as e:
        logger.error(f"Path traversal attempt: {e}")
        raise HTTPException(status_code=400, detail="Invalid filename")
    
    # Simpan file yang diupload - gunakan streaming untuk file besar
    file_size = 0
    try:
        # Reset file pointer (jika file kecil, ini akan bekerja)
        # Untuk file besar, FastAPI akan stream langsung tanpa perlu seek
        try:
            file.file.seek(0)
        except (AttributeError, OSError):
            # Jika seek tidak didukung (file besar), tidak apa-apa, file sudah di posisi awal
            pass
        
        logger.info(f"Starting file upload: {file.filename}")
        
        with open(input_path, "wb") as buffer:
            chunk_size = 1024 * 1024  # 1MB chunks untuk efisiensi
            
            # Baca dan tulis file secara streaming sambil menghitung ukuran
            chunk_count = 0
            while True:
                chunk = file.file.read(chunk_size)
                if not chunk:
                    break
                
                chunk_count += 1
                file_size += len(chunk)
                
                # Log progress setiap 10MB untuk debugging
                if chunk_count % 10 == 0:
                    logger.info(f"Upload progress: {file_size / (1024 * 1024):.2f} MB")
                
                # Cek ukuran sambil membaca untuk early rejection
                if file_size > max_size:
                    buffer.close()
                    if os.path.exists(input_path):
                        os.remove(input_path)
                    logger.warning(f"File size {file_size / (1024*1024):.2f} MB exceeds maximum {max_size / (1024*1024):.2f} MB")
                    raise HTTPException(
                        status_code=413,
                        detail=f"File size ({file_size / (1024*1024):.2f} MB) exceeds maximum limit ({os.getenv('MAX_FILE_SIZE_MB', '500')} MB)"
                    )
                
                buffer.write(chunk)
        
        logger.info(f"File uploaded successfully: {file.filename} ({file_size / (1024 * 1024):.2f} MB)")
        
        # Validasi ukuran file setelah selesai
        if not validate_file_size(file_size):
            if os.path.exists(input_path):
                os.remove(input_path)
            raise HTTPException(
                status_code=413,
                detail=f"File size exceeds maximum limit ({os.getenv('MAX_FILE_SIZE_MB', '500')}MB)"
            )
        
        # Validasi konten file (MIME type detection)
        if not validate_file_content(input_path):
            remove_file(input_path)
            raise HTTPException(
                status_code=400,
                detail="Invalid file content. Only PDF files are allowed"
            )
    except IOError as e:
        logger.error(f"Error saving file: {e}")
        raise HTTPException(status_code=500, detail="Error saving file")
    
    # Proses kompresi
    try:
        success = await PDFService.compress_pdf(input_path, output_path, quality)
        
        if not success:
            remove_file(input_path)
            raise HTTPException(
                status_code=500,
                detail="Failed to compress PDF"
            )
    except Exception as e:
        logger.error(f"Compression error: {e}")
        remove_file(input_path)
        if os.path.exists(output_path):
            remove_file(output_path)
        raise HTTPException(
            status_code=500,
            detail="Error during PDF compression"
        )
    
    # Jadwalkan penghapusan file sementara setelah file dikirim ke user
    background_tasks.add_task(remove_file, input_path)
    background_tasks.add_task(remove_file, output_path)
    
    # Log successful compression
    logger.info(f"PDF compressed successfully: {file.filename} ({file_size} bytes) -> {quality}")
    
    # Mengembalikan file secara langsung sebagai download
    return FileResponse(
        path=output_path,
        filename=f"compressed_{sanitized_filename}",
        media_type="application/pdf"
    )