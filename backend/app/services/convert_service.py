"""
Layanan konversi dokumen untuk UltraPDF.

Semua konversi berbasis LibreOffice memakai pool profil yang dipakai ulang
(lihat LibreOfficeProfilePool) supaya konversi kedua dan seterusnya tidak
membayar ongkos pembuatan profil baru seperti pada PDFService.
"""

import asyncio
import csv
import logging
import os
import re
import shutil
import tempfile
import threading
import uuid
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Callable, Optional

from app.services.pdf_service import PDFService

logger = logging.getLogger(__name__)

PROCESS_TIMEOUT = int(os.getenv("PROCESS_TIMEOUT", "300"))
LIBREOFFICE_POOL_SIZE = int(os.getenv("LIBREOFFICE_POOL_SIZE", "2"))
LIBREOFFICE_PROFILE_ROOT = os.getenv(
    "LIBREOFFICE_PROFILE_ROOT",
    os.path.join(tempfile.gettempdir(), "ultrapdf_lo_profiles"),
)

# Ambang deteksi lapisan teks PDF, dipakai saat konversi PDF ke Word.
# Di bawah PDF_MIN_CHARS_PER_PAGE halaman dianggap hasil pindaian murni; di atas
# PDF_HIDDEN_TEXT_RATIO teksnya dianggap lapisan OCR tak terlihat; DOCX dianggap
# gagal bila teksnya kurang dari PDF_DOCX_TEXT_RATIO kali teks PDF aslinya.
PDF_MIN_CHARS_PER_PAGE = int(os.getenv("PDF_MIN_CHARS_PER_PAGE", "20"))
PDF_HIDDEN_TEXT_RATIO = float(os.getenv("PDF_HIDDEN_TEXT_RATIO", "0.6"))
PDF_DOCX_TEXT_RATIO = float(os.getenv("PDF_DOCX_TEXT_RATIO", "0.5"))

# Pengaturan OCR untuk PDF hasil pindaian. OCR jauh lebih lambat daripada
# konversi biasa (sekitar 2-3 detik per halaman), jadi batas waktunya dihitung
# per halaman, bukan memakai PROCESS_TIMEOUT yang datar.
OCR_DPI = int(os.getenv("OCR_DPI", "300"))
OCR_LANGUAGE = os.getenv("OCR_LANGUAGE", "ind+eng")
OCR_TIMEOUT_PER_PAGE = float(os.getenv("OCR_TIMEOUT_PER_PAGE", "15"))
OCR_MAX_PAGES = int(os.getenv("OCR_MAX_PAGES", "300"))

# Ekstensi yang bisa dibuka LibreOffice dan diekspor ke PDF
OFFICE_INPUT_EXTENSIONS = {
    ".doc", ".docx", ".odt", ".rtf", ".txt",
    ".xls", ".xlsx", ".ods", ".csv",
    ".ppt", ".pptx", ".odp",
    ".html", ".htm",
}

# Filter impor LibreOffice untuk format yang ambigu
LIBREOFFICE_INPUT_FILTERS = {
    ".csv": "Text - txt - csv (StarCalc)",
    ".html": "HTML (StarWriter)",
    ".htm": "HTML (StarWriter)",
}

# Filter ekspor PDF untuk tiap keluarga dokumen (dipakai saat butuh opsi khusus)
PDF_EXPORT_FILTERS = {
    "writer": "writer_pdf_Export",
    "calc": "calc_pdf_Export",
    "impress": "impress_pdf_Export",
    "draw": "draw_pdf_Export",
}

# Ekstensi gambar yang bisa dihasilkan dari PDF. PyMuPDF hanya bisa menulis
# JPG dan PNG sendiri; WebP dan TIFF ditulis lewat Pillow.
IMAGE_TARGET_EXTENSIONS = {
    "jpg": "jpg",
    "jpeg": "jpg",
    "png": "png",
    "webp": "webp",
    "tif": "tiff",
    "tiff": "tiff",
}

PILLOW_IMAGE_FORMATS = {"webp": "WEBP", "tiff": "TIFF"}


def resolve_image_extension(image_format: str) -> str:
    """Normalkan nama format gambar menjadi ekstensi berkas yang dipakai."""
    extension = IMAGE_TARGET_EXTENSIONS.get((image_format or "").lower())
    if not extension:
        allowed = ", ".join(sorted(set(IMAGE_TARGET_EXTENSIONS)))
        raise ValueError(f"Format gambar harus salah satu dari: {allowed}")
    return extension


SPREADSHEET_EXTENSIONS = {".xls", ".xlsx", ".ods", ".csv"}
PRESENTATION_EXTENSIONS = {".ppt", ".pptx", ".odp"}


class LibreOfficeProfilePool:
    """
    Pool profil pengguna LibreOffice.

    PDFService membuat direktori profil baru tiap request lalu menghapusnya.
    Itu aman tapi lambat karena LibreOffice harus menginisialisasi profil dari nol
    setiap konversi. Pool ini menyimpan sejumlah profil yang dipakai bergantian,
    sekaligus membatasi jumlah proses LibreOffice yang berjalan bersamaan.
    """

    def __init__(
        self,
        size: int = LIBREOFFICE_POOL_SIZE,
        root: str = LIBREOFFICE_PROFILE_ROOT,
    ):
        self.size = max(1, size)
        self.root = root
        self._queue: Optional[asyncio.Queue] = None
        self._lock = asyncio.Lock()

    async def _ensure_queue(self) -> asyncio.Queue:
        # Queue dibuat lazily karena butuh event loop yang sudah berjalan
        if self._queue is not None:
            return self._queue

        async with self._lock:
            if self._queue is None:
                os.makedirs(self.root, exist_ok=True)
                queue: asyncio.Queue = asyncio.Queue()
                for index in range(self.size):
                    profile_dir = os.path.join(self.root, f"profile_{index}")
                    os.makedirs(profile_dir, exist_ok=True)
                    queue.put_nowait(profile_dir)
                self._queue = queue
                logger.info(
                    f"LibreOffice profile pool siap ({self.size} profil di {self.root})"
                )

        return self._queue

    @asynccontextmanager
    async def acquire(self):
        queue = await self._ensure_queue()
        profile_dir = await queue.get()
        try:
            os.makedirs(profile_dir, exist_ok=True)
            yield profile_dir
        finally:
            queue.put_nowait(profile_dir)

    async def reset(self, profile_dir: str):
        """Buang profil yang korup (dipanggil setelah konversi gagal)."""
        try:
            await asyncio.to_thread(shutil.rmtree, profile_dir, True)
            os.makedirs(profile_dir, exist_ok=True)
            logger.warning(f"Profil LibreOffice direset: {profile_dir}")
        except Exception as e:
            logger.error(f"Gagal mereset profil LibreOffice {profile_dir}: {e}")


libreoffice_pool = LibreOfficeProfilePool()


