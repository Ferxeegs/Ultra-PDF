import subprocess
import os

class PDFService:
    @staticmethod
    def get_gs_settings(level: str):
        # Mapping level kompresi ke preset Ghostscript
        settings = {
            "low": "/screen",    # 72 dpi (Paling kecil)
            "medium": "/ebook",   # 150 dpi (Standar)
            "high": "/printer",  # 300 dpi (Kualitas tinggi)
        }
        return settings.get(level, "/ebook")

    @staticmethod
    async def compress_pdf(input_path: str, output_path: str, quality: str = "medium"):
        gs_setting = PDFService.get_gs_settings(quality)
        
        gs_command = [
            "gs", "-sDEVICE=pdfwrite", "-dCompatibilityLevel=1.4",
            f"-dPDFSETTINGS={gs_setting}",
            "-dNOPAUSE", "-dQUIET", "-dBATCH",
            f"-sOutputFile={output_path}", input_path
        ]

        try:
            # Menggunakan shell=False untuk keamanan
            subprocess.run(gs_command, check=True, capture_output=True)
            return True
        except subprocess.CalledProcessError as e:
            print(f"Ghostscript Error: {e.stderr.decode()}")
            return False