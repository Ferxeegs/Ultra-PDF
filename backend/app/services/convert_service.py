"""
Layanan konversi dokumen untuk UltraPDF.

Semua konversi berbasis LibreOffice memakai pool profil yang dipakai ulang
(lihat LibreOfficeProfilePool) supaya konversi kedua dan seterusnya tidak
membayar ongkos pembuatan profil baru seperti pada PDFService.
"""

import asyncio
import logging
import os
import shutil
import tempfile
import uuid
import zipfile
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

from app.services.pdf_service import PDFService

logger = logging.getLogger(__name__)

PROCESS_TIMEOUT = int(os.getenv("PROCESS_TIMEOUT", "300"))
LIBREOFFICE_POOL_SIZE = int(os.getenv("LIBREOFFICE_POOL_SIZE", "2"))
LIBREOFFICE_PROFILE_ROOT = os.getenv(
    "LIBREOFFICE_PROFILE_ROOT",
    os.path.join(tempfile.gettempdir(), "ultrapdf_lo_profiles"),
)

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
    async def pdf_to_docx(input_path: str, output_path: str) -> bool:
        """Konversi PDF ke DOCX memakai pdf2docx (layout jauh lebih terjaga dari LibreOffice)."""
        try:
            from pdf2docx import Converter
        except ImportError:
            logger.error("pdf2docx tidak terpasang")
            raise RuntimeError("Fitur PDF ke Word belum tersedia di server ini")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform_conversion():
            converter = Converter(input_path)
            try:
                converter.convert(output_path, start=0, end=None)
            finally:
                converter.close()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("PDF ke DOCX timeout")
            return False
        except Exception as e:
            logger.error(f"Error saat konversi PDF ke DOCX: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)

    @staticmethod
    async def pdf_to_xlsx(input_path: str, output_path: str) -> bool:
        """
        Ekstrak tabel dari PDF ke XLSX (satu sheet per tabel).
        LibreOffice tidak mendukung arah ini, jadi dipakai deteksi tabel PyMuPDF.
        """
        fitz = ConvertService._import_fitz()
        try:
            from openpyxl import Workbook
        except ImportError:
            logger.error("openpyxl tidak terpasang")
            raise RuntimeError("Fitur PDF ke Excel belum tersedia di server ini")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform_conversion():
            document = fitz.open(input_path)
            workbook = Workbook()
            workbook.remove(workbook.active)
            table_count = 0

            try:
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

                # Tidak ada tabel terdeteksi: jatuhkan ke teks per baris agar hasil tetap berguna
                if table_count == 0:
                    sheet = workbook.create_sheet("Teks")
                    for page_index, page in enumerate(document, start=1):
                        for line in page.get_text("text").splitlines():
                            sheet.append([f"Hal {page_index}", line])

                workbook.save(output_path)
            finally:
                document.close()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("PDF ke XLSX timeout")
            return False
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

        image_format = image_format.lower()
        if image_format in ("jpg", "jpeg"):
            extension = "jpg"
        elif image_format == "png":
            extension = "png"
        else:
            raise ValueError("Format gambar harus png atau jpg")

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
                    if extension == "jpg":
                        pixmap.save(image_path, jpg_quality=90)
                    else:
                        pixmap.save(image_path)
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

        extension = "jpg" if image_format.lower() in ("jpg", "jpeg") else "png"

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
                            if extension == "jpg":
                                pixmap.save(image_path, jpg_quality=95)
                            else:
                                pixmap.save(image_path)
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
    ) -> bool:
        """Ekstrak isi PDF menjadi .txt atau .md."""
        fitz = ConvertService._import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform_conversion():
            if text_format == "md":
                # pymupdf4llm menghasilkan Markdown yang jauh lebih rapi bila tersedia
                try:
                    import pymupdf4llm

                    content = pymupdf4llm.to_markdown(input_path)
                    Path(output_path).write_text(content, encoding="utf-8")
                    return
                except ImportError:
                    logger.info(
                        "pymupdf4llm tidak tersedia, memakai ekstraksi Markdown sederhana"
                    )

            document = fitz.open(input_path)
            try:
                selected = parse_page_ranges(pages, document.page_count)
                blocks: list[str] = []

                for page_index in selected:
                    page = document.load_page(page_index)
                    text = page.get_text("text").strip()
                    if text_format == "md":
                        blocks.append(f"## Halaman {page_index + 1}\n\n{text}")
                    else:
                        blocks.append(text)

                separator = "\n\n---\n\n" if text_format == "md" else "\n\n\f\n\n"
                Path(output_path).write_text(separator.join(blocks), encoding="utf-8")
            finally:
                document.close()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("Ekstraksi teks PDF timeout")
            return False
        except Exception as e:
            logger.error(f"Error saat ekstraksi teks PDF: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)

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
        input_path: str, output_path: str, title: Optional[str] = None
    ) -> bool:
        """
        Bangun EPUB dari teks PDF (satu bab per halaman).
        Layout kompleks tidak dipertahankan - EPUB memang format teks mengalir.
        """
        fitz = ConvertService._import_fitz()
        try:
            from ebooklib import epub
        except ImportError:
            logger.error("ebooklib tidak terpasang")
            raise RuntimeError("Fitur PDF ke EPUB belum tersedia di server ini")

        import html as html_module

        def perform_conversion():
            document = fitz.open(input_path)
            try:
                book = epub.EpubBook()
                book.set_identifier(uuid.uuid4().hex)
                book.set_title(title or Path(input_path).stem)
                book.set_language("id")

                chapters = []
                for page_index, page in enumerate(document, start=1):
                    text = page.get_text("text").strip()
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

                book.toc = tuple(chapters)
                book.add_item(epub.EpubNcx())
                book.add_item(epub.EpubNav())
                book.spine = ["nav", *chapters]

                epub.write_epub(output_path, book)
            finally:
                document.close()

        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform_conversion), timeout=PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("PDF ke EPUB timeout")
            return False
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
