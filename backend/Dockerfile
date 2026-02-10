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

# Tentukan direktori kerja
WORKDIR /app

# 3. Install Ghostscript dan library sistem
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    libmagic1 \
    libreoffice \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# 4. Copy file manajemen dependensi DAN README
# uv sync membutuhkan README.md jika didefinisikan di pyproject.toml
COPY pyproject.toml uv.lock README.md* ./

# 5. Instal dependensi menggunakan uv
# uv akan otomatis membuat virtual environment di /app/.venv
RUN uv sync --frozen --no-install-project --no-dev

# 6. Copy seluruh isi proyek ke dalam kontainer
COPY . .

# Port yang akan digunakan FastAPI
EXPOSE 8000

# 7. Perintah untuk menjalankan aplikasi
# Karena path .venv sudah masuk ke PATH, kita bisa pakai 'uv run' atau langsung 'uvicorn'
CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--timeout-keep-alive", "300"]