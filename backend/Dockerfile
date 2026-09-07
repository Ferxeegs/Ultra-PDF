# 1. Gunakan image Python yang ringan
FROM python:3.11-slim

# 2. Instal uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
# Mempercepat instalasi dengan bytecode compilation
ENV UV_COMPILE_BYTECODE=1
# Menggunakan mode copy karena hardlink sering bermasalah di Docker filesystem
ENV UV_LINK_MODE=copy

# --- PERBAIKAN DI SINI ---
# Kita hapus UV_PROJECT_ENVIRONMENT="/usr/local"
# Sebagai gantinya, tambahkan path .venv ke PATH sistem agar 'python' dan 'uvicorn' langsung terbaca
ENV PATH="/app/.venv/bin:$PATH"
ENV U2NET_HOME="/app/.u2net"

# Tentukan direktori kerja
WORKDIR /app

# 3. Install Ghostscript, LibreOffice, dan font dasar untuk konversi PPT/Word dengan presisi tinggi
# Font Microsoft diperlukan untuk memastikan konversi PPT/Word ke PDF tidak mengalami masalah font missing
# dan ukuran teks (kerning/spacing) sama persis dengan dokumen asli
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    libmagic1 \
    libglib2.0-0 \
    libgl1 \
    libreoffice \
    libpango-1.0-0 \
    libpangoft2-1.0-0 \
    libharfbuzz0b \
    libcairo2 \
    libffi8 \
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    fontconfig \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy file manajemen dependensi DAN README
# uv sync membutuhkan README.md jika didefinisikan di pyproject.toml
COPY pyproject.toml uv.lock README.md* ./

# 5. Instal dependensi menggunakan uv
# --frozen dilepas agar perubahan dependency (mis. rembg) tidak gagal saat build.
RUN uv sync --no-install-project --no-dev

# 6. Copy seluruh isi proyek ke dalam kontainer (termasuk folder fonts jika ada)
COPY . .

# Pre-download BRIA RMBG 1.4 ONNX (~176MB) agar inferensi offline di container
RUN mkdir -p /app/.u2net && uv run python -c "\
import pooch; \
pooch.retrieve( \
  'https://huggingface.co/briaai/RMBG-1.4/resolve/main/onnx/model.onnx', \
  'sha256:8cafcf770b06757c4eaced21b1a88e57fd2b66de01b8045f35f01535ba742e0f', \
  fname='bria-rmbg-1.4.onnx', path='/app/.u2net', progressbar=True)"

# 7. Install Microsoft Fonts (Calibri, Arial, Times New Roman, Segoe UI, dll)
# Prioritas: Jika folder ./fonts ada (berisi font dari C:\Windows\Fonts), gunakan itu
# Fallback: Coba install ttf-mscorefonts-installer
RUN if [ -d "/app/fonts" ] && [ "$(ls -A /app/fonts)" ]; then \
        echo "Using custom fonts from ./fonts directory" && \
        mkdir -p /usr/share/fonts/truetype/custom && \
        cp -r /app/fonts/* /usr/share/fonts/truetype/custom/ && \
        fc-cache -f -v && \
        echo "Custom fonts installed successfully"; \
    else \
        echo "Custom fonts not found, trying ttf-mscorefonts-installer" && \
        echo "ttf-mscorefonts-installer ttf-mscorefonts-installer/accepted-mscorefonts-eula boolean true" | debconf-set-selections || true && \
        (apt-get update && apt-get install -y --no-install-recommends ttf-mscorefonts-installer && \
         apt-get clean && rm -rf /var/lib/apt/lists/* || \
         echo "ttf-mscorefonts-installer installation skipped - using system fonts only") && \
        fc-cache -f -v; \
    fi

# Port yang akan digunakan FastAPI
EXPOSE 8000

# 7. Perintah untuk menjalankan aplikasi
# Karena path .venv sudah masuk ke PATH, kita bisa pakai 'uv run' atau langsung 'uvicorn'
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "300"]