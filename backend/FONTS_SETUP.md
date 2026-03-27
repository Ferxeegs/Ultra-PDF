# Setup Font Microsoft untuk Presisi Konversi PPT/Word

## 🎯 Mengapa Font Penting?

Ketidakakuratan hasil konversi LibreOffice biasanya disebabkan oleh **Font Mismatch**. Jika PPT/Word menggunakan font seperti Calibri, Arial, atau Segoe UI dan Docker tidak punya font tersebut, LibreOffice akan melakukan **Font Substitution** menggunakan font yang ukurannya tidak identik, menyebabkan:
- Teks melebar atau menyempit
- Posisi teks bergeser
- Layout berantakan

## 📋 Metode Setup Font

### Metode 1: Copy Font dari Windows (Rekomendasi - Presisi Tertinggi)

Ini adalah metode terbaik untuk mendapatkan presisi 100% karena menggunakan font yang sama persis dengan yang digunakan di Windows.

**Langkah-langkah:**

1. **Buka folder Fonts di Windows:**
   ```
   C:\Windows\Fonts
   ```

2. **Pilih font yang umum digunakan:**
   - Calibri (calibri.ttf, calibrib.ttf, calibrii.ttf, calibriz.ttf)
   - Arial (arial.ttf, arialbd.ttf, ariali.ttf, arialbi.ttf)
   - Times New Roman (times.ttf, timesbd.ttf, timesi.ttf, timesbi.ttf)
   - Segoe UI (segoeui.ttf, segoeuib.ttf, segoeuii.ttf, segoeuiz.ttf)
   - Atau copy semua font (lebih aman tapi ukuran lebih besar)

3. **Buat folder `fonts/` di root direktori `backend/`:**
   ```bash
   cd backend
   mkdir fonts
   ```

4. **Copy font ke folder `fonts/`:**
   - Copy file font (.ttf, .ttc, .otf) dari `C:\Windows\Fonts` ke `backend/fonts/`

5. **Rebuild Docker image:**
   ```bash
   docker build -t ultrapdf-backend .
   ```

6. **Verifikasi font terinstall:**
   ```bash
   docker run --rm ultrapdf-backend fc-list | grep -i calibri
   ```

### Metode 2: Install via Package Manager (Fallback)

Jika tidak memiliki akses ke font Windows, Dockerfile akan otomatis mencoba install `ttf-mscorefonts-installer`. Namun metode ini terkadang sulit di-install di beberapa distro.

**Catatan:** Font dari package manager mungkin tidak 100% identik dengan font Windows, tapi cukup baik untuk sebagian besar kasus.

## 🔍 Verifikasi Font Terinstall

Setelah build Docker image, verifikasi font terinstall:

```bash
# Masuk ke container
docker run -it --rm ultrapdf-backend bash

# List semua font
fc-list

# Cek font Microsoft spesifik
fc-list | grep -i "calibri\|arial\|times\|segoe"

# Refresh font cache
fc-cache -f -v
```

## 📊 Perbandingan Metode

| Metode | Presisi | Ukuran Image | Keterangan |
|--------|---------|--------------|------------|
| Copy dari Windows | ⭐⭐⭐⭐⭐ 100% | +50-200MB | Font identik dengan Windows |
| ttf-mscorefonts-installer | ⭐⭐⭐⭐ 95% | +30MB | Font Microsoft via package |
| fonts-liberation | ⭐⭐⭐ 80% | +10MB | Font pengganti, ukuran bisa berbeda |

## ⚠️ Troubleshooting

### Font tidak terdeteksi setelah build

1. **Pastikan folder `fonts/` ada dan berisi file font:**
   ```bash
   ls -la backend/fonts/
   ```

2. **Pastikan file font valid (.ttf, .ttc, .otf):**
   ```bash
   file backend/fonts/*.ttf
   ```

3. **Cek log build Docker untuk error:**
   ```bash
   docker build -t ultrapdf-backend . 2>&1 | grep -i font
   ```

### Font masih missing setelah install

1. **Refresh font cache di container:**
   ```bash
   docker run --rm ultrapdf-backend fc-cache -f -v
   ```

2. **Cek LibreOffice bisa akses font:**
   ```bash
   docker run --rm ultrapdf-backend libreoffice --headless --convert-to pdf --outdir /tmp test.pptx
   ```

## 📝 Catatan Legal

Pastikan Anda memiliki lisensi yang sesuai untuk menggunakan font Microsoft di server production. Font yang di-copy dari Windows biasanya memiliki lisensi yang membatasi penggunaan komersial.

