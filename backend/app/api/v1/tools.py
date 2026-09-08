"""
Endpoint perkakas PDF: OCR, tanda air, nomor halaman, pangkas, banding, perbaiki.

Semua endpoint di sini menerima PDF dan mengembalikan PDF, jadi helper
penyimpanan dan pengiriman berkas milik modul konversi dipakai ulang alih-alih
ditulis dua kali.
"""

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Optional

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import JSONResponse

from app.api.v1.convert import (
    _deliver,
    _new_workdir,
    _page_reporter,
    _queue_job,
    _save_upload,
)
from app.middleware.rate_limit import limiter, RATE_LIMIT_CHEAP, RATE_LIMIT_MODERATE, RATE_LIMIT_STANDARD
from app.services.job_service import ConversionJob
from app.services.pdf_tools_service import (
    PAGE_NUMBER_POSITIONS,
    WATERMARK_POSITIONS,
    PDFToolsService,
)

logger = logging.getLogger(__name__)

router = APIRouter()

PDF_ONLY = {".pdf"}


def _result_path(workdir: str, source_path: str, suffix: str) -> str:
    """Susun nama keluaran dari nama berkas asli plus penanda operasinya."""
    stem = Path(source_path).stem
    return os.path.join(workdir, f"{stem}-{suffix}.pdf")


def _fail(original_name: str) -> HTTPException:
    return HTTPException(status_code=500, detail=f"Gagal memproses {original_name}")


# ----------------------------------------------------------------------
# OCR: PDF hasil pindaian menjadi bisa dicari
# ----------------------------------------------------------------------
@router.post("/ocr")
@limiter.limit(RATE_LIMIT_STANDARD)
async def ocr_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    force: bool = Form(False),
    mode: str = Form("sync"),
):
    """
    Tambahkan lapisan teks tak terlihat ke PDF hasil pindaian.

    OCR butuh beberapa detik per halaman, jadi dokumen panjang sebaiknya
    dijalankan sebagai job async (`mode=async`) agar tidak menabrak batas waktu
    HTTP dan progresnya bisa dipantau.
    """
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "ocr")

        if mode == "async":

            async def runner(job: ConversionJob) -> None:
                report = _page_reporter(job, 1, 1, original_name)
                ok = await PDFToolsService.ocr_pdf(
                    source, result, force=force, progress=report
                )
                if not ok:
                    raise RuntimeError(f"Gagal memproses {original_name}")
                job.result_path = result
                job.result_filename = os.path.basename(result)
                job.media_type = "application/pdf"

            return _queue_job(f"OCR {original_name}", workdir, runner)

        if not await PDFToolsService.ocr_pdf(source, result, force=force):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"OCR PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Tanda air
# ----------------------------------------------------------------------
@router.post("/watermark")
@limiter.limit(RATE_LIMIT_CHEAP)
async def watermark_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    text: str = Form(...),
    position: str = Form("diagonal"),
    opacity: float = Form(0.15),
    font_size: int = Form(48),
    color: str = Form("#808080"),
    pages: Optional[str] = Form(None),
):
    """Bubuhkan tanda air teks ke seluruh halaman atau rentang tertentu."""
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "tanda-air")

        if not await PDFToolsService.add_watermark(
            source,
            result,
            text=text,
            position=position,
            opacity=opacity,
            font_size=font_size,
            color=color,
            pages=pages,
        ):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Tanda air gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Nomor halaman
# ----------------------------------------------------------------------
@router.post("/page-numbers")
@limiter.limit(RATE_LIMIT_CHEAP)
async def page_numbers_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    position: str = Form("bawah-tengah"),
    start_number: int = Form(1),
    template: str = Form("{n}"),
    font_size: int = Form(11),
    margin_mm: float = Form(12.0),
    skip_first: bool = Form(False),
    color: str = Form("#000000"),
):
    """Bubuhkan nomor halaman dengan format dan posisi yang bisa diatur."""
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "bernomor")

        if not await PDFToolsService.add_page_numbers(
            source,
            result,
            position=position,
            start_number=start_number,
            template=template,
            font_size=font_size,
            margin_mm=margin_mm,
            skip_first=skip_first,
            color=color,
        ):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Nomor halaman gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Pangkas halaman
