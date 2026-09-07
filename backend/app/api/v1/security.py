"""
Endpoint proteksi PDF UltraPDF: pasang dan lepas kata sandi.

Mengikuti pola endpoint konversi: menerima banyak berkas sekaligus (hasil
dibungkus ZIP bila lebih dari satu) dan bisa dijalankan sinkron maupun sebagai
job async lewat parameter form `mode`.
"""

import logging
import os
import shutil
from pathlib import Path
from typing import List, Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)

# Helper unggahan/hasil dipakai bersama supaya batas ukuran, penamaan berkas,
# pembungkusan ZIP, dan pembersihan direktori kerja identik dengan endpoint konversi.
from app.api.v1.convert import (
    _collect_result,
    _deliver,
    _media_type_for,
    _new_workdir,
    _queue_job,
    _save_uploads,
)
from app.middleware.rate_limit import limiter, RATE_LIMIT_CHEAP, RATE_LIMIT_STANDARD
from app.services.job_service import ConversionJob, job_store
from app.services.security_service import (
    ALLOWED_PERMISSIONS,
    PDFNotEncryptedError,
    PDFPasswordError,
    PDFSecurityService,
)

logger = logging.getLogger(__name__)

router = APIRouter()

MAX_PASSWORD_LENGTH = 128


def _parse_permissions(raw: Optional[str]) -> set[str]:
    """Ubah daftar izin "print,copy" menjadi himpunan tervalidasi."""
    if not raw:
        return set()

    requested = {item.strip().lower() for item in raw.split(",") if item.strip()}
    unknown = requested - ALLOWED_PERMISSIONS
    if unknown:
        joined = ", ".join(sorted(unknown))
        raise HTTPException(status_code=400, detail=f"Izin tidak dikenal: {joined}")

    return requested


def _validate_password(value: str, label: str, required: bool) -> str:
    password = value or ""
    if required and not password:
        raise HTTPException(status_code=400, detail=f"{label} wajib diisi")

    if len(password) > MAX_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=400,
            detail=f"{label} maksimal {MAX_PASSWORD_LENGTH} karakter",
        )

    return password


def _translate_error(error: Exception) -> HTTPException:
    if isinstance(error, PDFPasswordError):
        return HTTPException(status_code=422, detail=str(error))
    if isinstance(error, PDFNotEncryptedError):
        return HTTPException(status_code=400, detail=str(error))
    return HTTPException(status_code=500, detail=str(error))


@router.post("/inspect")
@limiter.limit(RATE_LIMIT_CHEAP)
async def inspect_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """Cek apakah sebuah PDF membutuhkan kata sandi untuk dibuka."""
    workdir = _new_workdir()

    try:
        saved = await _save_uploads([file], workdir, {".pdf"})
        info = await PDFSecurityService.inspect(saved[0][0])
        return {"filename": saved[0][1], **info}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Inspeksi PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Berkas PDF tidak dapat dibaca")
    finally:
        background_tasks.add_task(shutil.rmtree, workdir, True)


async def _unlock_all(
    saved: list[tuple[str, str]],
    workdir: str,
    password: str,
    job: Optional[ConversionJob] = None,
) -> list[str]:
    outputs: list[str] = []
    total = len(saved)

    for index, (path, original_name) in enumerate(saved, start=1):
        stem = Path(original_name).stem

        if job:
            job.progress = int(5 + (index - 1) / total * 85)
            job.message = f"Membuka kunci {original_name}"

        result = os.path.join(workdir, f"{stem}-terbuka.pdf")
        await PDFSecurityService.unlock(path, result, password)
        outputs.append(result)

    return outputs


async def _protect_all(
    saved: list[tuple[str, str]],
    workdir: str,
    user_password: str,
    owner_password: str,
    permissions: set[str],
    current_password: str,
    job: Optional[ConversionJob] = None,
) -> list[str]:
    outputs: list[str] = []
    total = len(saved)

    for index, (path, original_name) in enumerate(saved, start=1):
        stem = Path(original_name).stem

        if job:
            job.progress = int(5 + (index - 1) / total * 85)
            job.message = f"Mengunci {original_name}"

        result = os.path.join(workdir, f"{stem}-terlindungi.pdf")
        await PDFSecurityService.protect(
            path,
            result,
            user_password=user_password,
            owner_password=owner_password,
            permissions=permissions,
            current_password=current_password,
        )
        outputs.append(result)

    return outputs


@router.post("/unlock")
@limiter.limit(RATE_LIMIT_STANDARD)
async def unlock_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    password: str = Form(""),
    mode: str = Form("sync"),
):
    """
    Lepas proteksi kata sandi dari PDF.

    password: kata sandi pembuka dokumen. Satu kata sandi dipakai untuk seluruh
    berkas pada batch, jadi berkas dengan kunci berbeda perlu dikirim terpisah.
    """
    password = _validate_password(password, "Kata sandi", required=False)
    workdir = _new_workdir()

    try:
        saved = await _save_uploads(files, workdir, {".pdf"})
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise

    if mode == "async":
        async def runner(job: ConversionJob):
            outputs = await _unlock_all(saved, workdir, password, job)
            result_path, filename = _collect_result(outputs, workdir, "pdf-terbuka")
            job_store.finish(job, result_path, filename, _media_type_for(result_path))

        return _queue_job("Buka kunci PDF", workdir, runner)

    try:
        outputs = await _unlock_all(saved, workdir, password)
        result_path, filename = _collect_result(outputs, workdir, "pdf-terbuka")
        return _deliver(result_path, filename, workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except (PDFPasswordError, PDFNotEncryptedError) as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise _translate_error(e)
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Buka kunci PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Gagal membuka kunci PDF")


@router.post("/protect")
@limiter.limit(RATE_LIMIT_STANDARD)
async def protect_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    password: str = Form(...),
    owner_password: str = Form(""),
    permissions: Optional[str] = Form(None),
    current_password: str = Form(""),
    mode: str = Form("sync"),
):
    """
    Enkripsi PDF dengan AES-256.

    password: kata sandi yang harus diketik untuk membuka dokumen.
    owner_password: kata sandi pemilik untuk mengubah izin; kosong berarti sama
    dengan `password`.
    permissions: daftar izin yang tetap diberikan, misal "print,copy".
    current_password: kata sandi dokumen sumber bila berkas sudah terkunci.
    """
    password = _validate_password(password, "Kata sandi", required=True)
    owner_password = _validate_password(
        owner_password, "Kata sandi pemilik", required=False
    )
    current_password = _validate_password(
        current_password, "Kata sandi dokumen", required=False
    )
    granted = _parse_permissions(permissions)

    workdir = _new_workdir()

    try:
        saved = await _save_uploads(files, workdir, {".pdf"})
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise

    if mode == "async":
        async def runner(job: ConversionJob):
            outputs = await _protect_all(
                saved, workdir, password, owner_password, granted, current_password, job
            )
            result_path, filename = _collect_result(outputs, workdir, "pdf-terlindungi")
            job_store.finish(job, result_path, filename, _media_type_for(result_path))

        return _queue_job("Proteksi PDF", workdir, runner)

    try:
        outputs = await _protect_all(
            saved, workdir, password, owner_password, granted, current_password
        )
        result_path, filename = _collect_result(outputs, workdir, "pdf-terlindungi")
        return _deliver(result_path, filename, workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except PDFPasswordError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise _translate_error(e)
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Proteksi PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Gagal memproteksi PDF")
