# UltraPDF Backend API

Backend untuk aplikasi UltraPDF, menyediakan layanan kompresi dan konversi PDF yang aman dan efisien. Dibangun menggunakan FastAPI dengan dukungan pemrosesan dokumen tingkat lanjut.

## 🚀 Fitur Utama

- **Konversi Dokumen**: Mengubah gambar (JPG, PNG) dan dokumen Office ke PDF.
- **Kompresi PDF**: Optimasi ukuran file PDF dengan berbagai tingkat kompresi.
- **Keamanan**: Dilengkapi dengan Security Headers, Rate Limiting, dan validasi input yang ketat.
- **Kinerja Tinggi**: Menggunakan `uv` untuk manajemen dependensi yang cepat dan efisien.
- **Docker Support**: Siap dijalankan dalam container dengan konfigurasi yang optimal.

## 📋 Prasyarat

Sebelum memulai, pastikan sistem Anda memiliki:

- **Python 3.11+**
- **[uv](https://github.com/astral-sh/uv)** (Package manager Python modern yang sangat cepat)
- **Ghostscript** & **LibreOffice** (Untuk pemrosesan dokumen, sudah tersedia di Docker image)

## 🛠️ Instalasi & Menjalankan (Local)

1. **Clone Repository**

   ```bash
   git clone <repository-url>
   cd backend
   ```

2. **Install Dependensi dengan `uv`**

   ```bash
   # Membuat virtual environment dan menginstal dependensi
   uv sync
   ```

3. **Setup Environment Variables**
   Salin file `.env.example` ke `.env` (jika ada) atau buat file `.env` baru:

   ```env
   ENV=development
   ALLOWED_ORIGINS=http://localhost:3000
   UPLOAD_DIR=uploads
   OUTPUT_DIR=outputs
   ```

4. **Jalankan Aplikasi**
   ```bash
   uv run uvicorn app.main:app --reload
   ```
   Server akan berjalan di `http://localhost:8000`.

## 🐳 Menjalankan dengan Docker

Cara termudah untuk menjalankan aplikasi dengan semua dependensi sistem (Ghostscript, LibreOffice) adalah menggunakan Docker.

1. **Build Image**

   ```bash
   docker build -t ultrapdf-backend .
   ```

2. **Jalankan Container**
   ```bash
   docker run -p 8000:8000 ultrapdf-backend
   ```

## 📚 Dokumentasi API

Setelah server berjalan, dokumentasi interaktif tersedia di:

- **Swagger UI**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **ReDoc**: [http://localhost:8000/redoc](http://localhost:8000/redoc)

## 📁 Struktur Project

```
backend/
├── app/
│   ├── api/            # Endpoint API
│   ├── middleware/     # Security & Utility Middlewares
│   ├── services/       # Logika bisnis (konversi, kompresi)
│   ├── utils/          # Fungsi bantuan
│   └── main.py         # Entry point aplikasi
├── uploads/            # Direktori sementara upload
├── outputs/            # Direktori hasil pemrosesan
├── pyproject.toml      # Konfigurasi dependensi & project
├── uv.lock             # Lockfile dependensi
└── Dockerfile          # Konfigurasi Docker
```

## 🔒 Keamanan

Project ini menerapkan beberapa lapisan keamanan:

- **Rate Limiting**: Mencegah abuse pada endpoint.
- **Security Headers**: Perlindungan standar web.
- **Validasi File**: Memastikan file yang diupload aman dan valid menggunakan `python-magic`.