# ----------------------------------------------------------------------
@router.post("/crop")
@limiter.limit(RATE_LIMIT_CHEAP)
async def crop_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    mode: str = Form("auto"),
    top_mm: float = Form(0.0),
    bottom_mm: float = Form(0.0),
    left_mm: float = Form(0.0),
    right_mm: float = Form(0.0),
    padding_mm: float = Form(5.0),
    pages: Optional[str] = Form(None),
):
    """Pangkas margin halaman, otomatis mengikuti isi atau menurut ukuran tetap."""
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "dipangkas")

        if not await PDFToolsService.crop_pdf(
            source,
            result,
            mode=mode,
            top_mm=top_mm,
            bottom_mm=bottom_mm,
            left_mm=left_mm,
            right_mm=right_mm,
            padding_mm=padding_mm,
            pages=pages,
        ):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Pangkas PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Bandingkan dua PDF
# ----------------------------------------------------------------------
@router.post("/compare")
@limiter.limit(RATE_LIMIT_MODERATE)
async def compare_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    original: UploadFile = File(...),
    revised: UploadFile = File(...),
):
    """Bandingkan isi teks dua PDF dan kembalikan laporan perbedaannya sebagai PDF."""
    workdir = _new_workdir()
    try:
        original_path = await _save_upload(original, workdir, PDF_ONLY)
        revised_path = await _save_upload(revised, workdir, PDF_ONLY)
        result = os.path.join(workdir, "perbandingan.pdf")

        if not await PDFToolsService.compare_pdf(
            original_path,
            revised_path,
            result,
            original_name=Path(original.filename or original_path).name,
            revised_name=Path(revised.filename or revised_path).name,
        ):
            raise HTTPException(
                status_code=500, detail="Gagal menyusun laporan perbandingan"
            )

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Bandingkan PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Perbaiki PDF rusak
# ----------------------------------------------------------------------
@router.post("/repair")
@limiter.limit(RATE_LIMIT_CHEAP)
async def repair_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """
    Bangun ulang PDF yang rusak.

    Berkas rusak sering tidak lolos pemeriksaan header biasa, jadi di sini
    validasinya sengaja hanya sampai ekstensi - justru berkas cacat itulah yang
    mau ditolong.
    """
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        result = _result_path(workdir, source, "diperbaiki")

        summary = await PDFToolsService.repair_pdf(source, result)
        response = _deliver(result, os.path.basename(result), workdir, background_tasks)
        # Ringkasan dikirim lewat header supaya isi responsnya tetap berkas PDF
        response.headers["X-Repair-Was-Damaged"] = "1" if summary["rusak"] else "0"
        response.headers["X-Repair-Pages"] = str(summary["halaman"])
        response.headers["X-Repair-Size-Before"] = str(summary["ukuran_sebelum"])
        response.headers["X-Repair-Size-After"] = str(summary["ukuran_sesudah"])
        return response
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Perbaiki PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Putar halaman
# ----------------------------------------------------------------------
@router.post("/rotate")
@limiter.limit("20/minute")
async def rotate_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    angle: int = Form(90),
    pages: Optional[str] = Form(None),
):
    """Putar halaman terpilih 90, 180, atau 270 derajat searah jarum jam."""
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "diputar")

        if not await PDFToolsService.rotate_pdf(
            source, result, angle=angle, pages=pages
        ):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Putar PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Hapus halaman
# ----------------------------------------------------------------------
@router.post("/remove-pages")
@limiter.limit("20/minute")
async def remove_pages(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    pages: str = Form(...),
):
    """Buang halaman yang disebut dan kembalikan sisanya."""
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "sisa-halaman")

        if not await PDFToolsService.remove_pages(source, result, pages=pages):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Hapus halaman gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Ambil halaman
# ----------------------------------------------------------------------
@router.post("/extract-pages")
@limiter.limit("20/minute")
async def extract_pages(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    pages: str = Form(...),
):
    """Ambil halaman tertentu menjadi PDF baru."""
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "halaman-terpilih")

        if not await PDFToolsService.extract_pages(source, result, pages=pages):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Ambil halaman gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Sensor teks