def parse_page_ranges(spec: Optional[str], total_pages: int) -> list[int]:
    """
    Ubah spesifikasi halaman ("1-3,5,8-") menjadi daftar indeks 0-based.
    Spec kosong berarti semua halaman.
    """
    if not spec or not spec.strip():
        return list(range(total_pages))

    pages: list[int] = []
    for chunk in spec.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue

        if "-" in chunk:
            start_raw, _, end_raw = chunk.partition("-")
            try:
                start = int(start_raw) if start_raw.strip() else 1
                end = int(end_raw) if end_raw.strip() else total_pages
            except ValueError:
                raise ValueError(f"Rentang halaman tidak valid: {chunk}")
        else:
            try:
                start = end = int(chunk)
            except ValueError:
                raise ValueError(f"Nomor halaman tidak valid: {chunk}")

        if start < 1 or end < start:
            raise ValueError(f"Rentang halaman tidak valid: {chunk}")

        for page in range(start, min(end, total_pages) + 1):
            if page - 1 not in pages:
                pages.append(page - 1)

    if not pages:
        raise ValueError("Rentang halaman tidak menghasilkan halaman apa pun")

    return pages


def create_zip(file_paths: list[str], output_path: str) -> str:
    """Bungkus beberapa hasil konversi menjadi satu ZIP."""
    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

    used_names: dict[str, int] = {}
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as archive:
        for path in file_paths:
            arcname = os.path.basename(path)
            # Cegah tabrakan nama di dalam arsip
            if arcname in used_names:
                used_names[arcname] += 1
                stem, ext = os.path.splitext(arcname)
                arcname = f"{stem}_{used_names[arcname]}{ext}"
            else:
                used_names[arcname] = 0
            archive.write(path, arcname)

    return output_path


