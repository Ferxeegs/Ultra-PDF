"""
Perkakas PDF yang bekerja langsung di atas dokumen, bukan mengubah formatnya.

Berbeda dengan ConvertService yang memindahkan isi PDF ke format lain, modul ini
menyunting PDF-nya sendiri: menambah lapisan teks hasil OCR, membubuhkan tanda
air dan nomor halaman, memangkas margin, membandingkan dua dokumen, serta
memperbaiki berkas yang rusak.
"""

import asyncio
import difflib
import html as html_module
import logging
import os
from typing import Callable, Optional

from app.services.convert_service import ConvertService, parse_page_ranges

logger = logging.getLogger(__name__)

PROCESS_TIMEOUT = int(os.getenv("PROCESS_TIMEOUT", "300"))

# Font baku PyMuPDF yang selalu tersedia tanpa perlu menyematkan berkas font
BASE_FONT = "helv"

MM_PER_POINT = 25.4 / 72.0

WATERMARK_POSITIONS = ("diagonal", "tengah", "atas", "bawah", "ubin")
PAGE_NUMBER_POSITIONS = (
    "bawah-tengah",
    "bawah-kanan",
    "bawah-kiri",
    "atas-tengah",
    "atas-kanan",
    "atas-kiri",
)


def mm_to_points(value: float) -> float:
    """Ubah milimeter ke satuan titik PDF (1 titik = 1/72 inci)."""
    return value / MM_PER_POINT


def _import_fitz():
    return ConvertService._import_fitz()


def _escape(text: str) -> str:
    """Amankan teks agar bisa ditaruh di dalam HTML laporan."""
    return html_module.escape(text)


def _encodable(text: str) -> str:
    """
    Buang karakter yang tidak bisa ditulis dengan font baku.

    Font base-14 PyMuPDF memakai Latin-1; karakter di luar itu akan tampil
    sebagai simbol acak, jadi lebih baik dihilangkan daripada merusak barisnya.
    """
    return text.encode("latin-1", "ignore").decode("latin-1")