# ----------------------------------------------------------------------
@router.post("/redact")
@limiter.limit("15/minute")
async def redact_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    terms: str = Form(...),
    pages: Optional[str] = Form(None),
    case_sensitive: bool = Form(False),
    color: str = Form("#000000"),
):
    """Hapus permanen kata atau frasa tertentu, satu baris satu istilah."""
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "disensor")

        if not await PDFToolsService.redact_pdf(
            source,
            result,
            terms=terms,
            pages=pages,
            case_sensitive=case_sensitive,
            color=color,
        ):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Sensor PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Sunting halaman
# ----------------------------------------------------------------------
@router.post("/edit")
@limiter.limit("20/minute")
async def edit_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    items: str = Form(...),
):
    """
    Bubuhkan teks dan bentuk ke halaman PDF.

    ``items`` berupa JSON larik. Tiap elemen memuat ``halaman`` (mulai 1),
    ``jenis`` (teks/kotak/elips/garis/sorot/hapus), posisi ``x``/``y`` dan
    ukuran ``lebar``/``tinggi`` sebagai pecahan 0..1 terhadap halaman, serta
    ``teks``, ``ukuran_huruf``, ``warna``, ``tebal``, dan ``opasitas``.
    """
    workdir = _new_workdir()
    try:
        try:
            parsed = json.loads(items)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=400, detail=f"Daftar suntingan bukan JSON yang sah: {e}"
            )

        if not isinstance(parsed, list) or not all(
            isinstance(item, dict) for item in parsed
        ):
            raise HTTPException(
                status_code=400, detail="Daftar suntingan harus berupa larik objek"
            )

        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "disunting")

        if not await PDFToolsService.edit_pdf(source, result, parsed):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Sunting PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Formulir PDF
# ----------------------------------------------------------------------
@router.post("/form-fields")
@limiter.limit("30/minute")
async def form_fields(
    request: Request,
    file: UploadFile = File(...),
):
    """Baca daftar isian formulir pada sebuah PDF."""
    workdir = _new_workdir()
    try:
        source = await _save_upload(file, workdir, PDF_ONLY)
        fields = await PDFToolsService.form_fields(source)
        return JSONResponse({"jumlah": len(fields), "isian": fields})
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Baca formulir PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        # Berkasnya cuma dibaca, tidak ada hasil yang dikirim balik, jadi
        # direktori kerja bisa langsung dibuang tanpa menunggu background task.
        shutil.rmtree(workdir, ignore_errors=True)


@router.post("/fill-form")
@limiter.limit("20/minute")
async def fill_form(
    request: Request,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    values: str = Form(...),
    flatten: bool = Form(False),
):
    """Isi formulir PDF dari objek JSON berisi pasangan nama isian dan nilainya."""
    workdir = _new_workdir()
    try:
        try:
            parsed = json.loads(values)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=400, detail=f"Nilai isian bukan JSON yang sah: {e}"
            )

        if not isinstance(parsed, dict):
            raise HTTPException(
                status_code=400,
                detail="Nilai isian harus berupa objek {nama: nilai}",
            )

        source = await _save_upload(file, workdir, PDF_ONLY)
        original_name = Path(file.filename or source).name
        result = _result_path(workdir, source, "terisi")

        if not await PDFToolsService.fill_form(
            source, result, values=parsed, flatten=flatten
        ):
            raise _fail(original_name)

        return _deliver(result, os.path.basename(result), workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Isi formulir PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Metadata opsi, dipakai frontend untuk membangun formulirnya
# ----------------------------------------------------------------------
@router.get("/options")
async def tool_options():
    """Daftar pilihan yang sah untuk tiap perkakas."""
    return JSONResponse(
        {
            "watermark_positions": list(WATERMARK_POSITIONS),
            "page_number_positions": list(PAGE_NUMBER_POSITIONS),
            "crop_modes": ["auto", "manual"],
            "rotate_angles": [90, 180, 270],
            "edit_kinds": list(PDFToolsService.EDIT_KINDS),
        }
    )
