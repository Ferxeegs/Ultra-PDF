"""
Endpoint konversi universal UltraPDF.

Semua endpoint di sini menerima banyak berkas sekaligus (hasil dibungkus ZIP
bila lebih dari satu) dan bisa dijalankan sinkron maupun sebagai job async
lewat parameter form `mode`.
"""

import ipaddress
import logging
import os
import shutil
import socket
import uuid
from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse

from fastapi import (
    APIRouter,
    BackgroundTasks,
    File,
    Form,
    HTTPException,
    Request,
    UploadFile,
)
from fastapi.responses import FileResponse, JSONResponse

from app.middleware.rate_limit import limiter, RATE_LIMIT_EXPENSIVE, RATE_LIMIT_STANDARD
from app.services.convert_service import (
    OFFICE_INPUT_EXTENSIONS,
    ConvertService,
    create_zip,
)
from app.services.job_service import ConversionJob, job_store
from app.services.pdf_service import PDFService
from app.utils.security import sanitize_filename

logger = logging.getLogger(__name__)

router = APIRouter()

UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")
OUTPUT_DIR = os.getenv("OUTPUT_DIR", "outputs")
MAX_CONVERT_SIZE_MB = int(os.getenv("MAX_CONVERT_SIZE_MB", "100"))
MAX_BATCH_FILES = int(os.getenv("MAX_BATCH_FILES", "20"))
CHUNK_SIZE = 4 * 1024 * 1024

IMAGE_EXTENSIONS = {
    ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".gif",
    ".tif", ".tiff", ".heic", ".heif",
}

# Ekstensi yang bisa dikonversi menjadi PDF
TO_PDF_EXTENSIONS = OFFICE_INPUT_EXTENSIONS | IMAGE_EXTENSIONS | {".md", ".markdown", ".epub"}

# Target gambar: dirender per halaman, atau diambil sebagai objek gambar
# tertanam bila extract_images aktif
IMAGE_TARGETS = {"jpg", "png", "webp", "tiff"}

# Target yang tersedia untuk sumber PDF
FROM_PDF_TARGETS = {
    "docx", "xlsx", "csv", "pptx", "txt", "md", "html", "epub", "pdfa",
} | IMAGE_TARGETS

MEDIA_TYPES = {
    ".pdf": "application/pdf",
    ".zip": "application/zip",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".epub": "application/epub+zip",
    ".csv": "text/csv; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".jpg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".tiff": "image/tiff",
}

# Peta format sumber -> daftar target, dipakai halaman convert universal di frontend
CONVERSION_MATRIX: dict[str, list[str]] = {
    **{ext: ["pdf"] for ext in sorted(TO_PDF_EXTENSIONS)},
    ".pdf": sorted(FROM_PDF_TARGETS),
}


# ----------------------------------------------------------------------
# Helper upload & hasil
# ----------------------------------------------------------------------
def _media_type_for(path: str) -> str:
    return MEDIA_TYPES.get(Path(path).suffix.lower(), "application/octet-stream")


