"""
Utility functions untuk keamanan
"""
import os
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# Konstanta keamanan
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "500")) * 1024 * 1024  # 100MB default
ALLOWED_MIME_TYPES = ["application/pdf"]
ALLOWED_EXTENSIONS = [".pdf"]


def validate_file_size(file_size: int) -> bool:
    """Validasi ukuran file"""
    if file_size > MAX_FILE_SIZE:
        logger.warning(f"File size {file_size} exceeds maximum {MAX_FILE_SIZE}")
        return False
    if file_size == 0:
        logger.warning("Empty file uploaded")
        return False
    return True


def validate_file_extension(filename: str) -> bool:
    """Validasi ekstensi file"""
    if not filename:
        return False
    
    file_ext = Path(filename).suffix.lower()
    return file_ext in ALLOWED_EXTENSIONS


def validate_file_content(file_path: str) -> bool:
    """Validasi konten file menggunakan magic bytes (lebih aman dari ekstensi)"""
    try:
        import magic
        # Gunakan python-magic untuk deteksi MIME type yang sebenarnya
        mime = magic.Magic(mime=True)
        detected_mime = mime.from_file(file_path)
        
        if detected_mime not in ALLOWED_MIME_TYPES:
            logger.warning(f"Invalid MIME type detected: {detected_mime}")
            return False
        
        return True
    except ImportError:
        # Fallback jika python-magic tidak tersedia
        logger.warning("python-magic not available, using fallback validation")
        # Baca beberapa bytes pertama untuk basic validation
        try:
            with open(file_path, 'rb') as f:
                header = f.read(4)
                # PDF files start with %PDF
                if header[:4] != b'%PDF':
                    logger.warning("File does not appear to be a valid PDF")
                    return False
            return True
        except Exception as e:
            logger.error(f"Error reading file header: {e}")
            return False
    except Exception as e:
        logger.error(f"Error validating file content: {e}")
        return False


def sanitize_filename(filename: str) -> str:
    """Sanitize filename untuk mencegah path traversal"""
    # Hapus path components yang berbahaya
    filename = os.path.basename(filename)
    
    # Hapus karakter berbahaya
    dangerous_chars = ['..', '/', '\\', '\x00']
    for char in dangerous_chars:
        filename = filename.replace(char, '')
    
    # Batasi panjang filename
    max_length = 255
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[:max_length - len(ext)] + ext
    
    return filename


def get_safe_file_path(base_dir: str, filename: str, prefix: str = "") -> str:
    """Generate safe file path dengan validasi"""
    sanitized = sanitize_filename(filename)
    
    if prefix:
        sanitized = f"{prefix}_{sanitized}"
    
    # Pastikan path tetap dalam base_dir (prevent path traversal)
    safe_path = os.path.join(base_dir, sanitized)
    abs_base = os.path.abspath(base_dir)
    abs_path = os.path.abspath(safe_path)
    
    if not abs_path.startswith(abs_base):
        raise ValueError("Path traversal detected")
    
    return safe_path

