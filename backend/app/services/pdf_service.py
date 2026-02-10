import os
import logging
import asyncio
from pathlib import Path
import img2pdf

logger = logging.getLogger(__name__)

PROCESS_TIMEOUT = int(os.getenv("PROCESS_TIMEOUT", "300"))


class PDFService:
    @staticmethod
    def get_gs_settings(level: str):
        settings = {
            "low": "/screen",
            "medium": "/ebook",
            "high": "/printer",
        }
        return settings.get(level, "/ebook")

    @staticmethod
    async def compress_pdf(input_path: str, output_path: str, quality: str = "medium"):
        if not os.path.exists(input_path):
            logger.error(f"Input file not found: {input_path}")
            return False

        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)

        gs_setting = PDFService.get_gs_settings(quality)

        gs_command = [
            "gs",
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={gs_setting}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-dSAFER",
            "-dNOGC",
            "-dNOPLATFONTS",
            "-dColorImageResolution=150",
            "-dGrayImageResolution=150",
            "-dMonoImageResolution=150",
            f"-sOutputFile={output_path}",
            input_path,
        ]

        return await PDFService._execute_command(gs_command, "Compression")

    @staticmethod
    async def convert_docx_to_pdf(input_path: str, output_dir: str):
        if not os.path.exists(input_path):
            logger.error(f"Input file not found: {input_path}")
            return None

        os.makedirs(output_dir, exist_ok=True)

        command = [
            "libreoffice",
            "--headless",
            "--convert-to",
            "pdf",
            "--outdir",
            output_dir,
            input_path,
        ]

        success = await PDFService._execute_command(command, "DOCX Conversion")

        if success:
            file_stem = Path(input_path).stem
            expected_pdf_path = os.path.join(output_dir, f"{file_stem}.pdf")

            if os.path.exists(expected_pdf_path):
                logger.info(f"Conversion success: {expected_pdf_path}")
                return expected_pdf_path

        return None

    @staticmethod
    async def convert_image_to_pdf(input_paths: list[str], output_path: str):
        if not input_paths:
            logger.error("No input images provided")
            return False

        output_dir = os.path.dirname(output_path)
        os.makedirs(output_dir, exist_ok=True)

        try:

            def perform_conversion():
                with open(output_path, "wb") as f:
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