async def _save_upload(upload: UploadFile, dest_dir: str, allowed: set[str]) -> str:
    """Simpan satu upload ke direktori kerja setelah validasi ekstensi dan ukuran."""
    if not upload.filename:
        raise HTTPException(status_code=400, detail="Nama berkas wajib ada")

    safe_name = sanitize_filename(upload.filename)
    ext = Path(safe_name).suffix.lower()

    if ext not in allowed:
        raise HTTPException(
            status_code=400, detail=f"Format {ext or 'tanpa ekstensi'} tidak didukung"
        )

    os.makedirs(dest_dir, exist_ok=True)
    # Nama unik agar dua berkas bernama sama dalam satu batch tidak saling menimpa
    target_path = os.path.join(dest_dir, f"{Path(safe_name).stem}_{uuid.uuid4().hex[:8]}{ext}")

    max_size = MAX_CONVERT_SIZE_MB * 1024 * 1024
    size = 0

    with open(target_path, "wb", buffering=8 * 1024 * 1024) as buffer:
        while True:
            chunk = await upload.read(CHUNK_SIZE)
            if not chunk:
                break
            size += len(chunk)
            if size > max_size:
                buffer.close()
                os.remove(target_path)
                raise HTTPException(
                    status_code=413,
                    detail=f"Ukuran berkas melebihi {MAX_CONVERT_SIZE_MB} MB",
                )
            buffer.write(chunk)

    if size == 0:
        os.remove(target_path)
        raise HTTPException(status_code=400, detail="Berkas kosong")

    if ext == ".pdf":
        with open(target_path, "rb") as handle:
            header = handle.read(4)

        # Penghapusan harus di luar blok with: Windows menolak menghapus berkas
        # yang handle-nya masih terbuka
        if header != b"%PDF":
            os.remove(target_path)
            raise HTTPException(status_code=400, detail="Berkas bukan PDF yang valid")

    return target_path


async def _save_uploads(
    files: List[UploadFile], dest_dir: str, allowed: set[str]
) -> list[tuple[str, str]]:
    """Simpan seluruh upload. Mengembalikan pasangan (path tersimpan, nama asli)."""
    if not files:
        raise HTTPException(status_code=400, detail="Tidak ada berkas yang diunggah")

    if len(files) > MAX_BATCH_FILES:
        raise HTTPException(
            status_code=400,
            detail=f"Maksimal {MAX_BATCH_FILES} berkas per konversi",
        )

    saved: list[tuple[str, str]] = []
    for upload in files:
        path = await _save_upload(upload, dest_dir, allowed)
        saved.append((path, sanitize_filename(upload.filename or Path(path).name)))

    return saved


def _pack_many(
    produced: list[str], workdir: str, stem: str, total_documents: int
) -> str:
    """
    Satu dokumen sumber bisa menghasilkan banyak berkas (halaman gambar, tabel
    CSV). Berkas tunggal dikirim apa adanya, selebihnya dibungkus ZIP per
    dokumen supaya hasil tiap sumber tetap terpisah.
    """
    if len(produced) == 1 and total_documents == 1:
        return produced[0]

    zip_path = os.path.join(workdir, f"{stem}.zip")
    create_zip(produced, zip_path)
    return zip_path


def _collect_result(
    outputs: list[str], workdir: str, batch_name: str
) -> tuple[str, str]:
    """Satu hasil dikirim apa adanya, banyak hasil dibungkus ZIP."""
    if not outputs:
        raise HTTPException(status_code=500, detail="Konversi tidak menghasilkan berkas")

    if len(outputs) == 1:
        return outputs[0], os.path.basename(outputs[0])

    zip_path = os.path.join(workdir, f"{batch_name}.zip")
    create_zip(outputs, zip_path)
    return zip_path, os.path.basename(zip_path)


def _deliver(
    result_path: str,
    filename: str,
    workdir: str,
    background_tasks: BackgroundTasks,
) -> FileResponse:
    background_tasks.add_task(shutil.rmtree, workdir, True)
    return FileResponse(
        path=result_path,
        filename=filename,
        media_type=_media_type_for(result_path),
    )


def _new_workdir() -> str:
    workdir = os.path.join(OUTPUT_DIR, f"convert_{uuid.uuid4().hex}")
    os.makedirs(workdir, exist_ok=True)
    return workdir


