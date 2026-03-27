# UltraPDF Backend API

Backend untuk aplikasi UltraPDF, menyediakan layanan kompresi dan konversi PDF yang aman dan efisien. Dibangun menggunakan FastAPI dengan dukungan pemrosesan dokumen tingkat lanjut.

## 🚀 Fitur Utama

- **Konversi Dokumen**: Mengubah gambar (JPG, PNG) dan dokumen Office ke PDF.
- **Remove Background Gambar**: Menghapus background gambar menjadi PNG transparan menggunakan `rembg` (U2-Net).
- **Kompresi PDF**: Optimasi ukuran file PDF dengan berbagai tingkat kompresi.
- **Keamanan**: Dilengkapi dengan Security Headers, Rate Limiting, dan validasi input yang ketat.
- **Kinerja Tinggi**: Menggunakan `uv` untuk manajemen dependensi yang cepat dan efisien.
- **Docker Support**: Siap dijalankan dalam container dengan konfigurasi yang optimal.

## 📋 Prasyarat

Sebelum memulai, pastikan sistem Anda memiliki:

- **Python 3.11+**
- **[uv](https://github.com/astral-sh/uv)** (Package manager Python modern yang sangat cepat)
- **Ghostscript** & **LibreOffice** (Untuk pemrosesan dokumen, sudah tersedia di Docker image)
- **Font Dasar** (Untuk konversi PPT/Word ke PDF, sudah tersedia di Docker image)

### ⚠️ Catatan Penting: Font untuk Konversi PPT/Word dengan Presisi Tinggi

Saat mengonversi PPT atau Word ke PDF, masalah yang paling sering muncul adalah **Font Missing** yang menyebabkan teks berantakan atau posisi bergeser. Sistem ini telah dioptimasi dengan 3 strategi untuk presisi maksimal:

#### 1. **Font Microsoft (Wajib untuk Presisi Tinggi)**

**Metode Terbaik: Copy Font dari Windows (Rekomendasi)**
1. Salin folder `C:\Windows\Fonts` dari komputer Windows Anda
2. Buat folder `fonts/` di root direktori `backend/`
3. Paste semua file font (.ttf, .ttc, .otf) ke dalam folder `fonts/`
4. Rebuild Docker image - font akan otomatis terdeteksi dan diinstall

**Metode Alternatif: Install via Package Manager**
```bash
# Di Dockerfile akan otomatis mencoba install ttf-mscorefonts-installer
# Jika gagal, akan fallback ke fonts-liberation
```

**Di Server Ubuntu/Debian (Manual, tanpa Docker):**
```bash
sudo apt-get update
sudo apt-get install -y fonts-liberation fonts-noto fonts-noto-cjk fontconfig

# Untuk font Microsoft (opsional, terkadang sulit di-install)
echo "ttf-mscorefonts-installer ttf-mscorefonts-installer/accepted-mscorefonts-eula boolean true" | sudo debconf-set-selections
sudo apt-get install -y ttf-mscorefonts-installer || echo "Installation skipped"
sudo fc-cache -f -v
```

#### 2. **Isolated User Profile (Mencegah Race Condition)**

Setiap konversi menggunakan user profile LibreOffice yang unik untuk mencegah konflik saat multiple request berjalan bersamaan. Profile akan otomatis dibersihkan setelah konversi selesai.

#### 3. **Post-Processing dengan Ghostscript (Embed Fonts)**

PDF hasil LibreOffice di-refine menggunakan Ghostscript dengan setting `/prepress` untuk:
- Embed semua font dengan benar
- Memastikan font subsetting optimal
- Kualitas gambar tinggi (300 DPI)

**Font yang terinstall akan memastikan:**
- ✅ Ukuran teks (kerning/spacing) sama persis dengan dokumen asli
- ✅ Tidak ada font substitution yang mengubah layout
- ✅ Presisi tinggi untuk dokumen yang menggunakan Calibri, Arial, Times New Roman, Segoe UI, dll

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
   # Gunakan model yang sudah tersedia lokal di folder .u2net
   REMBG_MODEL_NAME=u2net
   # Batas sisi terpanjang input sebelum inferensi (otomatis di-resize)
   REMBG_MAX_SIDE=1600
   # Default: CPU (aman). Untuk GPU CUDA, pasang onnxruntime-gpu lalu set:
   REMBG_USE_CUDA=0
   ```

### Remove background: `net::ERR_EMPTY_RESPONSE` di browser

Artinya **koneksi ke backend terputus tanpa respons HTTP** — biasanya proses Python/Uvicorn **crash** saat inferensi (bukan error JSON 500). Penyebab umum:

- **`onnxruntime-gpu` + driver/CUDA/cuDNN tidak cocok** → native crash (segfault). **Solusi:** pakai `onnxruntime` (CPU) seperti di `pyproject.toml` saat ini, atau pastikan stack CUDA sesuai versi wheel GPU.
- **OOM** (model besar / RAM kecil) → proses dibunuh oleh OS.
- **Request pertama** mengunduh model (bisa lama); jika container/proses mati di tengah, browser bisa terlihat seperti empty response.

**GPU (opsional):** uninstall `onnxruntime`, install `onnxruntime-gpu` yang cocok dengan CUDA Anda, lalu set `REMBG_USE_CUDA=1`. Tanpa itu, biarkan default CPU.

### Remove background: gagal download model dari GitHub

Jika container tidak punya akses DNS/Internet, rembg tidak bisa auto-download model. Pastikan file model sudah ada secara lokal di `backend/.u2net/` dan dipasang sebagai volume ke `/app/.u2net`.

Minimal salah satu file berikut harus ada:
- `u2net.onnx` (disarankan)
- `u2netp.onnx`

Jika tetap gagal resolve domain dari dalam container, tambahkan DNS resolver publik di `docker-compose.yml` (contoh: `1.1.1.1`, `8.8.8.8`) lalu rebuild/restart service.

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