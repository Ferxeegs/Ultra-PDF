"""
Rate limiting menggunakan slowapi.

Batas dikelompokkan menurut biaya kerja endpoint, bukan didefinisikan satu per
satu di tiap dekorator. Sebelumnya nilainya ditulis langsung sebagai string di
17 dekorator yang tersebar di empat modul, sementara environment variable yang
didokumentasikan tidak pernah dibaca - menyetelnya sama sekali tidak berefek.

Semua default di bawah sama persis dengan nilai yang dulu tertulis di dekorator,
jadi tanpa environment variable perilakunya tidak berubah.
"""
import logging
import os
import re

from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)

# Format yang diterima slowapi, mis. "10/minute" atau "10 per minute".
_LIMIT_PATTERN = re.compile(
    r"^\d+\s*(?:/|\s+per\s+)\s*(?:second|minute|hour|day)$", re.IGNORECASE
)


def _limit_from_env(var_name: str, default: str) -> str:
    """
    Baca satu batas dari environment, jatuh kembali ke default bila tidak valid.

    Salah ketik pada nilai batas baru terdeteksi saat request masuk, dan saat itu
    slowapi melempar error - endpoint jadi mati. Lebih aman menolak nilai yang
    tidak dikenal sejak awal lalu memakai default yang pasti benar, sambil
    mencatat peringatan supaya kesalahan konfigurasinya tetap terlihat.
    """
    raw = os.getenv(var_name, "").strip()
    if not raw:
        return default

    if not _LIMIT_PATTERN.match(raw):
        logger.warning(
            "%s=%r bukan format batas yang valid (contoh: '10/minute'); "
            "memakai default %r",
            var_name,
            raw,
            default,
        )
        return default

    return raw


# Berat: memanggil LibreOffice sebagai subprocess atau mengambil URL eksternal.
RATE_LIMIT_EXPENSIVE = _limit_from_env("RATE_LIMIT_EXPENSIVE", "5/minute")

# Standar: konversi dan pengeditan PDF pada umumnya.
RATE_LIMIT_STANDARD = _limit_from_env("RATE_LIMIT_STANDARD", "10/minute")

# Sedang: membaca dua dokumen sekaligus, tapi tanpa proses eksternal.
RATE_LIMIT_MODERATE = _limit_from_env("RATE_LIMIT_MODERATE", "15/minute")

# Ringan: operasi metadata atau overlay yang hampir tidak memakai CPU.
RATE_LIMIT_CHEAP = _limit_from_env("RATE_LIMIT_CHEAP", "20/minute")

# Inisialisasi limiter
limiter = Limiter(key_func=get_remote_address)


def get_rate_limiter():
    """Get rate limiter instance"""
    return limiter