# ----------------------------------------------------------------------
# Inti konversi
# ----------------------------------------------------------------------
async def _convert_to_pdf(
    saved: list[tuple[str, str]],
    workdir: str,
    fit_to_page: bool,
    pdf_variant: Optional[str],
    merge_images: bool,
    job: Optional[ConversionJob] = None,
    page_size: str = "auto",
    orientation: str = "portrait",
    margin_mm: float = 0.0,
) -> list[str]:
    """Konversi kumpulan berkas apa pun menjadi PDF."""
    outputs: list[str] = []
    image_paths: list[str] = []
    total = len(saved)

    for index, (path, original_name) in enumerate(saved, start=1):
        ext = Path(path).suffix.lower()
        stem = Path(original_name).stem

        if job:
            job.progress = int(5 + (index - 1) / total * 85)
            job.message = f"Mengonversi {original_name}"

        if ext in IMAGE_EXTENSIONS:
            normalized = await ConvertService.normalize_image(path, workdir)
            if merge_images:
                image_paths.append(normalized)
                continue

            single_pdf = os.path.join(workdir, f"{stem}.pdf")
            if not await PDFService.convert_image_to_pdf(
                [normalized], single_pdf, page_size, orientation, margin_mm
            ):
                raise RuntimeError(f"Gagal mengonversi gambar {original_name}")
            outputs.append(single_pdf)
            continue

        if ext in (".md", ".markdown"):
            target = os.path.join(workdir, f"{stem}.pdf")
            if not await ConvertService.markdown_to_pdf(path, target):
                raise RuntimeError(f"Gagal mengonversi {original_name}")
            outputs.append(target)
            continue

        if ext == ".epub":
            target = os.path.join(workdir, f"{stem}.pdf")
            if not await ConvertService.epub_to_pdf(path, target):
                raise RuntimeError(f"Gagal mengonversi {original_name}")
            outputs.append(target)
            continue

        if ext in OFFICE_INPUT_EXTENSIONS:
            produced = await ConvertService.office_to_pdf(
                path, workdir, pdf_variant=pdf_variant, fit_to_page=fit_to_page
            )
            if not produced:
                raise RuntimeError(f"Gagal mengonversi {original_name}")

            # Kembalikan nama asli berkas (LibreOffice memakai nama unik dari _save_upload)
            renamed = os.path.join(workdir, f"{stem}.pdf")
            if os.path.abspath(produced) != os.path.abspath(renamed):
                shutil.move(produced, renamed)
            outputs.append(renamed)
            continue

        raise RuntimeError(f"Format {ext} tidak didukung")

    if merge_images and image_paths:
        merged = os.path.join(workdir, "gambar-gabungan.pdf")
        if not await PDFService.convert_image_to_pdf(
            image_paths, merged, page_size, orientation, margin_mm
        ):
            raise RuntimeError("Gagal menggabungkan gambar menjadi PDF")
        outputs.append(merged)

    return outputs


def _page_reporter(
    job: Optional[ConversionJob], index: int, total: int, name: str
):
    """
    Petakan kemajuan per halaman ke potongan bar progres milik berkas ini.

    Tanpa ini konversi panjang (terutama OCR yang butuh detik per halaman)
    membuat bar diam di angka yang sama sampai seluruh berkas selesai.
    """
    if job is None:
        return None

    start = 5 + (index - 1) / total * 85
    span = 85 / total

    def report(done: int, pages: int) -> None:
        # Dipanggil dari thread pekerja; hanya menulis atribut sederhana
        job.progress = int(start + span * (done / max(pages, 1)))
        job.message = f"Mengonversi {name} (halaman {done}/{pages})"

    return report


