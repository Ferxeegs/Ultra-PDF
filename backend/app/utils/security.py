"""
Utility functions untuk keamanan (Updated for PDF, Word, & Image Support)
"""

import os
from pathlib import Path
import logging

logger = logging.getLogger(__name__)

# Konstanta keamanan
MAX_FILE_SIZE = int(os.getenv("MAX_FILE_SIZE_MB", "500")) * 1024 * 1024  # 500MB default

# Daftar MIME types yang diizinkan (PDF, Word, dan Gambar)
ALLOWED_MIME_TYPES = [
    "application/pdf",
    "application/msword",  # .doc
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
    "image/jpeg",  # .jpg dan .jpeg
    "image/png",  # .png
    "image/webp",  # .webp
]

# Daftar ekstensi yang diizinkan
ALLOWED_EXTENSIONS = [".pdf", ".docx", ".doc", ".jpg", ".jpeg", ".png", ".webp"]

# Mapping Magic Numbers (Header) untuk validasi konten secara cepat
FILE_SIGNATURES = {
    ".pdf": b"%PDF",
    ".docx": b"PK\x03\x04",  # DOCX adalah format ZIP
    ".doc": b"\xd0\xcf\x11\xe0",
    ".jpg": b"\xff\xd8\xff",
    ".jpeg": b"\xff\xd8\xff",
    ".png": b"\x89PNG\r\n\x1a\n",
    ".webp": b"RIFF",  # Header WebP dimulai dengan RIFF
}


def validate_file_size(file_size: int) -> bool:
    """Validasi ukuran file berdasarkan environment variable"""
    if file_size > MAX_FILE_SIZE:
        logger.warning(f"File size {file_size} exceeds maximum {MAX_FILE_SIZE}")
        return False
    if file_size == 0:
        logger.warning("Empty file uploaded")
        return False
    return True


def validate_file_extension(filename: str) -> bool:
    """Validasi ekstensi file berdasarkan daftar ALLOWED_EXTENSIONS"""
    if not filename:
        return False

    file_ext = Path(filename).suffix.lower()
    return file_ext in ALLOWED_EXTENSIONS


def validate_file_content(file_path: str) -> bool:
    """
    Validasi konten file menggunakan magic bytes (Signature)
    Mendukung PDF, Word Documents, dan Gambar (JPG, PNG, WebP)
    """
    try:
        file_ext = Path(file_path).suffix.lower()
        expected_header = FILE_SIGNATURES.get(file_ext)

        # 1. Validasi Header Cepat (Wajib untuk file besar > 10MB atau jika signature tersedia)
        file_size = os.path.getsize(file_path)
        if file_size > 10 * 1024 * 1024 or not expected_header:
            if expected_header:
                with open(file_path, "rb") as f:
                    header = f.read(len(expected_header))
                    if header != expected_header:
                        logger.warning(f"File header mismatch for {file_ext}")
                        return False
            return True

        # 2. Validasi Mendalam dengan python-magic (untuk file < 10MB)
        import magic

        mime = magic.Magic(mime=True)
        detected_mime = mime.from_file(file_path)

        # Penanganan khusus: DOCX sering terdeteksi sebagai 'application/zip'
        if detected_mime == "application/zip" and file_ext == ".docx":
            return True

        if detected_mime not in ALLOWED_MIME_TYPES:
            logger.warning(f"Invalid MIME type detected: {detected_mime}")
            return False

        return True

    except ImportError:
        # Fallback jika library python-magic tidak terinstal
        try:
            file_ext = Path(file_path).suffix.lower()
            expected_header = FILE_SIGNATURES.get(file_ext)

            if expected_header:
                with open(file_path, "rb") as f:
                    header = f.read(len(expected_header))
                    return header == expected_header
            return True
        except Exception as e:
            logger.error(f"Error reading file header: {e}")
            return False
    except Exception as e:
        logger.error(f"Error validating file content: {e}")
        return False


def sanitize_filename(filename: str) -> str:
    """Membersihkan nama file untuk mencegah serangan path traversal"""
    filename = os.path.basename(filename)
    dangerous_chars = ["..", "/", "\\", "\x00"]
    for char in dangerous_chars:
        filename = filename.replace(char, "")

    # Membatasi panjang nama file agar aman bagi sistem operasi
    max_length = 255
    if len(filename) > max_length:
        name, ext = os.path.splitext(filename)
        filename = name[: max_length - len(ext)] + ext

    return filename


def get_safe_file_path(base_dir: str, filename: str, prefix: str = "") -> str:
    """Menghasilkan path file yang aman dan memvalidasi batas direktori"""
    sanitized = sanitize_filename(filename)
    if prefix:
        sanitized = f"{prefix}_{sanitized}"

    safe_path = os.path.join(base_dir, sanitized)

    # Validasi akhir untuk memastikan file tetap berada di dalam base_dir
    abs_base = os.path.abspath(base_dir)
    abs_path = os.path.abspath(safe_path)

    if not abs_path.startswith(abs_base):
        raise ValueError("Path traversal attempt detected")

    return safe_path