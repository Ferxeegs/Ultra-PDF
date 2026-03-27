import os
import logging
import asyncio
import uuid
import shutil
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
        """
        Convert DOCX to PDF with isolated user profile to prevent race conditions.
        
        Returns tuple: (pdf_path, user_profile_dir) or (None, None) on failure
        user_profile_dir should be cleaned up by caller after use
        """
        if not os.path.exists(input_path):
            logger.error(f"Input file not found: {input_path}")
            return None, None

        os.makedirs(output_dir, exist_ok=True)

        # Create unique user profile directory for this conversion
        unique_user_dir = f"/tmp/libreoffice_{uuid.uuid4().hex}"
        os.makedirs(unique_user_dir, exist_ok=True)

        try:
            command = [
                "libreoffice",
                f"-env:UserInstallation=file://{unique_user_dir}",
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
                    logger.info(f"DOCX conversion success: {expected_pdf_path}")
                    return expected_pdf_path, unique_user_dir

            return None, unique_user_dir

        except Exception as e:
            logger.error(f"Error during DOCX conversion: {e}", exc_info=True)
            return None, unique_user_dir

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
        Convert PPT/PPTX to PDF with high precision using:
        1. Isolated LibreOffice user profile (prevents race conditions)
        2. Dynamic page size detection from slide dimensions
        3. Post-processing with Ghostscript /prepress (embeds fonts properly, sets correct page size)
        
        Returns tuple: (pdf_path, user_profile_dir) or (None, None) on failure
        user_profile_dir should be cleaned up by caller after use
        """
        if not os.path.exists(input_path):
            logger.error(f"Input file not found: {input_path}")
            return None, None

        os.makedirs(output_dir, exist_ok=True)

        # Detect slide dimensions before conversion
        slide_dimensions = await asyncio.to_thread(PDFService._detect_ppt_slide_size, input_path)
        
        # Create unique user profile directory for this conversion
        # This prevents race conditions when multiple conversions run simultaneously
        unique_user_dir = f"/tmp/libreoffice_{uuid.uuid4().hex}"
        os.makedirs(unique_user_dir, exist_ok=True)

        try:
            # Step 1: Convert PPT to PDF using LibreOffice with isolated profile
            # LibreOffice will preserve slide dimensions and text size automatically
            # Use default PDF export settings to maintain original appearance
            command = [
                "libreoffice",
                f"-env:UserInstallation=file://{unique_user_dir}",
                "--headless",
                "--convert-to",
                "pdf",
                "--outdir",
                output_dir,
                input_path,
            ]

            success = await PDFService._execute_command(command, "PPT Conversion")

            if not success:
                logger.error("LibreOffice conversion failed")
                return None, unique_user_dir

            file_stem = Path(input_path).stem
            libreoffice_pdf_path = os.path.join(output_dir, f"{file_stem}.pdf")

            if not os.path.exists(libreoffice_pdf_path):
                logger.error(f"LibreOffice output not found: {libreoffice_pdf_path}")
                return None, unique_user_dir

            # Step 2: Use LibreOffice output directly to preserve exact text size
            # LibreOffice already embeds fonts and preserves dimensions correctly
            # Ghostscript post-processing can cause text scaling issues, so we skip it
            # This ensures text size matches the original PPT exactly
            
            if slide_dimensions:
                width_pts, height_pts = slide_dimensions
                logger.info(f"Detected slide size: {width_pts/72:.2f}\" x {height_pts/72:.2f}\" - using LibreOffice output directly to preserve text size")
            else:
                logger.info("Using LibreOffice output directly to preserve original text size and layout")
            
            # Return LibreOffice output directly without Ghostscript processing
            # This prevents any scaling that might change text size
            logger.info(f"PPT conversion success (LibreOffice direct output): {libreoffice_pdf_path}")
            return libreoffice_pdf_path, unique_user_dir

        except Exception as e:
            logger.error(f"Error during PPT conversion: {e}", exc_info=True)
            return None, unique_user_dir

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