async def _convert_from_pdf(
    saved: list[tuple[str, str]],
    workdir: str,
    target: str,
    dpi: int,
    pages: Optional[str],
    pdfa_version: int,
    job: Optional[ConversionJob] = None,
    extract_images: bool = False,
) -> list[str]:
    """Konversi PDF ke format lain."""
    outputs: list[str] = []
    total = len(saved)

    for index, (path, original_name) in enumerate(saved, start=1):
        stem = Path(original_name).stem

        if job:
            job.progress = int(5 + (index - 1) / total * 85)
            job.message = f"Mengonversi {original_name}"

        report = _page_reporter(job, index, total, original_name)

        if target == "docx":
            result = os.path.join(workdir, f"{stem}.docx")
            ok = await ConvertService.pdf_to_docx(path, result, progress=report)
        elif target == "xlsx":
            result = os.path.join(workdir, f"{stem}.xlsx")
            ok = await ConvertService.pdf_to_xlsx(path, result, progress=report)
        elif target == "pptx":
            result = os.path.join(workdir, f"{stem}.pptx")
            ok = await ConvertService.pdf_to_pptx(path, result, dpi=dpi)
        elif target in IMAGE_TARGETS:
            if extract_images:
                images = await ConvertService.pdf_extract_images(
                    path, workdir, image_format=target, pages=pages, base_name=stem
                )
                if not images:
                    # ValueError agar endpoint membalas 400: ini kondisi dokumen,
                    # bukan kegagalan server
                    raise ValueError(
                        f"Tidak ada gambar tertanam yang ditemukan di {original_name}"
                    )
            else:
                images = await ConvertService.pdf_to_images(
                    path, workdir, image_format=target, dpi=dpi, pages=pages, base_name=stem
                )
                if not images:
                    raise RuntimeError(f"Gagal merender {original_name}")

            outputs.append(_pack_many(images, workdir, stem, total))
            continue
        elif target == "csv":
            tables = await ConvertService.pdf_to_csv(
                path, workdir, pages=pages, base_name=stem
            )
            if not tables:
                raise ValueError(
                    f"Tidak ada tabel yang terdeteksi di {original_name}. "
                    "Coba target Excel yang punya cadangan ekstraksi teks."
                )

            outputs.append(_pack_many(tables, workdir, stem, total))
            continue
        elif target == "html":
            result = os.path.join(workdir, f"{stem}.html")
            ok = await ConvertService.pdf_to_html(path, result, pages=pages)
        elif target in ("txt", "md"):
            result = os.path.join(workdir, f"{stem}.{target}")
            ok = await ConvertService.pdf_to_text(
                path, result, text_format=target, pages=pages, progress=report
            )
        elif target == "epub":
            result = os.path.join(workdir, f"{stem}.epub")
            ok = await ConvertService.pdf_to_epub(
                path, result, title=stem, progress=report
            )
        elif target == "pdfa":
            result = os.path.join(workdir, f"{stem}-pdfa.pdf")
            ok = await ConvertService.pdf_to_pdfa(path, result, version=pdfa_version)
        else:
            raise RuntimeError(f"Target {target} tidak didukung")

        if not ok:
            raise RuntimeError(f"Gagal mengonversi {original_name}")
        outputs.append(result)

    return outputs


def _queue_job(
    name: str,
    workdir: str,
    runner,
) -> JSONResponse:
    """Bungkus fungsi konversi menjadi job async dan balas dengan job_id."""
    job = job_store.create(name, runner, cleanup_paths=[workdir])
    return JSONResponse(status_code=202, content=job.to_dict())


# ----------------------------------------------------------------------
# Endpoint
# ----------------------------------------------------------------------
@router.get("/formats")
async def list_formats():
    """Daftar format sumber dan target yang tersedia (untuk halaman convert universal)."""
    return {
        "matrix": CONVERSION_MATRIX,
        "max_files": MAX_BATCH_FILES,
        "max_size_mb": MAX_CONVERT_SIZE_MB,
    }


