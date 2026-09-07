import os
import logging
import asyncio
import shutil
from pathlib import Path
import img2pdf

logger = logging.getLogger(__name__)

PROCESS_TIMEOUT = int(os.getenv("PROCESS_TIMEOUT", "300"))


class PDFService:
    # Preset Ghostscript beserta resolusi gambarnya. Resolusi ditulis eksplisit
    # karena flag -dXxxImageResolution yang datang sesudah -dPDFSETTINGS akan
    # menimpa nilai bawaan preset; kalau disamakan untuk semua level, pilihan
    # kualitas praktis tidak berpengaruh apa-apa.
    GS_QUALITY_PRESETS = {
        "low": {"preset": "/screen", "color": 72, "gray": 72, "mono": 300},
        "medium": {"preset": "/ebook", "color": 150, "gray": 150, "mono": 600},
        "high": {"preset": "/printer", "color": 300, "gray": 300, "mono": 1200},
    }

    @staticmethod
    def get_gs_settings(level: str):
        return PDFService.GS_QUALITY_PRESETS.get(
            level, PDFService.GS_QUALITY_PRESETS["medium"]
        )["preset"]

    @staticmethod
    async def compress_pdf(input_path: str, output_path: str, quality: str = "medium"):
        """
        Kecilkan PDF memakai Ghostscript.

        Kalau hasilnya justru lebih besar dari aslinya - lazim terjadi pada PDF
        yang sudah optimal atau didominasi vektor - berkas asli yang dipakai,
        supaya menekan "Compress" tidak pernah menghasilkan berkas lebih gemuk.
        """
        if not os.path.exists(input_path):
            logger.error(f"Input file not found: {input_path}")
            return False

        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)

        settings = PDFService.GS_QUALITY_PRESETS.get(
            quality, PDFService.GS_QUALITY_PRESETS["medium"]
        )

        gs_command = [
            "gs",
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={settings['preset']}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-dSAFER",
            "-dNOGC",
            "-dNOPLATFONTS",
            f"-dColorImageResolution={settings['color']}",
            f"-dGrayImageResolution={settings['gray']}",
            f"-dMonoImageResolution={settings['mono']}",
            f"-sOutputFile={output_path}",
            input_path,
        ]

        if not await PDFService._execute_command(gs_command, "Compression"):
            return False

        if not os.path.exists(output_path):
            return False

        original_size = os.path.getsize(input_path)
        compressed_size = os.path.getsize(output_path)
        if compressed_size >= original_size:
            logger.info(
                f"Kompresi tidak menguntungkan ({compressed_size} >= {original_size} byte), "
                "memakai berkas asli"
            )
            shutil.copyfile(input_path, output_path)

        return True

    @staticmethod
    async def convert_docx_to_pdf(input_path: str, output_dir: str):
        """
        Konversi DOCX ke PDF lewat pool profil LibreOffice.

        Dulu tiap request membuat profil baru di /tmp/libreoffice_<uuid> - path
        POSIX yang di-hardcode, dan ongkos inisialisasi profil dibayar ulang
        setiap konversi. ConvertService sudah punya pool yang memakai ulang
        sejumlah profil, jadi konversi di sini ikut memakainya.

        Mengembalikan tuple (pdf_path, profile_dir) demi kompatibilitas dengan
        pemanggil lama; profile_dir selalu None karena pool yang mengurus
        siklus hidupnya, jadi pemanggil tidak perlu membersihkan apa pun.
        """
        if not os.path.exists(input_path):
            logger.error(f"Input file not found: {input_path}")
            return None, None

        # Impor lokal supaya tidak ada lingkaran impor antar modul layanan
        from app.services.convert_service import ConvertService

        try:
            pdf_path = await ConvertService.office_to_pdf(input_path, output_dir)
        except Exception as e:
            logger.error(f"Error during DOCX conversion: {e}", exc_info=True)
            return None, None

        if pdf_path:
            logger.info(f"DOCX conversion success: {pdf_path}")
        return pdf_path, None

    @staticmethod
    def _detect_ppt_slide_size(input_path: str) -> tuple[float, float] | None:
        """
        Detect slide dimensions from PPT/PPTX file.
        Returns (width_pts, height_pts) in points (1 inch = 72 points), or None if detection fails.
        """
        try:
            file_ext = Path(input_path).suffix.lower()
            
            # For PPTX files, use python-pptx to detect dimensions
            if file_ext == ".pptx":
                try:
                    from pptx import Presentation
                    
                    prs = Presentation(input_path)
                    if len(prs.slides) == 0:
                        return None
                    
                    # Get slide dimensions from presentation
                    # python-pptx uses EMU (English Metric Units)
                    # Convert EMU to points using utility function
                    slide_width_emu = prs.slide_width
                    slide_height_emu = prs.slide_height
                    
                    # Convert EMU to inches, then to points
                    # 1 inch = 914400 EMU, 1 point = 1/72 inch
                    # So: points = (EMU / 914400) * 72 = EMU / 12700
                    width_pts = slide_width_emu / 12700.0
                    height_pts = slide_height_emu / 12700.0
                    
                    logger.info(f"Detected PPTX slide size: {width_pts:.2f} x {height_pts:.2f} points ({width_pts/72:.2f}\" x {height_pts/72:.2f}\")")
                    return (width_pts, height_pts)
                    
                except ImportError:
                    logger.warning("python-pptx not available, cannot detect slide dimensions")
                    return None
                except Exception as e:
                    logger.warning(f"Error detecting PPTX dimensions: {e}")
                    return None
            
            # For old PPT files (.ppt), we can't easily detect dimensions
            # Return None to use default/auto-detect from LibreOffice output
            elif file_ext == ".ppt":
                logger.info("Old PPT format detected, will use LibreOffice default dimensions")
                return None
            
            return None
            
        except Exception as e:
            logger.warning(f"Error in slide size detection: {e}")
            return None

    @staticmethod
    async def convert_ppt_to_pdf(input_path: str, output_dir: str):
        """
        Konversi PPT/PPTX ke PDF lewat pool profil LibreOffice.

        Keluaran LibreOffice dipakai apa adanya tanpa pasca-proses Ghostscript,
        karena /prepress sempat mengubah skala teks sehingga ukurannya tidak lagi
        sama dengan slide aslinya.

        Mengembalikan tuple (pdf_path, profile_dir) demi kompatibilitas dengan
        pemanggil lama; profile_dir selalu None karena pool yang mengurus siklus
        hidupnya.
        """
        if not os.path.exists(input_path):
            logger.error(f"Input file not found: {input_path}")
            return None, None

        # Impor lokal supaya tidak ada lingkaran impor antar modul layanan
        from app.services.convert_service import ConvertService

        slide_dimensions = await asyncio.to_thread(
            PDFService._detect_ppt_slide_size, input_path
        )

        try:
            pdf_path = await ConvertService.office_to_pdf(input_path, output_dir)
        except Exception as e:
            logger.error(f"Error during PPT conversion: {e}", exc_info=True)
            return None, None

        if not pdf_path:
            logger.error("LibreOffice conversion failed")
            return None, None

        if slide_dimensions:
            width_pts, height_pts = slide_dimensions
            logger.info(
                f"Detected slide size: {width_pts / 72:.2f}\" x {height_pts / 72:.2f}\" - "
                "memakai keluaran LibreOffice apa adanya agar ukuran teks terjaga"
            )

        logger.info(f"PPT conversion success: {pdf_path}")
        return pdf_path, None

    # Ukuran halaman baku dalam milimeter (lebar, tinggi) untuk orientasi potret
    PAGE_SIZES_MM = {
        "a4": (210.0, 297.0),
        "letter": (215.9, 279.4),
        "a5": (148.0, 210.0),
        "a3": (297.0, 420.0),
    }

    @staticmethod
    def _build_image_layout(page_size: str, orientation: str, margin_mm: float):
        """
        Bangun layout img2pdf, atau None bila halaman harus mengikuti ukuran gambar.

        Margin tanpa ukuran halaman tetap diabaikan: img2pdf butuh pagesize
        untuk tahu ke mana gambar harus dikecilkan.
        """
        size = PDFService.PAGE_SIZES_MM.get((page_size or "auto").lower())
        if not size:
            return None

        width_mm, height_mm = size
        if (orientation or "portrait").lower() == "landscape":
            width_mm, height_mm = height_mm, width_mm

        border_pt = img2pdf.mm_to_pt(max(0.0, margin_mm))

        return img2pdf.get_layout_fun(
            pagesize=(img2pdf.mm_to_pt(width_mm), img2pdf.mm_to_pt(height_mm)),
            border=(border_pt, border_pt),
            fit=img2pdf.FitMode.into,
        )

    @staticmethod
    async def convert_image_to_pdf(
        input_paths: list[str],
        output_path: str,
        page_size: str = "auto",
        orientation: str = "portrait",
        margin_mm: float = 0.0,
    ):
        """
        Gabungkan gambar menjadi PDF.

        page_size: "auto" mengikuti ukuran asli gambar, atau "a4"/"letter"
        untuk halaman berukuran tetap.
        orientation: "portrait" atau "landscape", hanya berlaku bila page_size
        bukan "auto".
        margin_mm: jarak tepi dalam milimeter.
        """
        if not input_paths:
            logger.error("No input images provided")
            return False

        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)

        try:
            layout_fun = PDFService._build_image_layout(page_size, orientation, margin_mm)

            def perform_conversion():
                with open(output_path, "wb") as f:
                    if layout_fun:
                        f.write(img2pdf.convert(input_paths, layout_fun=layout_fun))
                    else:
                        f.write(img2pdf.convert(input_paths))

            await asyncio.to_thread(perform_conversion)

            if os.path.exists(output_path):
                logger.info(f"Image to PDF conversion success: {output_path}")
                return True
            return False

        except Exception as e:
            logger.error(f"Error during image to PDF conversion: {e}", exc_info=True)
            return False

    @staticmethod
    async def _execute_command(command: list, task_name: str):
        try:
            process = await asyncio.create_subprocess_exec(
                *command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE
            )

            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(), timeout=PROCESS_TIMEOUT
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                logger.error(f"{task_name} timeout after {PROCESS_TIMEOUT}s")
                return False

            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                logger.error(
                    f"{task_name} failed (exit {process.returncode}): {error_msg}"
                )
                return False

            return True

        except Exception as e:
            logger.error(f"Unexpected error during {task_name}: {e}", exc_info=True)
            return False