class ConvertService:
    # ------------------------------------------------------------------
    # Office (Word/Excel/PowerPoint/ODF/RTF/TXT/HTML) -> PDF
    # ------------------------------------------------------------------
    @staticmethod
    async def office_to_pdf(
        input_path: str,
        output_dir: str,
        pdf_variant: Optional[str] = None,
        fit_to_page: bool = False,
    ) -> Optional[str]:
        """
        Konversi dokumen Office/ODF/teks apa pun yang dikenal LibreOffice ke PDF.

        pdf_variant "pdfa" mengekspor sebagai PDF/A-2b.
        fit_to_page hanya berlaku untuk spreadsheet (semua kolom masuk satu halaman).
        """
        if not os.path.exists(input_path):
            logger.error(f"Input file not found: {input_path}")
            return None

        os.makedirs(output_dir, exist_ok=True)
        ext = Path(input_path).suffix.lower()

        convert_target = "pdf"
        export_options: list[str] = []

        if pdf_variant == "pdfa":
            # SelectPdfVersion 2 = PDF/A-2b pada LibreOffice 7+
            export_options.append('"SelectPdfVersion":{"type":"long","value":"2"}')

        if fit_to_page and ext in SPREADSHEET_EXTENSIONS:
            export_options.append('"SinglePageSheets":{"type":"boolean","value":"true"}')

        if export_options:
            if ext in SPREADSHEET_EXTENSIONS:
                family = "calc"
            elif ext in PRESENTATION_EXTENSIONS:
                family = "impress"
            else:
                family = "writer"
            joined = ",".join(export_options)
            convert_target = f"pdf:{PDF_EXPORT_FILTERS[family]}:{{{joined}}}"

        command_tail = ["--convert-to", convert_target, "--outdir", output_dir, input_path]

        infilter = LIBREOFFICE_INPUT_FILTERS.get(ext)
        if infilter:
            command_tail.insert(0, f"--infilter={infilter}")

        return await ConvertService._run_libreoffice(
            input_path, output_dir, command_tail, ".pdf", "Office to PDF"
        )

    # ------------------------------------------------------------------
    # PDF -> Office
    # ------------------------------------------------------------------
    @staticmethod
    def _analyze_pdf_text(input_path: str) -> dict:
        """
        Periksa lapisan teks PDF supaya mode konversi ke DOCX bisa dipilih.

        PDF hasil pemindaian yang sudah di-OCR menyimpan teksnya sebagai teks
        tak terlihat (render mode 3) di atas gambar halaman. pdf2docx secara
        bawaan membuang teks semacam itu, sehingga DOCX-nya hanya berisi gambar
        dan tidak bisa diedit. Hasil analisis ini yang menentukan penanganannya.
        """
        fitz = ConvertService._import_fitz()

        document = fitz.open(input_path)
        try:
            page_count = document.page_count or 1
            total_chars = 0
            visible_chars = 0
            hidden_chars = 0

            for page in document:
                total_chars += len(page.get_text("text").strip())
                try:
                    spans = page.get_texttrace()
                except Exception:
                    # get_texttrace bisa gagal pada font rusak; abaikan halamannya
                    continue

                for span in spans:
                    char_count = len(span.get("chars") or ())
                    if span.get("type") == 3:
                        hidden_chars += char_count
                    else:
                        visible_chars += char_count
        finally:
            document.close()

        traced = visible_chars + hidden_chars
        return {
            "pages": page_count,
            "chars": total_chars,
            "chars_per_page": total_chars / page_count,
            "hidden_ratio": (hidden_chars / traced) if traced else 0.0,
        }

    @staticmethod
    def _docx_text_length(path: str) -> int:
        """Hitung panjang teks yang benar-benar bisa diedit di dalam DOCX."""
        try:
            from docx import Document
        except ImportError:
            # Tanpa python-docx hasilnya tidak bisa diverifikasi; anggap lolos
            return -1

        def paragraphs_length(paragraphs) -> int:
            return sum(len(paragraph.text.strip()) for paragraph in paragraphs)

        try:
            document = Document(path)
        except Exception:
            return 0

        total = paragraphs_length(document.paragraphs)
        for table in document.tables:
            for row in table.rows:
                for cell in row.cells:
                    total += paragraphs_length(cell.paragraphs)
        return total

    @staticmethod
    def _run_pdf2docx(input_path: str, output_path: str, ocr_mode: int) -> None:
        """
        Jalankan pdf2docx dengan mode lapisan teks tertentu.

        ocr_mode 0 memakai teks yang terlihat (PDF digital biasa), ocr_mode 2
        memakai teks tak terlihat hasil OCR dan mengabaikan gambar halaman.
        """
        from pdf2docx import Converter

        converter = Converter(input_path)
        try:
            converter.convert(output_path, start=0, end=None, ocr=ocr_mode)
        finally:
            converter.close()

    @staticmethod
    def _build_docx_from_pdf_text(input_path: str, output_path: str) -> None:
        """
        Bangun DOCX langsung dari span teks PDF memakai python-docx.

        Cadangan terakhir ketika pdf2docx gagal menghasilkan teks: layout kolom
        dan tabel tidak dipertahankan, tapi seluruh isinya dijamin berupa teks
        yang bisa diedit, lengkap dengan ukuran huruf, tebal, dan miringnya.
        """
        fitz = ConvertService._import_fitz()
        from docx import Document
        from docx.shared import Pt

        document = fitz.open(input_path)
        docx_document = Document()
        try:
            for page_index, page in enumerate(document):
                if page_index:
                    docx_document.add_page_break()

                for block in page.get_text("dict").get("blocks", []):
                    if block.get("type") != 0:  # 0 = blok teks
                        continue

                    lines = block.get("lines") or []
                    if not any(
                        span.get("text", "").strip()
                        for line in lines
                        for span in line.get("spans") or ()
                    ):
                        continue

                    paragraph = docx_document.add_paragraph()
                    for line_index, line in enumerate(lines):
                        if line_index:
                            paragraph.add_run(" ")
                        for span in line.get("spans") or ():
                            text = span.get("text", "")
                            if not text:
                                continue
                            run = paragraph.add_run(text)
                            size = span.get("size")
                            if size:
                                run.font.size = Pt(round(float(size), 1))
                            flags = span.get("flags", 0)
                            run.bold = bool(flags & 2 ** 4)
                            run.italic = bool(flags & 2 ** 1)

            docx_document.save(output_path)
        finally:
            document.close()

    _ocr_reader = None
    _ocr_reader_lock = threading.Lock()

    @staticmethod
    def _load_ocr_reader():
        """
        Ambil mesin OCR yang tersedia, atau None kalau tidak ada satu pun.

        Dikembalikan sebagai fungsi yang menerima PNG halaman dan mengembalikan
        daftar baris teks sesuai urutan baca. RapidOCR dipakai lebih dulu karena
        cukup dipasang lewat pip (memakai onnxruntime yang sudah jadi dependensi),
        sedangkan Tesseract butuh binary sistem.

        Hasilnya di-cache karena memuat model ONNX makan waktu beberapa detik;
        tanpa cache ongkos itu dibayar ulang tiap konversi.
        """
        if ConvertService._ocr_reader is not None:
            return ConvertService._ocr_reader or None

        with ConvertService._ocr_reader_lock:
            if ConvertService._ocr_reader is None:
                ConvertService._ocr_reader = ConvertService._build_ocr_reader() or False
        return ConvertService._ocr_reader or None

    @staticmethod
    def _build_ocr_reader():
        """
        Siapkan pembaca OCR dari mesin pertama yang terpasang.

        Pembaca menerima PNG halaman dan mengembalikan daftar dict berisi
        ``text`` dan ``bbox`` (x0, y0, x1, y1 dalam piksel gambar). Kotaknya ikut
        dikembalikan karena fitur "PDF bisa dicari" perlu menempatkan teks tak
        terlihat tepat di atas tulisan aslinya, bukan sekadar tahu isinya.
        """
        try:
            from rapidocr_onnxruntime import RapidOCR
        except ImportError:
            pass
        else:
            engine = RapidOCR()

            def read_with_rapidocr(image_bytes: bytes) -> list:
                # use_cls=False: klasifikator sudut kadang membalik baris yang
                # sebenarnya sudah tegak sehingga isinya rusak. Halaman di sini
                # selalu dirender dari PDF (rotasi halaman sudah diterapkan
                # PyMuPDF), jadi orientasinya dijamin benar dan pemeriksaan itu
                # hanya menambah risiko sekaligus memperlambat.
                result, _ = engine(image_bytes, use_cls=False)
                if not result:
                    return []

                # Tiap entri: [4 titik kotak, teks, skor]
                items = []
                for box, text, *_ in result:
                    text = str(text)
                    if not text.strip():
                        continue
                    xs = [point[0] for point in box]
                    ys = [point[1] for point in box]
                    items.append(
                        {
                            "text": text,
                            "bbox": (min(xs), min(ys), max(xs), max(ys)),
                        }
                    )
                return items

            return read_with_rapidocr

        try:
            import io

            import pytesseract
            from PIL import Image
        except ImportError:
            return None

        def read_with_tesseract(image_bytes: bytes) -> list:
            with Image.open(io.BytesIO(image_bytes)) as image:
                data = pytesseract.image_to_data(
                    image, lang=OCR_LANGUAGE, output_type=pytesseract.Output.DICT
                )

            items = []
            for index, text in enumerate(data["text"]):
                if not text.strip():
                    continue
                left = data["left"][index]
                top = data["top"][index]
                items.append(
                    {
                        "text": text,
                        "bbox": (
                            left,
                            top,
                            left + data["width"][index],
                            top + data["height"][index],
                        ),
                    }
                )
            return items

        return read_with_tesseract

    @staticmethod
    def _require_ocr_reader():
        """Ambil pembaca OCR, atau tolak permintaan dengan pesan yang jelas."""
        reader = ConvertService._load_ocr_reader()
        if reader is None:
            # ValueError agar endpoint membalas 400: ini kondisi dokumen,
            # bukan kegagalan server
            raise ValueError(
                "PDF ini hasil pindaian dan tidak punya lapisan teks, jadi isinya "
                "harus dikenali lewat OCR. Fitur OCR belum aktif di server ini."
            )
        return reader

    @staticmethod
    def _guard_ocr_page_count(page_count: int) -> None:
        """Tolak dokumen pindaian yang terlalu panjang untuk di-OCR."""
        if page_count > OCR_MAX_PAGES:
            raise ValueError(
                f"PDF ini hasil pindaian dengan {page_count} halaman, terlalu panjang "
                f"untuk dikenali lewat OCR (batas {OCR_MAX_PAGES} halaman). "
                "Pecah dokumennya lebih dulu."
            )

    @staticmethod
    def _ocr_timeout(page_count: int) -> float:
        """Batas waktu OCR dihitung per halaman karena jauh lebih lambat."""
        return max(PROCESS_TIMEOUT, page_count * OCR_TIMEOUT_PER_PAGE)

    @staticmethod
    def _ocr_page_items(page, reader) -> list:
        """
        Kenali isi satu halaman, lengkap dengan kotak dalam satuan titik PDF.

        Halaman dirender pada OCR_DPI lalu koordinat piksel dikembalikan ke
        satuan halaman, sehingga kotaknya bisa langsung dipakai untuk menaruh
        teks di posisi yang sama.
        """
        pixmap = page.get_pixmap(dpi=OCR_DPI)
        items = reader(pixmap.tobytes("png"))

        scale = 72.0 / OCR_DPI
        for item in items:
            x0, y0, x1, y1 = item["bbox"]
            item["bbox"] = (x0 * scale, y0 * scale, x1 * scale, y1 * scale)
        return items

    @staticmethod
    def _ocr_page_lines(page, reader) -> list:
        """
        Render satu halaman lalu kembalikan baris teks sesuai urutan baca.

        Potongan yang tinggi tengahnya berdekatan digabung jadi satu baris,
        supaya hasilnya terbaca sebagai kalimat, bukan serpihan lepas.
        """
        items = ConvertService._ocr_page_items(page, reader)
        if not items:
            return []

        ordered = sorted(
            items,
            key=lambda item: ((item["bbox"][1] + item["bbox"][3]) / 2, item["bbox"][0]),
        )

        lines: list = []
        current: list = []
        current_y = None
        for item in ordered:
            x0, y0, x1, y1 = item["bbox"]
            center_y = (y0 + y1) / 2
            height = max(y1 - y0, 1)
            if current_y is not None and abs(center_y - current_y) > height * 0.6:
                lines.append(" ".join(current))
                current = []
                current_y = None
            current.append(item["text"])
            if current_y is None:
                current_y = center_y

        if current:
            lines.append(" ".join(current))
        return lines

    @staticmethod
    def _ocr_pdf_to_docx(
        input_path: str, output_path: str, progress: Optional[Callable] = None
    ) -> None:
        """
        Kenali teks dari PDF hasil pindaian lalu tulis ke DOCX.

        Dipakai saat PDF sama sekali tidak punya lapisan teks, jadi satu-satunya
        cara menghasilkan Word yang bisa diedit adalah membaca gambar halamannya.
        """
        reader = ConvertService._require_ocr_reader()

        fitz = ConvertService._import_fitz()
        from docx import Document

        document = fitz.open(input_path)
        docx_document = Document()
        try:
            total_pages = document.page_count
            for page_index, page in enumerate(document):
                if page_index:
                    docx_document.add_page_break()

                for line in ConvertService._ocr_page_lines(page, reader):
                    docx_document.add_paragraph(line)

                ConvertService._report_progress(progress, page_index + 1, total_pages)

            docx_document.save(output_path)
        finally:
            document.close()

    @staticmethod
    def _report_progress(progress: Optional[Callable], done: int, total: int) -> None:
        """
        Laporkan kemajuan per halaman tanpa membiarkan errornya menggagalkan konversi.

        Callback datang dari pemanggil (mis. job store) dan hanya bersifat
        informatif, jadi kegagalannya tidak boleh membatalkan pekerjaan asli.
        """
        if progress is None:
            return
        try:
            progress(done, total)
        except Exception:
            logger.debug("Callback progres gagal", exc_info=True)

    @staticmethod
    async def pdf_to_docx(
        input_path: str, output_path: str, progress: Optional[Callable] = None
    ) -> bool:
        """
        Konversi PDF ke DOCX dengan isi yang tetap bisa diedit.

        pdf2docx dipakai lebih dulu karena layoutnya jauh lebih terjaga daripada
        LibreOffice, tapi ia hanya membaca satu jenis lapisan teks sekaligus.
        Karena itu modenya dipilih dari hasil analisis PDF, keluarannya diperiksa
        ulang, dan kalau teksnya tetap kosong konversi dijatuhkan ke pembangun
        DOCX berbasis teks (atau OCR untuk PDF hasil pindaian) supaya hasilnya
        tidak pernah berupa gambar saja.
        """
        try:
            import pdf2docx  # noqa: F401
        except ImportError:
            logger.error("pdf2docx tidak terpasang")
            raise RuntimeError("Fitur PDF ke Word belum tersedia di server ini")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        # Analisis dilakukan di luar konversi karena hasilnya ikut menentukan
        # batas waktu: jalur OCR butuh jauh lebih lama daripada pdf2docx.
        try:
            stats = await asyncio.to_thread(ConvertService._analyze_pdf_text, input_path)
        except Exception as e:
            logger.warning(f"Analisis lapisan teks PDF gagal, pakai mode standar: {e}")
            stats = {"pages": 1, "chars": 0, "chars_per_page": 999.0, "hidden_ratio": 0.0}

        needs_ocr = stats["chars_per_page"] < PDF_MIN_CHARS_PER_PAGE
        if needs_ocr:
            ConvertService._guard_ocr_page_count(stats["pages"])

        timeout = (
            ConvertService._ocr_timeout(stats["pages"]) if needs_ocr else PROCESS_TIMEOUT
        )

        def perform_conversion():
            # Tanpa lapisan teks sama sekali hanya OCR yang bisa menolong
            if needs_ocr:
                logger.info(
                    f"PDF terdeteksi hasil pindaian ({stats['pages']} halaman), "
                    "konversi lewat OCR"
                )
                ConvertService._ocr_pdf_to_docx(input_path, output_path, progress)
                return

            # Teks tersembunyi mendominasi berarti PDF pindaian yang sudah di-OCR:
            # pdf2docx harus diminta membaca lapisan itu (ocr=2), kalau tidak yang
            # tersisa hanya gambar halaman.
            primary_mode = 2 if stats["hidden_ratio"] >= PDF_HIDDEN_TEXT_RATIO else 0
            modes = [primary_mode, 0 if primary_mode == 2 else 2]
            minimum_chars = max(1, int(stats["chars"] * PDF_DOCX_TEXT_RATIO))

            for mode in modes:
                try:
                    ConvertService._run_pdf2docx(input_path, output_path, mode)
                except Exception as e:
                    logger.warning(f"pdf2docx gagal pada mode ocr={mode}: {e}")
                    continue

                extracted = ConvertService._docx_text_length(output_path)
                if extracted < 0 or extracted >= minimum_chars:
                    return

                logger.warning(
                    f"DOCX dari pdf2docx mode ocr={mode} cuma berisi {extracted} karakter "
                    f"(PDF punya {stats['chars']}), coba mode lain"
                )

            # pdf2docx tetap tidak menghasilkan teks memadai: susun ulang dari span
            # teks PDF supaya isinya dijamin bisa diedit
            logger.info("Membangun DOCX langsung dari teks PDF sebagai cadangan")
            ConvertService._build_docx_from_pdf_text(input_path, output_path)

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.error(f"PDF ke DOCX timeout setelah {timeout:.0f}s")
            return False
        except (ValueError, RuntimeError):
            raise
        except Exception as e:
            logger.error(f"Error saat konversi PDF ke DOCX: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)

    @staticmethod
    async def pdf_to_xlsx(
        input_path: str, output_path: str, progress: Optional[Callable] = None
    ) -> bool:
        """
        Ekstrak tabel dari PDF ke XLSX (satu sheet per tabel).

        LibreOffice tidak mendukung arah ini, jadi dipakai deteksi tabel PyMuPDF.
        Bila tak ada tabel, isinya dijatuhkan ke teks per baris; untuk PDF hasil
        pindaian teks itu diambil lewat OCR supaya keluarannya tidak berupa buku
        kerja kosong yang tetap dilaporkan sukses.
        """
        fitz = ConvertService._import_fitz()
        try:
            from openpyxl import Workbook
        except ImportError:
            logger.error("openpyxl tidak terpasang")
            raise RuntimeError("Fitur PDF ke Excel belum tersedia di server ini")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        stats = await asyncio.to_thread(ConvertService._analyze_pdf_text, input_path)
        needs_ocr = stats["chars_per_page"] < PDF_MIN_CHARS_PER_PAGE
        if needs_ocr:
            ConvertService._guard_ocr_page_count(stats["pages"])
        timeout = (
            ConvertService._ocr_timeout(stats["pages"]) if needs_ocr else PROCESS_TIMEOUT
        )

        def perform_conversion():
            document = fitz.open(input_path)
            workbook = Workbook()
            workbook.remove(workbook.active)
            table_count = 0

            try:
                total_pages = document.page_count
                for page_index, page in enumerate(document, start=1):
                    try:
                        tables = page.find_tables()
                    except Exception:
                        continue

                    for table_index, table in enumerate(tables.tables, start=1):
                        rows = table.extract()
                        if not rows:
                            continue

                        table_count += 1
                        title = (
                            f"Hal {page_index}"
                            if table_index == 1
                            else f"Hal {page_index}-{table_index}"
                        )
                        sheet = workbook.create_sheet(title[:31])
                        for row in rows:
                            sheet.append(
                                ["" if cell is None else str(cell) for cell in row]
                            )

                    ConvertService._report_progress(progress, page_index, total_pages)

                # Tidak ada tabel terdeteksi: jatuhkan ke teks per baris agar hasil tetap berguna
                if table_count == 0:
                    reader = ConvertService._require_ocr_reader() if needs_ocr else None
                    sheet = workbook.create_sheet("Teks")
                    for page_index, page in enumerate(document, start=1):
                        lines = page.get_text("text").splitlines()
                        if not any(line.strip() for line in lines) and reader is not None:
                            lines = ConvertService._ocr_page_lines(page, reader)

                        for line in lines:
                            sheet.append([f"Hal {page_index}", line])

                        ConvertService._report_progress(progress, page_index, total_pages)

                    if sheet.max_row <= 1 and sheet["A1"].value is None:
                        # ValueError agar endpoint membalas 400: ini kondisi dokumen,
                        # bukan kegagalan server
                        raise ValueError(
                            "Tidak ada tabel maupun teks yang bisa diambil dari PDF ini. "
                            "Kalau dokumennya hasil pindaian, aktifkan OCR di server."
                        )

                workbook.save(output_path)
            finally:
                document.close()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.error(f"PDF ke XLSX timeout setelah {timeout:.0f}s")
            return False
        except (ValueError, RuntimeError):
            raise
        except Exception as e:
            logger.error(f"Error saat konversi PDF ke XLSX: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)

    @staticmethod
    async def pdf_to_pptx(input_path: str, output_path: str, dpi: int = 150) -> bool:
        """
        Konversi PDF ke PPTX.

        Jalur utama: impor PDF lewat LibreOffice Draw (hasil masih bisa diedit).
        Fallback: render tiap halaman jadi gambar full-slide memakai python-pptx.
        """
        output_dir = os.path.dirname(output_path) or "."
        os.makedirs(output_dir, exist_ok=True)

        produced = await ConvertService._run_libreoffice(
            input_path,
            output_dir,
            [
                "--infilter=draw_pdf_import",
                "--convert-to",
                "pptx:Impress MS PowerPoint 2007 XML",
                "--outdir",
                output_dir,
                input_path,
            ],
            ".pptx",
            "PDF to PPTX",
        )

        if produced:
            if os.path.abspath(produced) != os.path.abspath(output_path):
                shutil.move(produced, output_path)
            return True

        logger.warning(
            "Impor PDF via LibreOffice Draw gagal, memakai fallback berbasis gambar"
        )
        return await ConvertService._pdf_to_pptx_images(input_path, output_path, dpi)

    @staticmethod
    async def _pdf_to_pptx_images(input_path: str, output_path: str, dpi: int) -> bool:
        fitz = ConvertService._import_fitz()
        try:
            from pptx import Presentation
            from pptx.util import Emu
        except ImportError:
            logger.error("python-pptx tidak terpasang")
            raise RuntimeError("Fitur PDF ke PowerPoint belum tersedia di server ini")

        def perform_conversion():
            document = fitz.open(input_path)
            presentation = Presentation()
            blank_layout = presentation.slide_layouts[6]
            zoom = dpi / 72.0

            try:
                with tempfile.TemporaryDirectory() as workdir:
                    for page_index, page in enumerate(document):
                        rect = page.rect
                        # Samakan ukuran slide dengan halaman pertama (1 pt = 12700 EMU)
                        if page_index == 0:
                            presentation.slide_width = Emu(int(rect.width * 12700))
                            presentation.slide_height = Emu(int(rect.height * 12700))

                        pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom))
                        image_path = os.path.join(workdir, f"page_{page_index}.png")
                        pixmap.save(image_path)

                        slide = presentation.slides.add_slide(blank_layout)
                        slide.shapes.add_picture(
                            image_path,
                            0,
                            0,
                            width=presentation.slide_width,
                            height=presentation.slide_height,
                        )

                    presentation.save(output_path)
            finally:
                document.close()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("PDF ke PPTX timeout")
            return False
        except Exception as e:
            logger.error(f"Error saat konversi PDF ke PPTX: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)

    # ------------------------------------------------------------------
    # PDF -> gambar / teks
    # ------------------------------------------------------------------
    @staticmethod
    async def pdf_to_images(
        input_path: str,
        output_dir: str,
        image_format: str = "png",
        dpi: int = 150,
        pages: Optional[str] = None,
        base_name: str = "page",
    ) -> list[str]:
        """Render halaman PDF menjadi PNG/JPG. Mengembalikan daftar path gambar."""
        fitz = ConvertService._import_fitz()
        os.makedirs(output_dir, exist_ok=True)

        extension = resolve_image_extension(image_format)

        def perform_conversion() -> list[str]:
            document = fitz.open(input_path)
            try:
                selected = parse_page_ranges(pages, document.page_count)
                zoom = max(dpi, 36) / 72.0
                matrix = fitz.Matrix(zoom, zoom)
                results: list[str] = []

                for page_index in selected:
                    page = document.load_page(page_index)
                    pixmap = page.get_pixmap(matrix=matrix)
                    image_path = os.path.join(
                        output_dir, f"{base_name}_{page_index + 1:03d}.{extension}"
                    )
                    ConvertService._save_pixmap(pixmap, image_path, extension, 90)
                    results.append(image_path)

                return results
            finally:
                document.close()

        return await asyncio.wait_for(
            asyncio.to_thread(perform_conversion), timeout=PROCESS_TIMEOUT
        )

    @staticmethod
    async def pdf_extract_images(
        input_path: str,
        output_dir: str,
        image_format: str = "jpg",
        pages: Optional[str] = None,
        base_name: str = "gambar",
    ) -> list[str]:
        """
        Ambil gambar yang tertanam di dalam PDF apa adanya.

        Berbeda dengan pdf_to_images yang merender seluruh halaman, fungsi ini
        hanya mengeluarkan objek gambar asli - berguna untuk memanen foto dari
        dokumen tanpa ikut membawa teks dan latar halaman.
        """
        fitz = ConvertService._import_fitz()
        os.makedirs(output_dir, exist_ok=True)

        extension = resolve_image_extension(image_format)

        def perform_extraction() -> list[str]:
            document = fitz.open(input_path)
            try:
                selected = parse_page_ranges(pages, document.page_count)
                results: list[str] = []
                # Satu gambar bisa dipakai di banyak halaman; xref menjaga agar
                # tidak tersimpan berulang kali
                seen: set[int] = set()

                for page_index in selected:
                    page = document.load_page(page_index)
                    for image in page.get_images(full=True):
                        xref = image[0]
                        if xref in seen:
                            continue
                        seen.add(xref)

                        pixmap = fitz.Pixmap(document, xref)
                        try:
                            # CMYK dan gambar bertopeng alfa perlu diubah ke RGB
                            # sebelum bisa ditulis sebagai JPG/PNG biasa
                            if pixmap.n - pixmap.alpha >= 4 or (
                                extension == "jpg" and pixmap.alpha
                            ):
                                converted = fitz.Pixmap(fitz.csRGB, pixmap)
                                pixmap = converted

                            image_path = os.path.join(
                                output_dir,
                                f"{base_name}_{page_index + 1:03d}_{len(results) + 1:02d}.{extension}",
                            )
                            ConvertService._save_pixmap(
                                pixmap, image_path, extension, 95
                            )
                            results.append(image_path)
                        finally:
                            pixmap = None

                return results
            finally:
                document.close()

        return await asyncio.wait_for(
            asyncio.to_thread(perform_extraction), timeout=PROCESS_TIMEOUT
        )

    @staticmethod
    async def pdf_to_text(
        input_path: str,
        output_path: str,
        text_format: str = "txt",
        pages: Optional[str] = None,
        progress: Optional[Callable] = None,
    ) -> bool:
        """
        Ekstrak isi PDF menjadi .txt atau .md.

        PDF hasil pindaian tidak punya teks yang bisa diambil, jadi halaman yang
        kosong dikenali lewat OCR. Tanpa itu keluarannya berupa berkas nol byte
        yang tetap dilaporkan sukses.
        """
        fitz = ConvertService._import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        stats = await asyncio.to_thread(ConvertService._analyze_pdf_text, input_path)
        needs_ocr = stats["chars_per_page"] < PDF_MIN_CHARS_PER_PAGE
        if needs_ocr:
            ConvertService._guard_ocr_page_count(stats["pages"])
        timeout = (
            ConvertService._ocr_timeout(stats["pages"]) if needs_ocr else PROCESS_TIMEOUT
        )

        def perform_conversion():
            # pymupdf4llm menghasilkan Markdown yang jauh lebih rapi bila tersedia,
            # tapi ia sama-sama bergantung pada lapisan teks sehingga dilewati untuk
            # dokumen pindaian
            if text_format == "md" and not needs_ocr:
                try:
                    import pymupdf4llm

                    content = pymupdf4llm.to_markdown(input_path)
                    Path(output_path).write_text(content, encoding="utf-8")
                    return
                except ImportError:
                    logger.info(
                        "pymupdf4llm tidak tersedia, memakai ekstraksi Markdown sederhana"
                    )

            reader = ConvertService._require_ocr_reader() if needs_ocr else None

            document = fitz.open(input_path)
            try:
                selected = parse_page_ranges(pages, document.page_count)
                blocks: list[str] = []

                for position, page_index in enumerate(selected, start=1):
                    page = document.load_page(page_index)
                    text = page.get_text("text").strip()
                    if not text and reader is not None:
                        lines = ConvertService._ocr_page_lines(page, reader)
                        text = "\n".join(lines).strip()

                    if text_format == "md":
                        blocks.append(f"## Halaman {page_index + 1}\n\n{text}")
                    else:
                        blocks.append(text)

                    ConvertService._report_progress(progress, position, len(selected))

                if not any(block.strip() for block in blocks):
                    raise ValueError(
                        "Tidak ada teks yang bisa diambil dari PDF ini. Kalau "
                        "dokumennya hasil pindaian, aktifkan OCR di server."
                    )

                separator = "\n\n---\n\n" if text_format == "md" else "\n\n\f\n\n"
                Path(output_path).write_text(separator.join(blocks), encoding="utf-8")
            finally:
                document.close()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.error(f"Ekstraksi teks PDF timeout setelah {timeout:.0f}s")
            return False
        except (ValueError, RuntimeError):
            raise
        except Exception as e:
            logger.error(f"Error saat ekstraksi teks PDF: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)

    @staticmethod
    async def pdf_to_html(
        input_path: str, output_path: str, pages: Optional[str] = None
    ) -> bool:
        """
        Ekstrak PDF menjadi satu berkas HTML yang mempertahankan tata letak.

        PyMuPDF mengeluarkan dokumen HTML lengkap per halaman, jadi isi <body>
        tiap halaman diambil lalu dijahit menjadi satu berkas agar hasilnya
        tetap satu dokumen yang bisa dibuka langsung di browser.
        """
        fitz = ConvertService._import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform_conversion():
            document = fitz.open(input_path)
            try:
                selected = parse_page_ranges(pages, document.page_count)
                sections: list[str] = []

                for page_index in selected:
                    page = document.load_page(page_index)
                    body = ConvertService._extract_html_body(page.get_text("html"))
                    sections.append(
                        f'<section class="halaman" id="halaman-{page_index + 1}">\n'
                        f"{body}\n</section>"
                    )

                title = Path(input_path).stem
                content = "\n".join(sections)
                Path(output_path).write_text(
                    ConvertService._wrap_html(title, content, page_break_class="halaman"),
                    encoding="utf-8",
                )
            finally:
                document.close()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("PDF ke HTML timeout")
            return False
        except Exception as e:
            logger.error(f"Error saat konversi PDF ke HTML: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)

    @staticmethod
    async def pdf_to_csv(
        input_path: str,
        output_dir: str,
        pages: Optional[str] = None,
        base_name: str = "tabel",
    ) -> list[str]:
        """
        Ekstrak tiap tabel di PDF menjadi satu berkas CSV.

        Berbeda dengan pdf_to_xlsx yang menumpuk semua tabel dalam satu buku
        kerja, di sini tiap tabel berdiri sendiri supaya mudah diimpor ke alat
        lain. Mengembalikan daftar path CSV yang dihasilkan.
        """
        fitz = ConvertService._import_fitz()
        os.makedirs(output_dir, exist_ok=True)

        def perform_conversion() -> list[str]:
            document = fitz.open(input_path)
            try:
                selected = parse_page_ranges(pages, document.page_count)
                results: list[str] = []

                for page_index in selected:
                    page = document.load_page(page_index)
                    try:
                        tables = page.find_tables()
                    except Exception:
                        continue

                    for table_index, table in enumerate(tables.tables, start=1):
                        rows = table.extract()
                        if not rows:
                            continue

                        csv_path = os.path.join(
                            output_dir,
                            f"{base_name}_{page_index + 1:03d}_{table_index:02d}.csv",
                        )
                        # utf-8-sig supaya Excel di Windows membaca karakter
                        # non-ASCII dengan benar
                        with open(
                            csv_path, "w", newline="", encoding="utf-8-sig"
                        ) as handle:
                            writer = csv.writer(handle)
                            for row in rows:
                                writer.writerow(
                                    ["" if cell is None else str(cell) for cell in row]
                                )
                        results.append(csv_path)

                return results
            finally:
                document.close()

        return await asyncio.wait_for(
            asyncio.to_thread(perform_conversion), timeout=PROCESS_TIMEOUT
        )

    # ------------------------------------------------------------------
    # HTML / Markdown -> PDF
    # ------------------------------------------------------------------
    @staticmethod
    async def html_to_pdf(
        output_path: str,
        html_path: Optional[str] = None,
        url: Optional[str] = None,
        base_url: Optional[str] = None,
    ) -> bool:
        """Render berkas HTML atau URL menjadi PDF memakai WeasyPrint."""
        try:
            from weasyprint import HTML
        except ImportError:
            logger.error("weasyprint tidak terpasang")
            raise RuntimeError("Fitur HTML ke PDF belum tersedia di server ini")
        except OSError as e:
            # WeasyPrint memuat Pango/Cairo lewat cffi saat diimpor. Di mesin tanpa
            # pustaka GTK (mis. Windows dev) impor gagal dengan OSError, bukan ImportError.
            logger.error(f"Pustaka sistem WeasyPrint tidak tersedia: {e}")
            raise RuntimeError(
                "Fitur HTML ke PDF butuh pustaka Pango/Cairo yang belum terpasang di server ini"
            )

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform_conversion():
            if url:
                document = HTML(url=url)
            else:
                document = HTML(filename=html_path, base_url=base_url)
            document.write_pdf(output_path)

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("HTML ke PDF timeout")
            return False
        except Exception as e:
            logger.error(f"Error saat konversi HTML ke PDF: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)

    @staticmethod
    async def markdown_to_pdf(input_path: str, output_path: str) -> bool:
        """Markdown -> HTML -> PDF."""
        try:
            import markdown as markdown_lib
        except ImportError:
            logger.error("markdown tidak terpasang")
            raise RuntimeError("Fitur Markdown ke PDF belum tersedia di server ini")

        source = Path(input_path).read_text(encoding="utf-8", errors="replace")
        body = markdown_lib.markdown(
            source, extensions=["extra", "sane_lists", "tables", "toc"]
        )
        html = ConvertService._wrap_html(Path(input_path).stem, body)

        with tempfile.NamedTemporaryFile(
            "w", suffix=".html", delete=False, encoding="utf-8"
        ) as handle:
            handle.write(html)
            temp_html = handle.name

        try:
            return await ConvertService.html_to_pdf(
                output_path, html_path=temp_html, base_url=str(Path(input_path).parent)
            )
        finally:
            try:
                os.remove(temp_html)
            except OSError:
                pass

    # ------------------------------------------------------------------
    # EPUB
    # ------------------------------------------------------------------
    @staticmethod
    async def epub_to_pdf(input_path: str, output_path: str) -> bool:
        """Gabungkan seluruh dokumen HTML di dalam EPUB lalu render ke PDF."""
        try:
            import ebooklib
            from ebooklib import epub
        except ImportError:
            logger.error("ebooklib tidak terpasang")
            raise RuntimeError("Fitur EPUB ke PDF belum tersedia di server ini")

        def extract_html() -> str:
            book = epub.read_epub(input_path)
            chunks: list[str] = []
            for item in book.get_items_of_type(ebooklib.ITEM_DOCUMENT):
                content = item.get_content().decode("utf-8", errors="replace")
                chunks.append(f'<div class="chapter">{content}</div>')
            return "".join(chunks)

        try:
            body = await asyncio.to_thread(extract_html)
        except Exception as e:
            logger.error(f"Gagal membaca EPUB: {e}", exc_info=True)
            return False

        html = ConvertService._wrap_html(
            Path(input_path).stem, body, page_break_class="chapter"
        )

        with tempfile.NamedTemporaryFile(
            "w", suffix=".html", delete=False, encoding="utf-8"
        ) as handle:
            handle.write(html)
            temp_html = handle.name

        try:
            return await ConvertService.html_to_pdf(output_path, html_path=temp_html)
        finally:
            try:
                os.remove(temp_html)
            except OSError:
                pass

    @staticmethod
    async def pdf_to_epub(
        input_path: str,
        output_path: str,
        title: Optional[str] = None,
        progress: Optional[Callable] = None,
    ) -> bool:
        """
        Bangun EPUB dari teks PDF (satu bab per halaman).

        Layout kompleks tidak dipertahankan - EPUB memang format teks mengalir.
        Halaman tanpa teks dikenali lewat OCR; tanpa itu PDF hasil pindaian
        menghasilkan EPUB berisi bab-bab kosong yang tetap dilaporkan sukses.
        """
        fitz = ConvertService._import_fitz()
        try:
            from ebooklib import epub
        except ImportError:
            logger.error("ebooklib tidak terpasang")
            raise RuntimeError("Fitur PDF ke EPUB belum tersedia di server ini")

        import html as html_module

        stats = await asyncio.to_thread(ConvertService._analyze_pdf_text, input_path)
        needs_ocr = stats["chars_per_page"] < PDF_MIN_CHARS_PER_PAGE
        if needs_ocr:
            ConvertService._guard_ocr_page_count(stats["pages"])
        timeout = (
            ConvertService._ocr_timeout(stats["pages"]) if needs_ocr else PROCESS_TIMEOUT
        )

        def perform_conversion():
            reader = ConvertService._require_ocr_reader() if needs_ocr else None
            document = fitz.open(input_path)
            try:
                book = epub.EpubBook()
                book.set_identifier(uuid.uuid4().hex)
                book.set_title(title or Path(input_path).stem)
                book.set_language("id")

                chapters = []
                total_pages = document.page_count
                has_text = False
                for page_index, page in enumerate(document, start=1):
                    text = page.get_text("text").strip()
                    if not text and reader is not None:
                        text = "\n\n".join(
                            ConvertService._ocr_page_lines(page, reader)
                        ).strip()
                    has_text = has_text or bool(text)
                    paragraphs = (
                        "".join(
                            f"<p>{html_module.escape(block)}</p>"
                            for block in text.split("\n\n")
                            if block.strip()
                        )
                        or "<p></p>"
                    )

                    chapter = epub.EpubHtml(
                        title=f"Halaman {page_index}",
                        file_name=f"page_{page_index}.xhtml",
                        lang="id",
                    )
                    chapter.content = f"<h2>Halaman {page_index}</h2>{paragraphs}"
                    book.add_item(chapter)
                    chapters.append(chapter)
                    ConvertService._report_progress(progress, page_index, total_pages)

                if not has_text:
                    # ValueError agar endpoint membalas 400: ini kondisi dokumen,
                    # bukan kegagalan server
                    raise ValueError(
                        "Tidak ada teks yang bisa diambil dari PDF ini, jadi EPUB-nya "
                        "akan kosong. Kalau dokumennya hasil pindaian, aktifkan OCR "
                        "di server."
                    )

                book.toc = tuple(chapters)
                book.add_item(epub.EpubNcx())
                book.add_item(epub.EpubNav())
                book.spine = ["nav", *chapters]

                epub.write_epub(output_path, book)
            finally:
                document.close()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=timeout
            )
        except asyncio.TimeoutError:
            logger.error(f"PDF ke EPUB timeout setelah {timeout:.0f}s")
            return False
        except (ValueError, RuntimeError):
            raise
        except Exception as e:
            logger.error(f"Error saat konversi PDF ke EPUB: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)

    # ------------------------------------------------------------------
    # PDF/A
    # ------------------------------------------------------------------
    @staticmethod
    async def pdf_to_pdfa(input_path: str, output_path: str, version: int = 2) -> bool:
        """Konversi PDF biasa ke PDF/A (arsip) memakai Ghostscript."""
        if version not in (1, 2, 3):
            raise ValueError("Versi PDF/A harus 1, 2, atau 3")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        command = [
            "gs",
            f"-dPDFA={version}",
            "-dBATCH",
            "-dNOPAUSE",
            "-dQUIET",
            "-dSAFER",
            "-dPDFACompatibilityPolicy=1",
            "-sColorConversionStrategy=UseDeviceIndependentColor",
            "-sDEVICE=pdfwrite",
            f"-sOutputFile={output_path}",
            input_path,
        ]

        success = await PDFService._execute_command(
            command, f"PDF/A-{version} Conversion"
        )
        return success and os.path.exists(output_path)

    # ------------------------------------------------------------------
    # Gambar
    # ------------------------------------------------------------------
    @staticmethod
    async def normalize_image(input_path: str, output_dir: str) -> str:
        """
        Pastikan gambar bisa dipakai img2pdf.

        HEIC/HEIF dan gambar ber-alpha ditolak img2pdf, jadi dinormalkan dulu
        ke JPEG. Mengembalikan path yang siap dikonversi.
        """
        ext = Path(input_path).suffix.lower()

        if ext in (".jpg", ".jpeg"):
            return input_path

        try:
            from PIL import Image
        except ImportError:
            logger.warning("Pillow tidak terpasang, gambar dipakai apa adanya")
            return input_path

        if ext in (".heic", ".heif"):
            try:
                import pillow_heif

                pillow_heif.register_heif_opener()
            except ImportError:
                logger.error("pillow-heif tidak terpasang")
                raise RuntimeError("Format HEIC belum didukung di server ini")

        os.makedirs(output_dir, exist_ok=True)
        target_path = os.path.join(
            output_dir, f"{Path(input_path).stem}_normalized.jpg"
        )

        def perform_conversion():
            with Image.open(input_path) as image:
                # img2pdf menolak alpha channel; komposit ke latar putih
                if image.mode in ("RGBA", "LA", "P"):
                    rgba = image.convert("RGBA")
                    background = Image.new("RGB", rgba.size, (255, 255, 255))
                    background.paste(rgba, mask=rgba.split()[-1])
                    background.save(target_path, "JPEG", quality=95)
                else:
                    image.convert("RGB").save(target_path, "JPEG", quality=95)

        try:
            await asyncio.to_thread(perform_conversion)
        except Exception as e:
            logger.error(f"Gagal menormalkan gambar {input_path}: {e}")
            return input_path

        return target_path if os.path.exists(target_path) else input_path

    # ------------------------------------------------------------------
    # Helper
    # ------------------------------------------------------------------
    @staticmethod
    def _save_pixmap(
        pixmap, image_path: str, extension: str, jpg_quality: int = 90
    ) -> None:
        """
        Tulis pixmap PyMuPDF ke berkas gambar.

        PyMuPDF hanya bisa menulis JPG dan PNG; WebP dan TIFF dibangun ulang
        lewat Pillow dari buffer piksel mentah agar tidak perlu berkas antara.
        """
        pillow_format = PILLOW_IMAGE_FORMATS.get(extension)

        if pillow_format is None:
            if extension == "jpg":
                pixmap.save(image_path, jpg_quality=jpg_quality)
            else:
                pixmap.save(image_path)
            return

        from PIL import Image

        mode = "RGBA" if pixmap.alpha else "RGB"
        image = Image.frombytes(mode, (pixmap.width, pixmap.height), pixmap.samples)

        if pillow_format == "WEBP":
            image.save(image_path, "WEBP", quality=jpg_quality, method=4)
        else:
            # LZW/deflate menjaga TIFF tetap lossless tanpa membengkak
            image.save(image_path, "TIFF", compression="tiff_deflate")

    @staticmethod
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

    @staticmethod
    async def _run_libreoffice(
        input_path: str,
        output_dir: str,
        command_tail: list[str],
        expected_suffix: str,
        task_name: str,
    ) -> Optional[str]:
        """Jalankan LibreOffice memakai profil dari pool, kembalikan path hasil."""
        async with libreoffice_pool.acquire() as profile_dir:
            command = [
                "libreoffice",
                f"-env:UserInstallation=file://{profile_dir}",
                "--headless",
                "--norestore",
                "--invisible",
                *command_tail,
            ]

            success = await PDFService._execute_command(command, task_name)

            if not success:
                await libreoffice_pool.reset(profile_dir)
                return None

        expected_path = os.path.join(
            output_dir, f"{Path(input_path).stem}{expected_suffix}"
        )
        if os.path.exists(expected_path):
            logger.info(f"{task_name} berhasil: {expected_path}")
            return expected_path

        logger.error(f"{task_name}: output tidak ditemukan di {expected_path}")
        return None

    # Cocokkan isi <body> beserta atributnya, lintas baris
    _BODY_PATTERN = re.compile(
        r"<body[^>]*>(.*)</body>", re.IGNORECASE | re.DOTALL
    )

    @staticmethod
    def _extract_html_body(html: str) -> str:
        """
        Ambil isi <body> dari dokumen HTML.

        Keluaran PyMuPDF adalah dokumen HTML utuh per halaman; tanpa langkah ini
        berkas gabungan akan berisi banyak <html> bersarang.
        """
        match = ConvertService._BODY_PATTERN.search(html)
        return match.group(1).strip() if match else html.strip()

    @staticmethod
    def _wrap_html(
        title: str, body: str, page_break_class: Optional[str] = None
    ) -> str:
        page_break_rule = (
            f".{page_break_class} {{ page-break-after: always; }}"
            if page_break_class
            else ""
        )
        return f"""<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>{title}</title>
<style>
  @page {{ size: A4; margin: 2cm; }}
  body {{ font-family: "Liberation Serif", Georgia, serif; font-size: 11pt; line-height: 1.6; }}
  h1, h2, h3, h4 {{ font-family: "Liberation Sans", Arial, sans-serif; line-height: 1.3; }}
  code, pre {{ font-family: "Liberation Mono", monospace; font-size: 9.5pt; }}
  pre {{ background: #f5f5f5; padding: 10px; border-radius: 4px; white-space: pre-wrap; }}
  table {{ border-collapse: collapse; width: 100%; }}
  th, td {{ border: 1px solid #ddd; padding: 6px; text-align: left; }}
  img {{ max-width: 100%; }}
  {page_break_rule}
</style>
</head>
<body>
{body}
</body>
</html>"""
