# Gunakan image Python yang ringan
FROM python:3.11-slim

# Set environment variables
# Mencegah Python menulis file .pyc dan memastikan output log tidak tertahan
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Tentukan direktori kerja di dalam kontainer
WORKDIR /app

# Install Ghostscript dan library sistem yang diperlukan
RUN apt-get update && apt-get install -y --no-install-recommends \
    ghostscript \
    libmagic1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy file requirements terlebih dahulu untuk memanfaatkan cache Docker
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy seluruh isi proyek ke dalam kontainer
COPY . .

# Port yang akan digunakan FastAPI
EXPOSE 8000

# Perintah default akan digantikan oleh docker-compose saat development
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]