class PDFToolsService:
    # ------------------------------------------------------------------
    # PDF hasil pindaian -> PDF yang bisa dicari
    # ------------------------------------------------------------------
    @staticmethod
    async def ocr_pdf(
        input_path: str,
        output_path: str,
        force: bool = False,
        progress: Optional[Callable] = None,
    ) -> bool:
        """
        Tambahkan lapisan teks tak terlihat di atas halaman hasil pindaian.

        Tampilan dokumen sama persis dengan aslinya, tapi isinya jadi bisa
        dicari, disalin, dan diproses tool lain (PDF ke Word, Teks, Excel).
        Halaman yang sudah punya teks dilewati kecuali ``force`` diaktifkan,
        supaya lapisan asli yang biasanya lebih akurat tidak tertimpa.
        """
        fitz = _import_fitz()
        reader = ConvertService._require_ocr_reader()

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        document = fitz.open(input_path)
        try:
            ConvertService._guard_ocr_page_count(document.page_count)
            timeout = ConvertService._ocr_timeout(document.page_count)
        finally:
            document.close()

        def perform():
            document = fitz.open(input_path)
            try:
                total_pages = document.page_count
                recognized = 0

                for page_index, page in enumerate(document, start=1):
                    already_has_text = len(page.get_text("text").strip()) >= 20
                    if already_has_text and not force:
                        ConvertService._report_progress(
                            progress, page_index, total_pages
                        )
                        continue

                    for item in ConvertService._ocr_page_items(page, reader):
                        text = _encodable(item["text"]).strip()
                        if not text:
                            continue

                        rect = fitz.Rect(*item["bbox"])
                        if rect.is_empty or rect.height <= 0:
                            continue

                        # Ukuran huruf disetel supaya lebar teks pas dengan kotak
                        # aslinya; tanpa itu posisi kata saat di-blok tidak
                        # berimpit dengan tulisan di gambar.
                        size = rect.height * 0.8
                        width = fitz.get_text_length(
                            text, fontname=BASE_FONT, fontsize=size
                        )
                        if width > 0:
                            size *= rect.width / width
                        size = max(1.0, min(size, 200.0))

                        page.insert_text(
                            (rect.x0, rect.y1 - rect.height * 0.18),
                            text,
                            fontname=BASE_FONT,
                            fontsize=size,
                            render_mode=3,  # 3 = tak terlihat
                        )
                        recognized += 1

                    ConvertService._report_progress(progress, page_index, total_pages)

                if recognized == 0:
                    # ValueError agar endpoint membalas 400: ini kondisi dokumen,
                    # bukan kegagalan server
                    raise ValueError(
                        "Tidak ada teks yang bisa dikenali dari PDF ini. Kalau "
                        "dokumennya sudah punya lapisan teks, fitur ini tidak "
                        "diperlukan."
                    )

                document.save(output_path, garbage=3, deflate=True)
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "OCR PDF", timeout)

    # ------------------------------------------------------------------
    # Tanda air
    # ------------------------------------------------------------------
    @staticmethod
    async def add_watermark(
        input_path: str,
        output_path: str,
        text: str,
        position: str = "diagonal",
        opacity: float = 0.15,
        font_size: int = 48,
        color: str = "#808080",
        pages: Optional[str] = None,
    ) -> bool:
        """Bubuhkan tanda air teks pada halaman terpilih."""
        text = (text or "").strip()
        if not text:
            raise ValueError("Teks tanda air tidak boleh kosong")
        if position not in WATERMARK_POSITIONS:
            raise ValueError(
                f"Posisi harus salah satu dari: {', '.join(WATERMARK_POSITIONS)}"
            )
        if not 0.01 <= opacity <= 1.0:
            raise ValueError("Opasitas harus antara 0,01 dan 1")
        if not 6 <= font_size <= 300:
            raise ValueError("Ukuran huruf harus antara 6 dan 300")

        fitz = _import_fitz()
        rgb = PDFToolsService._parse_color(color)
        stamp = _encodable(text)
        if not stamp:
            raise ValueError("Teks tanda air memakai karakter yang tidak didukung")

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform():
            document = fitz.open(input_path)
            try:
                selected = set(parse_page_ranges(pages, document.page_count))

                for page_index, page in enumerate(document):
                    if page_index not in selected:
                        continue
                    PDFToolsService._stamp_page(
                        fitz, page, stamp, position, opacity, font_size, rgb
                    )

                document.save(output_path, garbage=3, deflate=True)
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "Tanda air")

    @staticmethod
    def _stamp_page(fitz, page, text, position, opacity, font_size, rgb) -> None:
        """Tulis satu tanda air pada halaman sesuai posisi yang diminta."""
        rect = page.rect
        font = fitz.Font(BASE_FONT)
        width = font.text_length(text, font_size)

        def write(point, angle: float) -> None:
            writer = fitz.TextWriter(rect, opacity=opacity, color=rgb)
            writer.append(point, text, font=font, fontsize=font_size)
            if angle:
                writer.write_text(
                    page, morph=(fitz.Point(point.x, point.y), fitz.Matrix(angle))
                )
            else:
                writer.write_text(page)

        if position == "ubin":
            # Jarak antar ubin dibuat lebih longgar dari lebar teks supaya
            # tanda air tidak menutupi isi dokumen
            step_x = width + font_size * 3
            step_y = font_size * 4
            y = rect.y0 + step_y
            while y < rect.y1:
                x = rect.x0 + font_size
                while x < rect.x1:
                    write(fitz.Point(x, y), 30)
                    x += step_x
                y += step_y
            return

        center_x = (rect.x0 + rect.x1) / 2
        if position == "diagonal":
            point = fitz.Point(center_x - width / 2, (rect.y0 + rect.y1) / 2)
            write(point, 45)
        elif position == "tengah":
            write(fitz.Point(center_x - width / 2, (rect.y0 + rect.y1) / 2), 0)
        elif position == "atas":
            write(fitz.Point(center_x - width / 2, rect.y0 + font_size * 1.5), 0)
        else:  # bawah
            write(fitz.Point(center_x - width / 2, rect.y1 - font_size), 0)

    # ------------------------------------------------------------------
    # Nomor halaman
    # ------------------------------------------------------------------
    @staticmethod
    async def add_page_numbers(
        input_path: str,
        output_path: str,
        position: str = "bawah-tengah",
        start_number: int = 1,
        template: str = "{n}",
        font_size: int = 11,
        margin_mm: float = 12.0,
        skip_first: bool = False,
        color: str = "#000000",
    ) -> bool:
        """
        Bubuhkan nomor halaman.

        ``template`` boleh memuat ``{n}`` (nomor halaman) dan ``{total}``
        (jumlah halaman yang dinomori), mis. ``"Halaman {n} dari {total}"``.
        """
        if position not in PAGE_NUMBER_POSITIONS:
            raise ValueError(
                f"Posisi harus salah satu dari: {', '.join(PAGE_NUMBER_POSITIONS)}"
            )
        if not 5 <= font_size <= 72:
            raise ValueError("Ukuran huruf harus antara 5 dan 72")
        if not 0 <= margin_mm <= 100:
            raise ValueError("Margin harus antara 0 dan 100 mm")

        # Template divalidasi lebih dulu supaya salah ketik ditolak sebagai
        # permintaan tak sah, bukan meledak di tengah penulisan halaman
        try:
            template.format(n=1, total=1)
        except (KeyError, IndexError, ValueError):
            raise ValueError(
                "Format nomor hanya boleh memakai {n} dan {total}, "
                'mis. "Halaman {n} dari {total}"'
            )

        fitz = _import_fitz()
        rgb = PDFToolsService._parse_color(color)
        margin = mm_to_points(margin_mm)

        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform():
            document = fitz.open(input_path)
            try:
                first = 1 if skip_first else 0
                numbered = max(0, document.page_count - first)
                font = fitz.Font(BASE_FONT)

                for offset, page_index in enumerate(range(first, document.page_count)):
                    page = document.load_page(page_index)
                    label = _encodable(
                        template.format(n=start_number + offset, total=numbered)
                    )
                    if not label:
                        continue

                    rect = page.rect
                    width = font.text_length(label, font_size)

                    if position.endswith("kiri"):
                        x = rect.x0 + margin
                    elif position.endswith("kanan"):
                        x = rect.x1 - margin - width
                    else:
                        x = (rect.x0 + rect.x1) / 2 - width / 2

                    if position.startswith("atas"):
                        y = rect.y0 + margin + font_size
                    else:
                        y = rect.y1 - margin

                    writer = fitz.TextWriter(rect, color=rgb)
                    writer.append(fitz.Point(x, y), label, font=font, fontsize=font_size)
                    writer.write_text(page)

                document.save(output_path, garbage=3, deflate=True)
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "Nomor halaman")

    # ------------------------------------------------------------------
    # Pangkas halaman
    # ------------------------------------------------------------------
    @staticmethod
    async def crop_pdf(
        input_path: str,
        output_path: str,
        mode: str = "auto",
        top_mm: float = 0.0,
        bottom_mm: float = 0.0,
        left_mm: float = 0.0,
        right_mm: float = 0.0,
        padding_mm: float = 5.0,
        pages: Optional[str] = None,
    ) -> bool:
        """
        Pangkas halaman, baik menurut margin tetap maupun otomatis.

        Mode ``auto`` menyusutkan halaman sampai pas ke isinya (teks, gambar, dan
        gambar vektor) lalu menyisakan ``padding_mm`` sebagai napas. Mode
        ``manual`` memotong sebanyak milimeter yang diminta dari tiap sisi.
        """
        if mode not in ("auto", "manual"):
            raise ValueError("Mode pangkas harus 'auto' atau 'manual'")

        margins = (top_mm, bottom_mm, left_mm, right_mm)
        if mode == "manual" and not any(value > 0 for value in margins):
            raise ValueError("Isi minimal satu margin yang lebih besar dari nol")
        if any(value < 0 for value in margins) or padding_mm < 0:
            raise ValueError("Margin tidak boleh negatif")

        fitz = _import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform():
            document = fitz.open(input_path)
            try:
                selected = set(parse_page_ranges(pages, document.page_count))
                cropped = 0

                for page_index, page in enumerate(document):
                    if page_index not in selected:
                        continue

                    source = page.rect
                    if mode == "manual":
                        box = fitz.Rect(
                            source.x0 + mm_to_points(left_mm),
                            source.y0 + mm_to_points(top_mm),
                            source.x1 - mm_to_points(right_mm),
                            source.y1 - mm_to_points(bottom_mm),
                        )
                    else:
                        content = PDFToolsService._content_bbox(fitz, page)
                        if content is None:
                            continue
                        padding = mm_to_points(padding_mm)
                        box = fitz.Rect(
                            content.x0 - padding,
                            content.y0 - padding,
                            content.x1 + padding,
                            content.y1 + padding,
                        ) & source

                    # CropBox yang lebih besar dari MediaBox ditolak PyMuPDF,
                    # dan yang terlalu kecil menghasilkan halaman tak terbaca
                    box = box & source
                    if box.is_empty or box.width < 10 or box.height < 10:
                        logger.warning(
                            f"Hasil pangkas halaman {page_index + 1} terlalu kecil, dilewati"
                        )
                        continue

                    page.set_cropbox(box)
                    cropped += 1

                if cropped == 0:
                    raise ValueError(
                        "Tidak ada halaman yang bisa dipangkas. Pada mode otomatis "
                        "ini berarti halamannya sudah pas dengan isinya."
                    )

                document.save(output_path, garbage=3, deflate=True)
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "Pangkas PDF")

    @staticmethod
    def _content_bbox(fitz, page):
        """Kotak terkecil yang memuat seluruh isi halaman, atau None bila kosong."""
        box = None

        def merge(rect):
            nonlocal box
            rect = fitz.Rect(rect)
            if rect.is_empty or rect.is_infinite:
                return
            box = rect if box is None else box | rect

        for block in page.get_text("dict").get("blocks", []):
            merge(block.get("bbox", (0, 0, 0, 0)))

        for drawing in page.get_drawings():
            merge(drawing.get("rect"))

        for image in page.get_image_info():
            merge(image.get("bbox", (0, 0, 0, 0)))

        return box

    # ------------------------------------------------------------------
    # Bandingkan dua PDF
    # ------------------------------------------------------------------
    @staticmethod
    async def compare_pdf(
        original_path: str,
        revised_path: str,
        output_path: str,
        original_name: str = "Dokumen A",
        revised_name: str = "Dokumen B",
    ) -> bool:
        """
        Bandingkan isi teks dua PDF lalu tulis laporannya sebagai PDF.

        Perbandingan dilakukan per halaman dan per baris memakai difflib, jadi
        yang dilaporkan adalah baris yang ditambah atau dihapus - bukan sekadar
        "berbeda". Laporannya digambar langsung dengan PyMuPDF supaya fitur ini
        tidak ikut bergantung pada Pango/Cairo seperti jalur HTML ke PDF.
        """
        fitz = _import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def read_pages(path: str) -> list[list[str]]:
            document = fitz.open(path)
            try:
                return [
                    [
                        line.strip()
                        for line in page.get_text("text").splitlines()
                        if line.strip()
                    ]
                    for page in document
                ]
            finally:
                document.close()

        def perform():
            left = read_pages(original_path)
            right = read_pages(revised_path)

            added = removed = changed_pages = 0
            sections: list[tuple[str, list[tuple[str, str]]]] = []

            for index in range(max(len(left), len(right))):
                lines_a = left[index] if index < len(left) else []
                lines_b = right[index] if index < len(right) else []
                if lines_a == lines_b:
                    continue

                changed_pages += 1
                rows: list[tuple[str, str]] = []
                for line in difflib.unified_diff(lines_a, lines_b, lineterm="", n=1):
                    if line.startswith("+++") or line.startswith("---"):
                        continue
                    if line.startswith("+"):
                        added += 1
                        rows.append(("tambah", line))
                    elif line.startswith("-"):
                        removed += 1
                        rows.append(("hapus", line))
                    else:
                        rows.append(("konteks", line))

                title = f"Halaman {index + 1}"
                if index >= len(left):
                    title += "  (hanya ada di dokumen B)"
                elif index >= len(right):
                    title += "  (hanya ada di dokumen A)"
                sections.append((title, rows))

            summary = [
                f"A: {original_name}  -  {len(left)} halaman",
                f"B: {revised_name}  -  {len(right)} halaman",
                f"{changed_pages} halaman berbeda, {added} baris ditambah, "
                f"{removed} baris dihapus.",
            ]

            PDFToolsService._draw_compare_report(
                fitz, output_path, summary, sections
            )
            logger.info(
                f"Perbandingan PDF: {changed_pages} halaman berbeda, "
                f"+{added} / -{removed} baris"
            )

        return await PDFToolsService._run(perform, output_path, "Bandingkan PDF")

    # Tata letak laporan perbandingan, dalam satuan titik PDF
    _REPORT_MARGIN = 54.0
    _REPORT_BODY_SIZE = 8.5
    _REPORT_LINE_HEIGHT = 11.0

    @staticmethod
    def _draw_compare_report(fitz, output_path, summary, sections) -> None:
        """Gambar laporan perbandingan sebagai PDF A4 multi-halaman."""
        import textwrap

        margin = PDFToolsService._REPORT_MARGIN
        body_size = PDFToolsService._REPORT_BODY_SIZE
        line_height = PDFToolsService._REPORT_LINE_HEIGHT

        mono = fitz.Font("cour")
        sans = fitz.Font("hebo")

        document = fitz.open()
        page = document.new_page()
        content_width = page.rect.width - margin * 2
        bottom = page.rect.height - margin
        cursor = margin

        # Courier lebarnya tetap 0,6 em, jadi jumlah karakter per baris bisa
        # dihitung langsung tanpa mengukur tiap potongan teks
        per_line = max(20, int(content_width / (body_size * 0.6)) - 2)

        def new_page():
            nonlocal page, cursor
            page = document.new_page()
            cursor = margin

        def ensure(space: float):
            if cursor + space > bottom:
                new_page()

        def write(text, font, size, color=(0, 0, 0), indent=0.0):
            nonlocal cursor
            writer = fitz.TextWriter(page.rect, color=color)
            writer.append(
                fitz.Point(margin + indent, cursor + size), text, font=font, fontsize=size
            )
            writer.write_text(page)
            cursor += size * 1.45

        write("Perbandingan PDF", sans, 16)
        cursor += 4
        for line in summary:
            write(line, mono, 9, color=(0.3, 0.3, 0.3))
        cursor += 10

        if not sections:
            write("Isi teks kedua dokumen sama persis.", sans, 11, color=(0.1, 0.45, 0.2))

        for title, rows in sections:
            ensure(line_height * 4)
            cursor += 6
            write(title, sans, 11)
            page.draw_line(
                fitz.Point(margin, cursor),
                fitz.Point(margin + content_width, cursor),
                color=(0.85, 0.85, 0.85),
                width=0.6,
            )
            cursor += 5

            for kind, raw in rows:
                if kind == "tambah":
                    background, accent, ink = (0.90, 1.0, 0.92), (0.18, 0.63, 0.26), (0, 0, 0)
                elif kind == "hapus":
                    background, accent, ink = (1.0, 0.92, 0.91), (0.82, 0.14, 0.18), (0, 0, 0)
                else:
                    background, accent, ink = None, None, (0.42, 0.42, 0.42)

                for part in textwrap.wrap(raw, per_line) or [""]:
                    ensure(line_height)
                    if background:
                        page.draw_rect(
                            fitz.Rect(
                                margin, cursor, margin + content_width, cursor + line_height
                            ),
                            color=None,
                            fill=background,
                        )
                        page.draw_rect(
                            fitz.Rect(margin, cursor, margin + 2.2, cursor + line_height),
                            color=None,
                            fill=accent,
                        )
                    writer = fitz.TextWriter(page.rect, color=ink)
                    writer.append(
                        fitz.Point(margin + 6, cursor + line_height - 3),
                        part,
                        font=mono,
                        fontsize=body_size,
                    )
                    writer.write_text(page)
                    cursor += line_height

        document.save(output_path, garbage=3, deflate=True)
        document.close()

    # ------------------------------------------------------------------
    # ------------------------------------------------------------------
    # Perbaiki PDF rusak
    # ------------------------------------------------------------------
    @staticmethod
    async def repair_pdf(input_path: str, output_path: str) -> dict:
        """
        Buka ulang PDF yang rusak lalu tulis versi yang bersih.

        PyMuPDF sanggup memulihkan berkas dengan xref rusak atau trailer hilang.
        Sekalian objek yatim dibuang dan alirannya dipadatkan, jadi hasilnya
        biasanya juga lebih kecil. Mengembalikan ringkasan untuk ditampilkan ke
        pengguna, bukan sekadar True/False.
        """
        fitz = _import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform() -> dict:
            try:
                document = fitz.open(input_path)
            except Exception as e:
                raise ValueError(
                    f"Berkas ini rusak terlalu parah untuk dipulihkan: {e}"
                ) from e

            try:
                if document.page_count == 0:
                    raise ValueError(
                        "PDF tidak punya satu halaman pun yang bisa dipulihkan"
                    )

                # is_repaired menandakan PyMuPDF harus membangun ulang struktur
                # berkas saat membukanya - artinya aslinya memang rusak
                was_damaged = bool(getattr(document, "is_repaired", False))
                page_count = document.page_count
                document.save(
                    output_path, garbage=4, clean=True, deflate=True, incremental=False
                )
            finally:
                document.close()

            before = os.path.getsize(input_path)
            after = os.path.getsize(output_path)
            return {
                "rusak": was_damaged,
                "halaman": page_count,
                "ukuran_sebelum": before,
                "ukuran_sesudah": after,
            }

        try:
            return await asyncio.wait_for(
                asyncio.to_thread(perform), timeout=PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("Perbaikan PDF timeout")
            raise RuntimeError("Perbaikan PDF melebihi batas waktu")

    # ------------------------------------------------------------------
    # Putar halaman
    # ------------------------------------------------------------------
    @staticmethod
    async def rotate_pdf(
        input_path: str,
        output_path: str,
        angle: int = 90,
        pages: Optional[str] = None,
    ) -> bool:
        """
        Putar halaman terpilih searah jarum jam.

        Yang diubah hanya atribut /Rotate milik halaman, jadi isinya tidak
        digambar ulang dan tidak ada mutu yang hilang. Sudutnya ditambahkan ke
        rotasi yang sudah ada supaya halaman yang memang sudah miring tidak
        ikut dipaksa kembali ke nol.
        """
        if angle % 90 != 0:
            raise ValueError("Sudut putar harus kelipatan 90 derajat")
        angle = angle % 360
        if angle == 0:
            raise ValueError("Sudut putar harus 90, 180, atau 270 derajat")

        fitz = _import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform():
            document = fitz.open(input_path)
            try:
                selected = sorted(set(parse_page_ranges(pages, document.page_count)))
                if not selected:
                    raise ValueError("Tidak ada halaman yang cocok dengan pilihan Anda")

                for page_index in selected:
                    page = document.load_page(page_index)
                    page.set_rotation((page.rotation + angle) % 360)

                document.save(output_path, garbage=3, deflate=True)
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "Putar PDF")

    # ------------------------------------------------------------------
    # Hapus halaman
    # ------------------------------------------------------------------
    @staticmethod
    async def remove_pages(
        input_path: str,
        output_path: str,
        pages: str,
    ) -> bool:
        """Buang halaman yang disebut dan simpan sisanya sebagai PDF baru."""
        if not (pages or "").strip():
            raise ValueError("Sebutkan halaman yang mau dihapus, mis. 1-3,7")

        fitz = _import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform():
            document = fitz.open(input_path)
            try:
                doomed = sorted(set(parse_page_ranges(pages, document.page_count)))
                if not doomed:
                    raise ValueError("Tidak ada halaman yang cocok dengan pilihan Anda")
                if len(doomed) >= document.page_count:
                    raise ValueError(
                        "Semua halaman terpilih - PDF harus menyisakan minimal "
                        "satu halaman"
                    )

                document.delete_pages(doomed)
                document.save(output_path, garbage=3, deflate=True)
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "Hapus halaman")

    # ------------------------------------------------------------------
    # Ambil halaman
    # ------------------------------------------------------------------
    @staticmethod
    async def extract_pages(
        input_path: str,
        output_path: str,
        pages: str,
    ) -> bool:
        """
        Ambil halaman tertentu menjadi PDF baru.

        Kebalikan dari hapus halaman: yang disebut justru yang disimpan, dengan
        urutan mengikuti hasil pembacaan rentang.
        """
        if not (pages or "").strip():
            raise ValueError("Sebutkan halaman yang mau diambil, mis. 1-3,7")

        fitz = _import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform():
            document = fitz.open(input_path)
            try:
                keep = parse_page_ranges(pages, document.page_count)
                if not keep:
                    raise ValueError("Tidak ada halaman yang cocok dengan pilihan Anda")

                document.select(keep)
                document.save(output_path, garbage=3, deflate=True)
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "Ambil halaman")

    # ------------------------------------------------------------------
    # Sensor teks
    # ------------------------------------------------------------------
    @staticmethod
    async def redact_pdf(
        input_path: str,
        output_path: str,
        terms: str,
        pages: Optional[str] = None,
        case_sensitive: bool = False,
        color: str = "#000000",
    ) -> bool:
        """
        Sensor kata atau frasa secara permanen.

        Berbeda dengan menimpa kotak hitam di atas tulisan, di sini teks aslinya
        benar-benar dibuang dari isi halaman lewat ``apply_redactions`` - jadi
        tidak bisa ditemukan lagi dengan pencarian atau salin-tempel.
        """
        needles = [line.strip() for line in (terms or "").splitlines() if line.strip()]
        if not needles:
            raise ValueError("Isi minimal satu kata atau frasa yang mau disensor")

        fitz = _import_fitz()
        rgb = PDFToolsService._parse_color(color)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform():
            document = fitz.open(input_path)
            try:
                selected = set(parse_page_ranges(pages, document.page_count))
                marked = 0

                for page_index, page in enumerate(document):
                    if page_index not in selected:
                        continue

                    page_marks = 0
                    for needle in needles:
                        for rect in page.search_for(needle):
                            # search_for tidak membedakan huruf besar-kecil, jadi
                            # saat mode sensitif diminta hasilnya disaring ulang
                            # dengan membaca teks di dalam kotak temuan.
                            if case_sensitive:
                                found = (page.get_textbox(rect) or "").strip()
                                if found != needle:
                                    continue

                            page.add_redact_annot(rect, fill=rgb)
                            page_marks += 1

                    if page_marks:
                        page.apply_redactions()
                        marked += page_marks

                if marked == 0:
                    raise ValueError(
                        "Tidak ada teks yang cocok. Untuk PDF hasil pindaian, "
                        "jalankan OCR PDF lebih dulu agar teksnya bisa dicari."
                    )

                document.save(output_path, garbage=3, deflate=True)
                logger.info(f"Sensor PDF: {marked} temuan dihapus permanen")
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "Sensor PDF")

    # ------------------------------------------------------------------
    # Sunting halaman: teks dan bentuk di atas PDF yang sudah ada
    # ------------------------------------------------------------------
    EDIT_KINDS = ("teks", "kotak", "elips", "garis", "sorot", "hapus")

    @staticmethod
    async def edit_pdf(
        input_path: str,
        output_path: str,
        items: list,
    ) -> bool:
        """
        Bubuhkan teks dan bentuk pada halaman menurut daftar ``items``.

        Koordinat tiap item ditulis sebagai pecahan 0..1 terhadap lebar dan
        tinggi halaman, dengan titik nol di kiri-atas - sama seperti viewport
        pdf.js yang dipakai editor di sisi browser. Dengan begitu penempatan
        tetap benar meski halaman punya /Rotate atau CropBox sendiri, karena
        ``page.rect`` PyMuPDF sudah memperhitungkan keduanya.
        """
        if not items:
            raise ValueError("Belum ada yang ditambahkan ke halaman")

        fitz = _import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform():
            document = fitz.open(input_path)
            try:
                applied = 0
                for item in items:
                    kind = str(item.get("jenis") or "teks").lower()
                    if kind not in PDFToolsService.EDIT_KINDS:
                        raise ValueError(f"Jenis suntingan tidak dikenal: {kind}")

                    number = int(item.get("halaman") or 1)
                    if not 1 <= number <= document.page_count:
                        raise ValueError(f"Halaman {number} tidak ada di dokumen ini")

                    page = document.load_page(number - 1)
                    PDFToolsService._apply_edit(fitz, page, kind, item)
                    applied += 1

                if applied == 0:
                    raise ValueError("Belum ada yang ditambahkan ke halaman")

                document.save(output_path, garbage=3, deflate=True)
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "Sunting PDF")

    @staticmethod
    def _apply_edit(fitz, page, kind: str, item: dict) -> None:
        """Gambar satu item suntingan pada halaman."""
        bounds = page.rect
        width = bounds.width
        height = bounds.height

        def fraction(key: str, default: float = 0.0) -> float:
            try:
                return float(item.get(key, default))
            except (TypeError, ValueError):
                raise ValueError(f"Nilai {key} harus berupa angka")

        x0 = bounds.x0 + fraction("x") * width
        y0 = bounds.y0 + fraction("y") * height
        box_width = max(fraction("lebar", 0.2), 0.0) * width
        box_height = max(fraction("tinggi", 0.05), 0.0) * height
        rect = fitz.Rect(x0, y0, x0 + box_width, y0 + box_height) & bounds

        color = PDFToolsService._parse_color(str(item.get("warna") or "#000000"))
        opacity = min(max(float(item.get("opasitas", 1.0) or 1.0), 0.05), 1.0)

        if kind == "teks":
            text = _encodable(str(item.get("teks") or "").strip())
            if not text:
                raise ValueError("Kotak teks tidak boleh kosong")

            size = float(item.get("ukuran_huruf", 12) or 12)
            if not 4 <= size <= 200:
                raise ValueError("Ukuran huruf harus antara 4 dan 200")

            # insert_textbox membalas nilai negatif kalau teksnya tidak muat;
            # ukurannya dikecilkan bertahap supaya isi tetap terbaca penuh
            # alih-alih terpotong diam-diam di tengah kalimat.
            while size >= 4:
                leftover = page.insert_textbox(
                    rect,
                    text,
                    fontname=BASE_FONT,
                    fontsize=size,
                    color=color,
                    fill_opacity=opacity,
                    align=0,
                )
                if leftover >= 0:
                    return
                size -= 1

            raise ValueError(
                "Teks terlalu panjang untuk kotaknya - perbesar kotak atau "
                "kurangi tulisannya"
            )

        if rect.is_empty and kind != "garis":
            raise ValueError("Ukuran bentuk terlalu kecil untuk digambar")

        if kind == "sorot":
            annot = page.add_highlight_annot(rect)
            annot.set_colors(stroke=color)
            annot.set_opacity(opacity)
            annot.update()
        elif kind == "hapus":
            # Menutup dengan putih, bukan menghapus isi. Untuk membuang teks
            # sungguhan pakai Sensor PDF yang memanggil apply_redactions.
            page.draw_rect(rect, color=None, fill=(1, 1, 1), fill_opacity=1.0)
        elif kind == "kotak":
            page.draw_rect(
                rect,
                color=color,
                fill=None,
                width=float(item.get("tebal", 1.5) or 1.5),
                stroke_opacity=opacity,
            )
        elif kind == "elips":
            page.draw_oval(
                rect,
                color=color,
                fill=None,
                width=float(item.get("tebal", 1.5) or 1.5),
                stroke_opacity=opacity,
            )
        else:  # garis
            page.draw_line(
                fitz.Point(rect.x0, rect.y0),
                fitz.Point(rect.x1, rect.y1),
                color=color,
                width=float(item.get("tebal", 1.5) or 1.5),
                stroke_opacity=opacity,
            )

    # ------------------------------------------------------------------
    # Formulir PDF
    # ------------------------------------------------------------------
    @staticmethod
    async def form_fields(input_path: str) -> list[dict]:
        """
        Daftar isian formulir beserta nilai yang sedang terpasang.

        Dipakai frontend untuk membangun formulirnya sendiri, jadi pengguna
        tidak perlu pembaca PDF yang mendukung AcroForm.
        """
        fitz = _import_fitz()

        def perform() -> list[dict]:
            document = fitz.open(input_path)
            try:
                fields: list[dict] = []
                seen: set[str] = set()

                for number, page in enumerate(document, start=1):
                    for widget in page.widgets():
                        name = widget.field_name or ""
                        if not name or name in seen:
                            # Satu isian bisa punya widget di banyak halaman;
                            # nilainya sama, jadi cukup dilaporkan sekali.
                            continue
                        seen.add(name)

                        flags = widget.field_flags or 0
                        value = widget.field_value
                        if not isinstance(value, (str, bool, int, float, type(None))):
                            value = str(value)

                        fields.append(
                            {
                                "nama": name,
                                "jenis": widget.field_type_string or "teks",
                                "nilai": value,
                                "pilihan": list(widget.choice_values or []),
                                "wajib": bool(flags & 2),
                                "hanya_baca": bool(flags & 1),
                                "halaman": number,
                            }
                        )

                return fields
            finally:
                document.close()

        try:
            return await asyncio.wait_for(
                asyncio.to_thread(perform), timeout=PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error("Pembacaan formulir PDF timeout")
            raise RuntimeError("Pembacaan formulir melebihi batas waktu")

    # Nilai yang dianggap "tercentang" pada isian kotak centang
    _TRUTHY = {"1", "true", "ya", "on", "yes", "y", "checked"}

    @staticmethod
    async def fill_form(
        input_path: str,
        output_path: str,
        values: dict,
        flatten: bool = False,
    ) -> bool:
        """
        Isi formulir PDF dari pasangan nama-nilai.

        ``flatten`` mencetak isian menjadi bagian tetap halaman sehingga tidak
        bisa diubah lagi - berguna untuk formulir yang sudah final.
        """
        if not values:
            raise ValueError("Belum ada isian yang diisi")

        fitz = _import_fitz()
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)

        def perform():
            document = fitz.open(input_path)
            try:
                filled = 0
                for page in document:
                    for widget in page.widgets():
                        name = widget.field_name or ""
                        if name not in values:
                            continue
                        if (widget.field_flags or 0) & 1:
                            # Isian hanya-baca dilewati, bukan digagalkan:
                            # formulir sering memuat kolom terhitung otomatis.
                            continue

                        raw = values[name]
                        if widget.field_type == fitz.PDF_WIDGET_TYPE_CHECKBOX:
                            widget.field_value = (
                                str(raw).strip().lower() in PDFToolsService._TRUTHY
                            )
                        else:
                            widget.field_value = _encodable(str(raw))

                        widget.update()
                        filled += 1

                if filled == 0:
                    raise ValueError(
                        "Tidak ada isian yang cocok dengan formulir di berkas ini"
                    )

                if flatten:
                    bake = getattr(document, "bake", None)
                    if bake is not None:
                        bake()
                    else:
                        logger.warning(
                            "PyMuPDF versi ini belum punya bake(); "
                            "formulir disimpan tanpa dikunci"
                        )

                document.save(output_path, garbage=3, deflate=True)
                logger.info(f"Formulir PDF: {filled} isian terisi")
            finally:
                document.close()

        return await PDFToolsService._run(perform, output_path, "Isi formulir")

    # ------------------------------------------------------------------
    # Pembantu
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_color(value: str) -> tuple:
        """Ubah warna heksadesimal (#RRGGBB) menjadi tuple RGB 0..1."""
        raw = (value or "").strip().lstrip("#")
        if len(raw) == 3:
            raw = "".join(char * 2 for char in raw)
        if len(raw) != 6:
            raise ValueError("Warna harus dalam format heksadesimal, mis. #808080")
        try:
            channels = tuple(int(raw[i : i + 2], 16) / 255.0 for i in (0, 2, 4))
        except ValueError:
            raise ValueError("Warna harus dalam format heksadesimal, mis. #808080")
        return channels

    @staticmethod
    async def _run(
        perform: Callable,
        output_path: str,
        task_name: str,
        timeout: Optional[float] = None,
    ) -> bool:
        """Jalankan pekerjaan di thread terpisah dengan penanganan error seragam."""
        try:
            await asyncio.wait_for(
                asyncio.to_thread(perform), timeout=timeout or PROCESS_TIMEOUT
            )
        except asyncio.TimeoutError:
            logger.error(f"{task_name} timeout")
            return False
        except (ValueError, RuntimeError):
            raise
        except Exception as e:
            logger.error(f"Error saat {task_name}: {e}", exc_info=True)
            return False

        return os.path.exists(output_path)
