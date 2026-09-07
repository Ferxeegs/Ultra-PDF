"""
Layanan proteksi dan pembukaan kunci PDF.

Semua operasi memakai PyMuPDF (sudah menjadi dependensi inti untuk konversi),
sehingga tidak perlu menambah pustaka kriptografi PDF baru.
"""

import asyncio
import logging
import os

logger = logging.getLogger(__name__)


class PDFPasswordError(Exception):
    """Kata sandi yang diberikan tidak cocok dengan dokumen."""


class PDFNotEncryptedError(Exception):
    """Dokumen tidak terenkripsi sehingga tidak ada yang perlu dibuka."""


def _import_fitz():
    # Nama modul "fitz" sudah deprecated; "pymupdf" dipakai lebih dulu
    try:
        import pymupdf

        return pymupdf
    except ImportError:
        pass

    try:
        import fitz

        return fitz
    except ImportError:
        logger.error("PyMuPDF tidak terpasang")
        raise RuntimeError(
            "Fitur ini membutuhkan PyMuPDF yang belum terpasang di server"
        )


# Nama izin yang dikirim frontend -> atribut konstanta PyMuPDF
PERMISSION_FLAGS: dict[str, str] = {
    "print": "PDF_PERM_PRINT",
    "print_hq": "PDF_PERM_PRINT_HQ",
    "copy": "PDF_PERM_COPY",
    "modify": "PDF_PERM_MODIFY",
    "annotate": "PDF_PERM_ANNOTATE",
    "form": "PDF_PERM_FORM",
    "assemble": "PDF_PERM_ASSEMBLE",
    "accessibility": "PDF_PERM_ACCESSIBILITY",
}

ALLOWED_PERMISSIONS = frozenset(PERMISSION_FLAGS)


class PDFSecurityService:
    """Buka kunci atau pasang kata sandi pada dokumen PDF."""

    @staticmethod
    def _open(fitz, input_path: str, password: str) -> tuple[object, bool]:
        """
        Buka dokumen dan pastikan sudah terautentikasi bila terenkripsi.

        Mengembalikan pasangan (dokumen, terenkripsi). Status enkripsi sengaja
        dikembalikan dari sini: membaca `needs_pass` lagi setelah `authenticate`
        membuat MuPDF salah mendekripsi stream, sehingga hasil `save` menjadi
        halaman kosong.
        """
        document = fitz.open(input_path)
        encrypted = bool(document.needs_pass)

        if encrypted:
            # authenticate mengembalikan 0 saat gagal, >0 saat berhasil
            if not document.authenticate(password or ""):
                document.close()
                raise PDFPasswordError(
                    "Kata sandi salah atau tidak diberikan untuk dokumen ini"
                )

        return document, encrypted

    # ------------------------------------------------------------------
    # Inspeksi
    # ------------------------------------------------------------------
    @staticmethod
    def _inspect_sync(input_path: str) -> dict:
        fitz = _import_fitz()
        document = fitz.open(input_path)
        try:
            encrypted = bool(document.needs_pass)
            return {
                "encrypted": encrypted,
                "pages": None if encrypted else document.page_count,
            }
        finally:
            document.close()

    @staticmethod
    async def inspect(input_path: str) -> dict:
        """Cek apakah dokumen meminta kata sandi untuk dibuka."""
        return await asyncio.to_thread(PDFSecurityService._inspect_sync, input_path)

    # ------------------------------------------------------------------
    # Buka kunci
    # ------------------------------------------------------------------
    @staticmethod
    def _unlock_sync(input_path: str, output_path: str, password: str) -> None:
        fitz = _import_fitz()
        document, encrypted = PDFSecurityService._open(fitz, input_path, password)

        try:
            if not encrypted:
                raise PDFNotEncryptedError(
                    "Dokumen ini tidak terkunci, tidak ada sandi yang perlu dilepas"
                )

            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            # Tanpa encryption=PDF_ENCRYPT_NONE, PyMuPDF mempertahankan enkripsi asal
            document.save(
                output_path,
                encryption=fitz.PDF_ENCRYPT_NONE,
                garbage=3,
                deflate=True,
            )
        finally:
            document.close()

    @staticmethod
    async def unlock(input_path: str, output_path: str, password: str = "") -> None:
        """Hapus proteksi kata sandi, menghasilkan PDF yang bisa dibuka bebas."""
        await asyncio.to_thread(
            PDFSecurityService._unlock_sync, input_path, output_path, password
        )

    # ------------------------------------------------------------------
    # Proteksi
    # ------------------------------------------------------------------
    @staticmethod
    def _protect_sync(
        input_path: str,
        output_path: str,
        user_password: str,
        owner_password: str,
        permissions: set[str],
        current_password: str,
    ) -> None:
        fitz = _import_fitz()
        document, _ = PDFSecurityService._open(fitz, input_path, current_password)

        try:
            # Aksesibilitas selalu diizinkan agar pembaca layar tetap berfungsi
            granted = set(permissions) | {"accessibility"}
            flags = 0
            for name in granted:
                attribute = PERMISSION_FLAGS.get(name)
                if attribute:
                    flags |= int(getattr(fitz, attribute))

            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            document.save(
                output_path,
                encryption=fitz.PDF_ENCRYPT_AES_256,
                owner_pw=owner_password or user_password,
                user_pw=user_password,
                permissions=flags,
                garbage=3,
                deflate=True,
            )
        finally:
            document.close()

    @staticmethod
    async def protect(
        input_path: str,
        output_path: str,
        user_password: str,
        owner_password: str = "",
        permissions: set[str] | None = None,
        current_password: str = "",
    ) -> None:
        """
        Enkripsi PDF dengan AES-256.

        user_password: sandi untuk membuka dokumen.
        owner_password: sandi pemilik untuk mengubah izin; default sama dengan user.
        permissions: himpunan izin yang tetap diberikan kepada pembaca.
        current_password: sandi dokumen sumber bila sudah terkunci sebelumnya.
        """
        await asyncio.to_thread(
            PDFSecurityService._protect_sync,
            input_path,
            output_path,
            user_password,
            owner_password,
            permissions or set(),
            current_password,
        )
