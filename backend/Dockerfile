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