@router.post("/to-pdf")
@limiter.limit(RATE_LIMIT_STANDARD)
async def convert_to_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    fit_to_page: bool = Form(False),
    pdf_variant: Optional[str] = Form(None),
    merge_images: bool = Form(False),
    page_size: str = Form("auto"),
    orientation: str = Form("portrait"),
    margin_mm: float = Form(0.0),
    mode: str = Form("sync"),
):
    """
    Word/Excel/PowerPoint/ODF/RTF/TXT/HTML/Markdown/EPUB/gambar -> PDF.

    fit_to_page: khusus spreadsheet, muat semua kolom dalam satu halaman.
    pdf_variant: "pdfa" untuk mengekspor langsung sebagai PDF/A-2b.
    merge_images: gabungkan semua gambar pada batch menjadi satu PDF.
    page_size: "auto" (ikut ukuran gambar) atau a3/a4/a5/letter.
    orientation: "portrait" atau "landscape", diabaikan bila page_size "auto".
    margin_mm: jarak tepi halaman gambar dalam milimeter.
    """
    if pdf_variant not in (None, "", "pdf", "pdfa"):
        raise HTTPException(status_code=400, detail="pdf_variant harus 'pdf' atau 'pdfa'")

    page_size = (page_size or "auto").lower()
    if page_size != "auto" and page_size not in PDFService.PAGE_SIZES_MM:
        allowed = ", ".join(["auto", *sorted(PDFService.PAGE_SIZES_MM)])
        raise HTTPException(
            status_code=400, detail=f"page_size harus salah satu dari: {allowed}"
        )

    orientation = (orientation or "portrait").lower()
    if orientation not in ("portrait", "landscape"):
        raise HTTPException(
            status_code=400, detail="orientation harus 'portrait' atau 'landscape'"
        )

    if not 0 <= margin_mm <= 100:
        raise HTTPException(status_code=400, detail="margin_mm harus antara 0 dan 100")

    workdir = _new_workdir()

    try:
        saved = await _save_uploads(files, workdir, TO_PDF_EXTENSIONS)
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise

    variant = pdf_variant if pdf_variant == "pdfa" else None

    if mode == "async":
        async def runner(job: ConversionJob):
            outputs = await _convert_to_pdf(
                saved, workdir, fit_to_page, variant, merge_images, job,
                page_size, orientation, margin_mm,
            )
            result_path, filename = _collect_result(outputs, workdir, "hasil-konversi")
            job_store.finish(job, result_path, filename, _media_type_for(result_path))

        return _queue_job("Konversi ke PDF", workdir, runner)

    try:
        outputs = await _convert_to_pdf(
            saved, workdir, fit_to_page, variant, merge_images, None,
            page_size, orientation, margin_mm,
        )
        result_path, filename = _collect_result(outputs, workdir, "hasil-konversi")
        return _deliver(result_path, filename, workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Konversi ke PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/from-pdf")
@limiter.limit(RATE_LIMIT_STANDARD)
async def convert_from_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(...),
    target: str = Form(...),
    dpi: int = Form(150),
    pages: Optional[str] = Form(None),
    pdfa_version: int = Form(2),
    extract_images: bool = Form(False),
    mode: str = Form("sync"),
):
    """
    PDF -> Word, Excel, CSV, PowerPoint, JPG/PNG/WebP/TIFF, teks, Markdown,
    HTML, EPUB, atau PDF/A.

    pages: rentang halaman seperti "1-3,7" (berlaku untuk gambar, tabel, teks,
    dan HTML).
    dpi: resolusi render untuk target gambar dan PowerPoint.
    extract_images: khusus target gambar, ambil objek gambar yang tertanam di
    dalam PDF alih-alih merender seluruh halaman.
    """
    target = target.lower().strip()
    if target not in FROM_PDF_TARGETS:
        raise HTTPException(
            status_code=400,
            detail=f"Target harus salah satu dari: {', '.join(sorted(FROM_PDF_TARGETS))}",
        )

    if not 36 <= dpi <= 600:
        raise HTTPException(status_code=400, detail="DPI harus antara 36 dan 600")

    if pdfa_version not in (1, 2, 3):
        raise HTTPException(status_code=400, detail="Versi PDF/A harus 1, 2, atau 3")

    workdir = _new_workdir()

    try:
        saved = await _save_uploads(files, workdir, {".pdf"})
    except Exception:
        shutil.rmtree(workdir, ignore_errors=True)
        raise

    if mode == "async":
        async def runner(job: ConversionJob):
            outputs = await _convert_from_pdf(
                saved, workdir, target, dpi, pages, pdfa_version, job, extract_images
            )
            result_path, filename = _collect_result(outputs, workdir, f"pdf-ke-{target}")
            job_store.finish(job, result_path, filename, _media_type_for(result_path))

        return _queue_job(f"PDF ke {target.upper()}", workdir, runner)

    try:
        outputs = await _convert_from_pdf(
            saved, workdir, target, dpi, pages, pdfa_version, None, extract_images
        )
        result_path, filename = _collect_result(outputs, workdir, f"pdf-ke-{target}")
        return _deliver(result_path, filename, workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except ValueError as e:
        shutil.rmtree(workdir, ignore_errors=True)
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"Konversi dari PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


def _assert_public_url(url: str) -> str:
    """
    Tolak URL yang menunjuk ke jaringan internal.

    Tanpa ini endpoint URL-ke-PDF menjadi SSRF: penyerang bisa memaksa server
    mengambil metadata cloud atau layanan internal lalu membacanya sebagai PDF.
    """
    parsed = urlparse(url)

    if parsed.scheme not in ("http", "https"):
        raise HTTPException(status_code=400, detail="URL harus memakai http atau https")

    if not parsed.hostname:
        raise HTTPException(status_code=400, detail="URL tidak valid")

    try:
        infos = socket.getaddrinfo(parsed.hostname, None)
    except socket.gaierror:
        raise HTTPException(status_code=400, detail="Host pada URL tidak dapat dijangkau")

    for info in infos:
        address = ipaddress.ip_address(info[4][0])
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_multicast
        ):
            raise HTTPException(
                status_code=400, detail="URL menunjuk ke alamat internal"
            )

    return url


