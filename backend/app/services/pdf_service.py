import subprocess
import os
import logging
import asyncio
from pathlib import Path

logger = logging.getLogger(__name__)

# Timeout untuk Ghostscript command (dalam detik)
GS_TIMEOUT = int(os.getenv("GS_TIMEOUT", "300"))  # 5 menit default


class PDFService:
    @staticmethod
    def get_gs_settings(level: str):
        """Mapping level kompresi ke preset Ghostscript"""
        settings = {
            "low": "/screen",    # 72 dpi (Paling kecil)
            "medium": "/ebook",   # 150 dpi (Standar)
            "high": "/printer",  # 300 dpi (Kualitas tinggi)
        }
        return settings.get(level, "/ebook")

    @staticmethod
    async def compress_pdf(input_path: str, output_path: str, quality: str = "medium"):
        """
        Compress PDF dengan validasi dan error handling yang lebih baik
        
        Args:
            input_path: Path ke file PDF input
            output_path: Path untuk file PDF output
            quality: Level kompresi (low, medium, high)
        
        Returns:
            bool: True jika berhasil, False jika gagal
        """
        # Validasi input path
        if not os.path.exists(input_path):
            logger.error(f"Input file not found: {input_path}")
            return False
        
        # Validasi output directory
        output_dir = os.path.dirname(output_path)
        if not os.path.exists(output_dir):
            os.makedirs(output_dir, exist_ok=True)
        
        gs_setting = PDFService.get_gs_settings(quality)
        
        # Ghostscript command dengan security flags tambahan
        gs_command = [
            "gs",
            "-sDEVICE=pdfwrite",
            "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={gs_setting}",
            "-dNOPAUSE",
            "-dQUIET",
            "-dBATCH",
            "-dSAFER",  # Security flag: disable file system access
            "-dNOGC",   # Disable garbage collection untuk performa
            "-dNOPLATFONTS",  # Disable platform fonts
            "-dColorImageResolution=150",  # Limit image resolution
            "-dGrayImageResolution=150",
            "-dMonoImageResolution=150",
            f"-sOutputFile={output_path}",
            input_path
        ]

        try:
            # Run command dengan timeout untuk mencegah hang
            process = await asyncio.create_subprocess_exec(
                *gs_command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                limit=1024 * 1024  # Limit output buffer to 1MB
            )
            
            try:
                stdout, stderr = await asyncio.wait_for(
                    process.communicate(),
                    timeout=GS_TIMEOUT
                )
            except asyncio.TimeoutError:
                process.kill()
                await process.wait()
                logger.error(f"Ghostscript timeout after {GS_TIMEOUT}s")
                return False
            
            if process.returncode != 0:
                error_msg = stderr.decode() if stderr else "Unknown error"
                logger.error(f"Ghostscript error: {error_msg}")
                return False
            
            # Validasi output file
            if not os.path.exists(output_path):
                logger.error("Output file was not created")
                return False
            
            output_size = os.path.getsize(output_path)
            if output_size == 0:
                logger.error("Output file is empty")
                return False
            
            logger.info(f"PDF compressed successfully: {input_path} -> {output_path}")
            return True
            
        except Exception as e:
            logger.error(f"Error during PDF compression: {e}", exc_info=True)
            return False