@router.post("/url-to-pdf")
@limiter.limit(RATE_LIMIT_EXPENSIVE)
async def convert_url_to_pdf(
    request: Request,
    background_tasks: BackgroundTasks,
    url: str = Form(...),
    mode: str = Form("sync"),
):
    """Ambil halaman web dan render menjadi PDF."""
    safe_url = _assert_public_url(url.strip())
    workdir = _new_workdir()

    hostname = urlparse(safe_url).hostname or "halaman"
    output_name = f"{sanitize_filename(hostname).replace('.', '-')}.pdf"
    output_path = os.path.join(workdir, output_name)

    if mode == "async":
        async def runner(job: ConversionJob):
            if not await ConvertService.html_to_pdf(output_path, url=safe_url):
                raise RuntimeError("Gagal merender halaman web")
            job_store.finish(job, output_path, output_name, "application/pdf")

        return _queue_job("URL ke PDF", workdir, runner)

    try:
        if not await ConvertService.html_to_pdf(output_path, url=safe_url):
            raise HTTPException(status_code=502, detail="Gagal merender halaman web")
        return _deliver(output_path, output_name, workdir, background_tasks)
    except HTTPException:
        shutil.rmtree(workdir, ignore_errors=True)
        raise
    except Exception as e:
        shutil.rmtree(workdir, ignore_errors=True)
        logger.error(f"URL ke PDF gagal: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# ----------------------------------------------------------------------
# Job async
# ----------------------------------------------------------------------
@router.get("/jobs/{job_id}")
async def get_job(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan")
    return job.to_dict()


@router.get("/jobs/{job_id}/result")
async def get_job_result(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan")

    if job.status != "done" or not job.result_path:
        raise HTTPException(status_code=409, detail=f"Job belum selesai ({job.status})")

    if not os.path.exists(job.result_path):
        raise HTTPException(status_code=410, detail="Hasil sudah kedaluwarsa")

    return FileResponse(
        path=job.result_path,
        filename=job.result_filename or os.path.basename(job.result_path),
        media_type=job.media_type or _media_type_for(job.result_path),
    )


@router.delete("/jobs/{job_id}")
async def cancel_job(job_id: str):
    job = job_store.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job tidak ditemukan")

    cancelled = await job_store.cancel(job_id)
    if not cancelled:
        raise HTTPException(
            status_code=409, detail=f"Job tidak bisa dibatalkan ({job.status})"
        )

    return {"job_id": job_id, "status": "cancelled"}
